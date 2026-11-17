import type { SupportCard, SupportEffect } from './cards.ts'

export const isAttachmentGrant = (effect: SupportEffect): boolean =>
  ['skill_card_grant', 'produce_item_grant', 'exam_item_grant'].includes(String(effect.value_type))

// 獲得行を除いた表示順と、計算で使う元の効果indexを共通管理する。
export function supportEventEntries(card: SupportCard | undefined) {
  return (card?.effects.support_event ?? [])
    .map((effect, index) => ({ effect, index }))
    .filter(({ effect }) => !isAttachmentGrant(effect))
}

// イベント・アビリティ共通。原文を重複保存せず、効果自身のテンプレートから表示する。

export function supportEffectText(
  effect: SupportEffect | undefined,
  limit: number,
): string | undefined {
  if (!effect?.template || !Number.isInteger(limit) || limit < 0 || limit > 4) {
    return undefined
  }
  if (!effect.template.includes('{value}')) {
    return effect.template
  }
  const value = effect.values?.[limit]
  return typeof value === 'number' && Number.isFinite(value)
    ? effect.template.replace('{value}', String(value))
    : undefined
}

export function supportEventText(
  card: SupportCard | undefined,
  index: number,
  limit: number,
): string | undefined {
  return supportEffectText(card?.effects.support_event[index], limit)
}

// 効果自身のtemplateへ、同じ効果の凸別値を差し込む。
export function supportAbilityText(
  card: SupportCard | undefined,
  index: number,
  limit: number,
): string | undefined {
  return supportEffectText(card?.effects.support_ability[index], limit)
}
