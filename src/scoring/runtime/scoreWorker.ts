import { loadCards } from '../../data/cards'
import { calculateTotalScore } from '../totalScore'
import { conditionsKey, type ScoringConditions } from '../conditions/conditions'
import type { ScoreRequest } from './scoreProtocol'
const cards = new Map(loadCards().map((card) => [card.id, card]))
type ScoreJob = {
  id: string
  limit: number
  conditions?: ScoringConditions
  key: string
  priority: number
}
let queue: ScoreJob[] = []
let activeJob: ScoreJob | undefined
let running = false
// 結果が画面に届く前に再依頼されても、同じ計算をもう一度実行しない。
// Workerは条件変更時に破棄されるため、この集合も一緒に解放される。
const completed = new Set<string>()
async function drain() {
  if (running) {
    return
  }
  running = true
  // 各カードの間で受信を処理しつつ、連続setTimeout(0)の待ち時間を避ける。
  // キューが空になったらポートを閉じ、次のdrainで作り直す。
  const channel = typeof MessageChannel === 'undefined' ? undefined : new MessageChannel()
  try {
    while (queue.length) {
      const job = queue.shift()!
      activeJob = job
      try {
        const card = cards.get(job.id)
        if (!card) {
          throw new Error('カードが見つかりません。')
        }
        const score = calculateTotalScore(card, job.limit, job.conditions)
        completed.add(job.key)
        self.postMessage({ score })
      } catch (error) {
        self.postMessage({
          id: job.id,
          limit: job.limit,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      activeJob = undefined
      if (queue.length) {
        await new Promise<void>((resolve) => {
          if (channel) {
            channel.port1.onmessage = () => resolve()
            channel.port2.postMessage(null)
          } else {
            setTimeout(resolve, 0)
          }
        })
      }
    }
  } finally {
    channel?.port1.close()
    channel?.port2.close()
    activeJob = undefined
    running = false
  }
}
// 詳細カードの優先依頼でも、実行中・待機中の同じジョブを重複させない。
self.onmessage = (event: MessageEvent<ScoreRequest>) => {
  const { conditions } = event.data
  const key = conditionsKey(conditions)
  const unique = new Set<string>()
  // 今必要なカードだけで待ち行列を置き換える。実行中・完了済みの再計算はしない。
  queue = event.data.jobs
    .flatMap(({ id, limit, priority = 0 }) => {
      const jobKey = `${key}:${id}:${limit}`
      if (unique.has(jobKey) || completed.has(jobKey) || activeJob?.key === jobKey) {
        return []
      }
      unique.add(jobKey)
      return [{ id, limit, conditions, key: jobKey, priority }]
    })
    .sort((left, right) => right.priority - left.priority)
  void drain()
}
