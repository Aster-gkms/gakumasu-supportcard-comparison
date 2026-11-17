import { onBeforeUnmount, shallowRef } from 'vue'
import type { SupportCard } from '../../data/cards'
import type { TotalScore } from '../totalScore'
import {
  conditionsKey,
  normalizeConditions,
  type ScoringConditions,
} from '../conditions/conditions'
import type { ScoreRequest, ScoreResponse, ScoreEntry } from './scoreProtocol'

export const conditionRequestDelay = 40
const conditionCacheLimit = 8

// 条件別キャッシュとWorkerの寿命を管理する。計算自体はtotalScore.tsで行う。
export function useScores(cards: readonly SupportCard[]) {
  const scores = shallowRef<Record<string, TotalScore>>({})
  const errors = shallowRef<Record<string, string>>({})
  const pending = new Set<string>()
  const knownIds = new Set(cards.map((card) => card.id))
  // 現在の条件はscoresへ置き、ここには非表示の条件だけを保持する。
  const inactiveConditionCaches = new Map<string, Record<string, TotalScore>>()
  let activeConditions: ScoringConditions | undefined
  let activeKey = conditionsKey()
  let generation = 0
  let worker: Worker | undefined
  let stagedScores: Record<string, TotalScore> = {}
  let hasDisplayedScores = false
  const priorityKeys = new Set<string>()
  let frame: number | undefined
  let flushTimer: ReturnType<typeof setTimeout> | undefined
  const requestSources = new Map<string, ScoreEntry[]>()
  let requestTimer: ReturnType<typeof setTimeout> | undefined
  let readyAt = 0
  let queueSignature = ''
  function flushScores() {
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
    }
    clearTimeout(flushTimer)
    frame = undefined
    flushTimer = undefined
    if (!Object.keys(stagedScores).length) {
      return
    }
    scores.value = { ...scores.value, ...stagedScores }
    hasDisplayedScores = true
    stagedScores = {}
  }
  function scheduleFlush() {
    if (typeof requestAnimationFrame === 'undefined') {
      flushScores()
      return
    }
    if (frame !== undefined || flushTimer !== undefined) {
      return
    }
    // 一覧は最大20回/秒にまとめる。詳細と最後の1件はこの待ち時間を通らない。
    flushTimer = setTimeout(() => {
      frame = requestAnimationFrame(flushScores)
      flushTimer = setTimeout(flushScores, 50)
    }, 50)
  }
  function setConditions(conditions?: ScoringConditions) {
    const normalized = normalizeConditions(conditions)
    const key = conditionsKey(normalized)
    if (key === activeKey) {
      return
    }
    flushScores()
    const restoredScores = inactiveConditionCaches.get(key) ?? {}
    inactiveConditionCaches.delete(key)
    inactiveConditionCaches.set(activeKey, scores.value)
    // 現在分の1枠も含めて上限8条件。理想値を残し、古い非表示条件から破棄する。
    while (inactiveConditionCaches.size >= conditionCacheLimit) {
      const oldest = [...inactiveConditionCaches.keys()].find((cachedKey) => cachedKey !== 'ideal')
      if (oldest === undefined) {
        break
      }
      inactiveConditionCaches.delete(oldest)
    }
    activeConditions = normalized
    activeKey = key
    generation++
    worker?.terminate()
    worker = undefined
    pending.clear()
    priorityKeys.clear()
    errors.value = {}
    scores.value = restoredScores
    hasDisplayedScores = Object.keys(scores.value).length > 0
    queueSignature = ''
    readyAt = Date.now() + conditionRequestDelay
    if (requestSources.size) {
      scheduleRequests()
    }
  }
  function ensureWorker() {
    if (typeof Worker === 'undefined') {
      return undefined
    }
    if (!worker) {
      const workerGeneration = generation
      worker = new Worker(new URL('./scoreWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<ScoreResponse>) => {
        if (workerGeneration !== generation) {
          return
        }
        const message = event.data
        if (message.score) {
          const key = `${message.score.cardId}:${message.score.limit}`
          pending.delete(key)
          stagedScores[key] = message.score
          // 詳細・編成枠・最初の結果は即時。通常の後続はまとめて再描画する。
          if (priorityKeys.delete(key) || pending.size === 0 || !hasDisplayedScores) {
            flushScores()
          } else {
            scheduleFlush()
          }
        } else if (message.error) {
          const key = `${message.id}:${message.limit}`
          pending.delete(key)
          priorityKeys.delete(key)
          errors.value = { ...errors.value, [key]: message.error }
          if (pending.size === 0) {
            flushScores()
          }
        }
      }
      worker.onerror = () => {
        if (workerGeneration !== generation) {
          return
        }
        pending.clear()
        priorityKeys.clear()
        flushScores()
        worker?.terminate()
        worker = undefined
        errors.value = {
          ...errors.value,
          worker: '計算処理を開始できませんでした。ページを再読み込みしてください。',
        }
      }
    }
    return worker
  }
  function scheduleRequests() {
    clearTimeout(requestTimer)
    requestTimer = setTimeout(reconcileRequests, Math.max(0, readyAt - Date.now()))
  }
  function setRequests(source: string, entries: readonly ScoreEntry[]) {
    const next = entries
      .filter((entry) => knownIds.has(entry.cardId))
      .map((entry) => ({ ...entry }))
    if (JSON.stringify(requestSources.get(source) ?? []) === JSON.stringify(next)) {
      return
    }
    if (next.length) {
      requestSources.set(source, next)
    } else {
      requestSources.delete(source)
    }
    scheduleRequests()
  }
  function reconcileRequests() {
    requestTimer = undefined
    const desired = new Map<string, ScoreEntry>()
    for (const entries of requestSources.values())
      for (const entry of entries) {
        const key = `${entry.cardId}:${entry.limit}`
        const previous = desired.get(key)
        if (!previous || (entry.priority ?? 0) > (previous.priority ?? 0)) {
          desired.set(key, entry)
        }
      }
    if ([...desired].some(([key, entry]) => (entry.priority ?? 0) > 0 && stagedScores[key])) {
      flushScores()
    }
    const missing = [...desired]
      .filter(([key]) => !scores.value[key] && !stagedScores[key] && !errors.value[key])
      .map(([, entry]) => ({ id: entry.cardId, limit: entry.limit, priority: entry.priority ?? 0 }))
      .sort((left, right) => right.priority - left.priority)
    const signature = JSON.stringify(missing)
    if (signature === queueSignature) {
      return
    }
    queueSignature = signature
    // 全件完了後のキャッシュ切替では、空の依頼さえWorkerへ送らない。
    if (!missing.length && pending.size === 0) {
      return
    }
    pending.clear()
    priorityKeys.clear()
    for (const entry of missing) {
      const key = `${entry.id}:${entry.limit}`
      pending.add(key)
      if (entry.priority > 0) {
        priorityKeys.add(key)
      }
    }
    // 全件キャッシュ済みでも、以前の画面の残りジョブは取り下げる。
    const currentWorker = missing.length ? ensureWorker() : worker
    currentWorker?.postMessage({
      jobs: missing,
      ...(activeConditions ? { conditions: activeConditions } : {}),
    } satisfies ScoreRequest)
  }
  onBeforeUnmount(() => {
    generation++
    worker?.terminate()
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
    }
    clearTimeout(flushTimer)
    clearTimeout(requestTimer)
    requestSources.clear()
  })
  return { scores, errors, setConditions, setRequests }
}

export type ScoreService = ReturnType<typeof useScores>
