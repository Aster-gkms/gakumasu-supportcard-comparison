import type { SupportAbility, SupportCard } from './cardSchema.ts'
import { effectValueLabels, triggerLabels } from './effectLabels.ts'
import { parse } from 'yaml'

export const abilityCategories = [
  { key: 'all', label: 'すべて' },
  { key: 'status', label: 'ステータス' },
  { key: 'bonus', label: 'SP・パラボ' },
  { key: 'hp', label: '体力' },
  { key: 'point', label: 'Pポイント' },
  { key: 'event', label: 'イベント補正' },
  { key: 'other', label: 'その他' },
]

export interface AbilityOption {
  key: string
  label: string
  condition: string
  category: string
  count: number
}

// Vo/Da/Viと数値の違いはまとめ、追加条件の違いは別の選択肢にする。
const timing = (effect: SupportAbility) => String(effect.trigger).replace(/^(vo|da|vi)_/, '')
export const abilityFilterKey = (effect: SupportAbility): string =>
  JSON.stringify([timing(effect), effect.value_type, effect.condition ?? ''])

function categoryFor(value: string): string {
  if (value.startsWith('event_') || value === 'support_rate_bonus') {
    return 'event'
  }
  if (value === 'status_add') {
    return 'status'
  }
  if (['sp_rate', 'param_bonus'].includes(value)) {
    return 'bonus'
  }
  if (['hp_recovery', 'max_hp_add'].includes(value)) {
    return 'hp'
  }
  if (['point_add', 'point_gain_boost', 'p_drink_discount'].includes(value)) {
    return 'point'
  }
  return 'other'
}

function conditionLabel(condition: unknown): string {
  const text = String(condition ?? '')
  const deckPrefix = 'デッキ>='
  if (text.startsWith(deckPrefix)) {
    return `スキルカードを${text.slice(deckPrefix.length)}枚以上所持`
  }
  if (text === 'チェンジ対象が基本スキルカード') {
    return '名前に「基本」を含むスキルカードが対象'
  }
  return text.replace(/>=(\d+)$/u, 'を$1枚以上所持').replace('所持している', '')
}

function manualOrder(
  source: string,
  options: ReadonlyMap<string, AbilityOption>,
): Map<string, number> {
  const fail = (message: string): never => {
    throw new Error(`ability-order.yaml：${message}`)
  }
  const value: unknown = parse(source)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('カテゴリごとに項目の配列を記入してください。')
  }
  const ranks = new Map<string, number>()
  for (const [category, entries] of Object.entries(value)) {
    if (!abilityCategories.some((item) => item.key === category && item.key !== 'all')) {
      return fail(`不明なカテゴリです：${category}`)
    }
    if (!Array.isArray(entries)) {
      return fail(`${category} は配列にしてください。`)
    }
    for (const [index, entry] of entries.entries()) {
      const location = `${category} の${index + 1}件目`
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        Object.keys(entry).some((key) => !['trigger', 'value_type', 'condition'].includes(key)) ||
        typeof entry.trigger !== 'string' ||
        !entry.trigger.trim() ||
        typeof entry.value_type !== 'string' ||
        !entry.value_type.trim() ||
        (entry.condition !== undefined && typeof entry.condition !== 'string')
      ) {
        return fail(
          `${location} は trigger・value_type と、必要なら condition を指定してください。`,
        )
      }
      const key = abilityFilterKey(entry as SupportAbility)
      if (ranks.has(key)) {
        return fail(`${location} が重複しています：${key}`)
      }
      const option = options.get(key)
      if (!option) {
        return fail(`${location} に一致するアビリティがありません：${key}`)
      }
      if (option.category !== category) {
        return fail(`${location} のカテゴリは ${option.category} です：${key}`)
      }
      ranks.set(key, index)
    }
  }
  return ranks
}

export function buildAbilityOptions(
  cards: readonly SupportCard[],
  orderSource?: string,
): AbilityOption[] {
  const options = new Map<string, AbilityOption>()
  for (const card of cards) {
    const seen = new Set<string>()
    for (const effect of card.effects.support_ability) {
      const key = abilityFilterKey(effect)
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      const existing = options.get(key)
      if (existing) {
        existing.count++
        continue
      }
      const value = String(effect.value_type)
      const trigger = timing(effect)
      const valueLabel = value === 'status_add' ? 'ステータス上昇' : effectValueLabels[value]
      const triggerLabel =
        trigger === 'normal_end'
          ? '通常レッスン終了時'
          : trigger === 'support_event'
            ? 'サポートイベント発生時'
            : triggerLabels[trigger]
      const label =
        valueLabel && triggerLabel
          ? `${trigger === 'equip' ? '' : `${triggerLabel}：`}${valueLabel}`
          : (effect.template ?? `${trigger}：${value}`).replace('{value}', '○')
      options.set(key, {
        key,
        label,
        condition: conditionLabel(effect.condition),
        category: categoryFor(value),
        count: 1,
      })
    }
  }
  const ranks =
    orderSource === undefined ? new Map<string, number>() : manualOrder(orderSource, options)
  return [...options.values()].sort(
    (a, b) =>
      abilityCategories.findIndex((c) => c.key === a.category) -
        abilityCategories.findIndex((c) => c.key === b.category) ||
      (ranks.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
        (ranks.get(b.key) ?? Number.MAX_SAFE_INTEGER) ||
      a.label.localeCompare(b.label, 'ja') ||
      a.condition.localeCompare(b.condition, 'ja'),
  )
}

export function matchesAbilities(
  card: SupportCard,
  selected: readonly string[] = [],
  mode: 'any' | 'all' = 'any',
): boolean {
  if (!selected.length) {
    return true
  }
  const keys = new Set(card.effects.support_ability.map(abilityFilterKey))
  return mode === 'all'
    ? selected.every((key) => keys.has(key))
    : selected.some((key) => keys.has(key))
}
