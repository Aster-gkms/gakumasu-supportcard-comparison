import type { SupportCard } from '../data/cards.ts'
import { emptyTypeScores, scoreTargets, scoreTypes } from '../scoring/scoreMath.ts'
import type { TotalScore } from '../scoring/totalScore.ts'

export const deckPlans = ['sense', 'logic', 'anomaly'] as const
export type DeckPlan = (typeof deckPlans)[number]
export type DeckSlot = { cardId: string; limit: number } | null
export type Deck = { plan: DeckPlan; slots: DeckSlot[] }
export const deckStorageKey = 'gscc-deck-v1'
type Card = Pick<SupportCard, 'id' | 'plan'>
export const canEquip = (card: Card, plan: DeckPlan) => card.plan === 'free' || card.plan === plan
export const emptyDeck = (): Deck => ({ plan: 'sense', slots: Array(6).fill(null) })

// 同じカードを別の枠へ置いた場合は交換。
export function placeCard(
  deck: Deck,
  cards: readonly Card[],
  cardId: string,
  index: number,
  initialLimit = 4,
): Deck {
  const card = cards.find((card) => card.id === cardId)
  if (!card || !canEquip(card, deck.plan)) {
    throw new Error('選択中のプランに編成できません。')
  }
  if (!Number.isInteger(index) || index < 0 || index >= 6) {
    throw new Error('編成枠が不正です。')
  }
  if (!Number.isInteger(initialLimit) || initialLimit < 0 || initialLimit > 4) {
    throw new Error('凸数は0～4で指定してください。')
  }
  const slots = [...deck.slots]
  const source = slots.findIndex((slot) => slot?.cardId === cardId)
  if (source === index) {
    return deck
  }
  const incoming = source < 0 ? { cardId, limit: initialLimit } : slots[source]!
  if (source >= 0) {
    slots[source] = slots[index]!
  }
  slots[index] = incoming
  return { ...deck, slots }
}

export function changeDeckPlan(deck: Deck, plan: DeckPlan, cards: readonly Card[]): Deck {
  return {
    plan,
    slots: deck.slots.map((slot) =>
      slot && cards.some((card) => card.id === slot.cardId && canEquip(card, plan)) ? slot : null,
    ),
  }
}

export function parseDeck(source: string, cards: readonly Card[]): Deck {
  const value = JSON.parse(source)
  if (
    value?.version !== 1 ||
    !deckPlans.includes(value.plan) ||
    !Array.isArray(value.slots) ||
    value.slots.length !== 6
  ) {
    throw new Error('保存された編成の形式が不正です。')
  }
  const deck = emptyDeck()
  deck.plan = value.plan
  const ids = new Set<string>()
  for (const [index, slot] of value.slots.entries()) {
    if (slot === null) {
      continue
    }
    if (
      !slot ||
      typeof slot.cardId !== 'string' ||
      ids.has(slot.cardId) ||
      !Number.isInteger(slot.limit) ||
      slot.limit < 0 ||
      slot.limit > 4
    ) {
      throw new Error('保存された編成のカード・凸数が不正です。')
    }
    const card = cards.find((card) => card.id === slot.cardId)
    if (!card || !canEquip(card, deck.plan)) {
      throw new Error('保存された編成に使用できないカードがあります。')
    }
    ids.add(slot.cardId)
    deck.slots[index] = { cardId: slot.cardId, limit: slot.limit }
  }
  return deck
}

// 各カードの単体評価をそのまま加算する。共通日程の探索・相互作用の計算は行わない。
export function sumDeckScores(slots: readonly DeckSlot[], scores: Record<string, TotalScore>) {
  const byType = emptyTypeScores()
  let total = 0
  let pending = 0
  let incomplete = 0
  for (const slot of slots) {
    if (!slot) {
      continue
    }
    const score = scores[`${slot.cardId}:${slot.limit}`]
    if (!score) {
      pending++
      continue
    }
    total += score.total
    for (const type of scoreTypes) byType[type] += score.byType[type]
    if (!score.complete) {
      incomplete++
    }
  }
  return { total, byType, pending, incomplete }
}

// 基礎発生率を含めず、編成カードの補正値だけを加算する。全タイプ効果は各タイプへ加算。
export function sumDeckSpRates(slots: readonly DeckSlot[], cards: readonly SupportCard[]) {
  const result = emptyTypeScores()
  const byId = new Map(cards.map((card) => [card.id, card]))
  for (const slot of slots) {
    if (!slot) {
      continue
    }
    for (const effect of byId.get(slot.cardId)?.effects.support_ability ?? []) {
      if (effect.value_type !== 'sp_rate') {
        continue
      }
      const value = effect.values?.[slot.limit] ?? 0
      if (!Number.isFinite(value)) {
        continue
      }
      for (const type of scoreTargets(String(effect.type)))
        if (scoreTypes.includes(type)) {
          result[type] += value
        }
    }
  }
  for (const type of scoreTypes) result[type] = Math.round(result[type] * 100) / 100
  return result
}
