import preparedCards from 'virtual:support-card-data'
import type { SupportCard } from './cardSchema.ts'
export * from './cardSchema.ts'
export { parseCards } from './cardParsing.ts'

type CardSortKey = 'name' | 'rarity' | 'attachment'
export type SortDirection = 'ascending' | 'descending'

export function supportCardMaxLevel(rarity: SupportCard['rarity'], limit: number): number {
  const baseLevel = { SSR: 40, SR: 30, R: 20 }
  return baseLevel[rarity] + limit * 5
}

// 編成候補のレアリティ順。カード名は日本語の文字列比較。
const rarityOrder = ['SSR', 'SR', 'R'] as const
const nameCollator = new Intl.Collator('ja', { numeric: true })
export const cardAttachmentName = (card: SupportCard): string =>
  card.skill_card_name ?? card.produce_item_name ?? ''
export const hasSpRateCorrection = (card: SupportCard): boolean =>
  card.effects.support_ability.some((effect) => effect.value_type === 'sp_rate')

export function sortCards(
  cards: SupportCard[],
  key: CardSortKey,
  direction: SortDirection,
): SupportCard[] {
  const directionSign = direction === 'ascending' ? 1 : -1
  return [...cards].sort((a, b) => {
    if (key === 'attachment') {
      const left = cardAttachmentName(a),
        right = cardAttachmentName(b)
      // 名称がないカードは昇順・降順とも末尾に置く。
      if (Boolean(left) !== Boolean(right)) {
        return left ? -1 : 1
      }
      return (
        nameCollator.compare(left, right) * directionSign ||
        nameCollator.compare(a.name, b.name) ||
        a.id.localeCompare(b.id)
      )
    }
    const comparison =
      key === 'name'
        ? nameCollator.compare(a.name, b.name)
        : rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
    return (
      comparison * directionSign || nameCollator.compare(a.name, b.name) || a.id.localeCompare(b.id)
    )
  })
}

export function filterCards(cards: SupportCard[], query: string): SupportCard[] {
  const normalize = (text: string) =>
    text.normalize('NFKC').replace(/〜/gu, '~').trim().toLocaleLowerCase('ja')
  const keyword = normalize(query)
  return cards.filter((card) =>
    [card.name, card.skill_card_name, card.produce_item_name].some(
      (name) => typeof name === 'string' && normalize(name).includes(keyword),
    ),
  )
}

export function loadCards(): SupportCard[] {
  return [...preparedCards]
}
