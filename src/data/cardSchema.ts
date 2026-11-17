export const typeLabels = { vo: 'Vo', da: 'Da', vi: 'Vi', as: 'AS' } as const
export const planLabels = {
  sense: 'センス',
  logic: 'ロジック',
  anomaly: 'アノマリー',
  free: 'フリー',
} as const
export const tagLabels = {
  skill: 'スキルカード',
  produce_item: 'プロデュースアイテム',
  exam_item: '試験・コンテスト用アイテム',
  none: 'なし',
} as const

export interface ProduceItemDetail {
  // 効果はeffects.produce_itemから表示・計算し、ここにはレアリティ等の補足だけを持つ。
  description: string
}

export interface AttachmentDetail extends ProduceItemDetail {
  text?: string
  variants?: { label: string; cost: string; text: string }[]
  custom_cap?: number
  customization?: { name: string; stages: { stage: number; cost: number; text: string }[] }[]
  source_data: Record<string, unknown>
}

export interface SupportCard {
  id: string
  name: string
  rarity: 'SSR' | 'SR' | 'R'
  type: keyof typeof typeLabels
  plan: keyof typeof planLabels
  tag: 'skill' | 'produce_item' | 'exam_item' | 'none'
  produce_item_name?: string
  skill_card_name?: string
  produce_item_detail?: ProduceItemDetail
  skill_card_detail?: AttachmentDetail
  effects: {
    support_event: SupportEffect[]
    support_ability: SupportAbility[]
    produce_item?: ProduceItemEffect[]
  }
}

// 一つの効果に表示テンプレートと計算定義をまとめる。
export interface SupportEffect extends Record<string, unknown> {
  template?: string
  values?: number[]
  unit?: '%'
}
export type SupportAbility = SupportEffect

export type EffectCategory = keyof SupportCard['effects']

export interface ProduceItemPart extends Record<string, unknown> {
  kind: string
}

export interface ProduceItemEffect extends Record<string, unknown> {
  name: string
  trigger: ProduceItemPart
  restriction?: ProduceItemPart
  condition?: ProduceItemPart
  max_count?: number
  count_scope?: 'per_produce' | 'per_lesson'
  actions: ProduceItemPart[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSupportCard(value: unknown): value is SupportCard {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    ['SSR', 'SR', 'R'].includes(String(value.rarity)) &&
    Object.hasOwn(typeLabels, String(value.type)) &&
    Object.hasOwn(planLabels, String(value.plan)) &&
    ['skill', 'produce_item', 'exam_item', 'none'].includes(String(value.tag)) &&
    (value.produce_item_name === undefined ||
      (typeof value.produce_item_name === 'string' && value.produce_item_name.trim().length > 0)) &&
    (value.skill_card_name === undefined ||
      (typeof value.skill_card_name === 'string' && value.skill_card_name.trim().length > 0)) &&
    (value.produce_item_detail === undefined ||
      (isRecord(value.produce_item_detail) &&
        typeof value.produce_item_detail.description === 'string' &&
        Object.keys(value.produce_item_detail).every((key) => key === 'description'))) &&
    (value.skill_card_detail === undefined || isAttachmentDetail(value.skill_card_detail)) &&
    value.support_ability_details === undefined &&
    value.support_ability_descriptions === undefined &&
    isRecord(value.effects) &&
    Object.keys(value.effects).every((key) =>
      ['support_event', 'support_ability', 'produce_item'].includes(key),
    ) &&
    Array.isArray(value.effects.support_event) &&
    value.effects.support_event.every(isSupportEvent) &&
    Array.isArray(value.effects.support_ability) &&
    value.effects.support_ability.every(isSupportAbility) &&
    (value.effects.produce_item === undefined ||
      (Array.isArray(value.effects.produce_item) &&
        value.effects.produce_item.every(isProduceItemEffect)))
  )
}

function isSupportAbility(value: unknown): value is SupportAbility {
  return (
    isSupportEffect(value) &&
    (value.template === undefined || value.template.split('{value}').length === 2)
  )
}

function isSupportEvent(value: unknown): value is SupportEffect {
  return (
    isSupportEffect(value) &&
    (value.template === undefined || value.template.split('{value}').length <= 2)
  )
}

function isSupportEffect(value: unknown): value is SupportEffect {
  return (
    isRecord(value) &&
    (value.template === undefined ||
      (typeof value.template === 'string' && value.template.trim().length > 0)) &&
    (value.values === undefined ||
      (Array.isArray(value.values) &&
        value.values.length === 5 &&
        value.values.every((item) => typeof item === 'number' && Number.isFinite(item)))) &&
    (value.unit === undefined || value.unit === '%') &&
    value.original_text === undefined
  )
}

function isProduceItemEffect(value: unknown): value is ProduceItemEffect {
  const part = (value: unknown) =>
    isRecord(value) && typeof value.kind === 'string' && value.kind.length > 0
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    part(value.trigger) &&
    (value.condition === undefined || part(value.condition)) &&
    (value.restriction === undefined || part(value.restriction)) &&
    (value.max_count === undefined
      ? value.count_scope === undefined
      : Number.isInteger(value.max_count) &&
        Number(value.max_count) > 0 &&
        ['per_produce', 'per_lesson'].includes(String(value.count_scope))) &&
    Array.isArray(value.actions) &&
    value.actions.length > 0 &&
    value.actions.every(part)
  )
}

function isAttachmentDetail(value: unknown): value is AttachmentDetail {
  return (
    isRecord(value) &&
    typeof value.description === 'string' &&
    isRecord(value.source_data) &&
    (value.text === undefined || typeof value.text === 'string') &&
    (value.variants === undefined ||
      (Array.isArray(value.variants) &&
        value.variants.every(
          (variant) =>
            isRecord(variant) &&
            ['label', 'cost', 'text'].every((key) => typeof variant[key] === 'string'),
        ))) &&
    (value.custom_cap === undefined ||
      (typeof value.custom_cap === 'number' && Number.isFinite(value.custom_cap))) &&
    (value.customization === undefined ||
      (Array.isArray(value.customization) &&
        value.customization.every(
          (slot) =>
            isRecord(slot) &&
            typeof slot.name === 'string' &&
            Array.isArray(slot.stages) &&
            slot.stages.every(
              (stage) =>
                isRecord(stage) &&
                typeof stage.stage === 'number' &&
                typeof stage.cost === 'number' &&
                typeof stage.text === 'string',
            ),
        )))
  )
}

export function validateCardSources(sources: Iterable<unknown>): SupportCard[] {
  const cards: SupportCard[] = []
  const ids = new Set<string>()
  for (const data of sources) {
    if (!isRecord(data) || !Array.isArray(data.support_cards)) {
      throw new Error('カード一覧の形式が正しくありません。')
    }
    for (const card of data.support_cards) {
      if (!isSupportCard(card)) {
        throw new Error('カードの基本情報が正しくありません。')
      }
      if (ids.has(card.id)) {
        throw new Error(`カードIDが重複しています: ${card.id}`)
      }
      ids.add(card.id)
      cards.push(card)
    }
  }
  return cards
}
