import {
  filterCards,
  hasSpRateCorrection,
  planLabels,
  tagLabels,
  typeLabels,
  type SupportCard,
} from './cards'
import type { Inventory } from '../inventory/inventory'

const labeledOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([key, label]) => ({ key, label }))

// 画面ごとの選択状態は各画面で持ち、選択肢と判定だけを共有する。
export const cardFilterOptions = {
  rarity: ['SSR', 'SR', 'R'].map((key) => ({ key, label: key })),
  type: labeledOptions(typeLabels),
  plan: labeledOptions(planLabels),
  tag: labeledOptions(tagLabels).filter(({ key }) => key !== 'none'),
  spRate: [
    { key: 'has', label: 'あり' },
    { key: 'none', label: 'なし' },
  ],
  ownership: [
    { key: 'owned', label: '所持のみ' },
    { key: 'unowned', label: '未所持のみ' },
  ],
  creator: [{ key: 'selected', label: 'セレクトのみ' }],
  limits: [0, 1, 2, 3, 4].map((value) => ({ key: String(value), label: `${value}凸` })),
}

export type CardFilterKey = 'rarity' | 'type' | 'plan' | 'tag'
type CardListFilters = Partial<
  Record<CardFilterKey | 'ownership' | 'spRate' | 'limits', readonly string[]>
> & {
  creatorOnly?: boolean
}
const includes = (selected: readonly string[] | undefined, value: string) =>
  !selected?.length || selected.includes(value)

export function filterCardList(
  cards: SupportCard[],
  query: string,
  filters: CardListFilters,
  inventory: Inventory,
  creatorIds: ReadonlySet<string>,
): SupportCard[] {
  return filterCards(cards, query).filter((card) => {
    const limit = inventory[card.id]
    return (
      includes(filters.rarity, card.rarity) &&
      includes(filters.type, card.type) &&
      includes(filters.plan, card.plan) &&
      includes(filters.tag, card.tag) &&
      includes(filters.ownership, limit === undefined ? 'unowned' : 'owned') &&
      includes(filters.limits, limit === undefined ? 'unowned' : String(limit)) &&
      (!filters.creatorOnly || creatorIds.has(card.id)) &&
      (!filters.spRate?.length ||
        includes(filters.spRate, hasSpRateCorrection(card) ? 'has' : 'none'))
    )
  })
}
