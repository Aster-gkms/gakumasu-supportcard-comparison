import { parse } from 'yaml'
import type { SupportCard } from '../data/cards.ts'
import type { Inventory } from '../inventory/inventory.ts'
import { canEquip, deckPlans, type Deck, type DeckPlan } from './deck.ts'

export const deckTemplateLabels = { vo_da: 'VoDa', da_vi: 'DaVi', vo_vi: 'VoVi' } as const
export type DeckTemplateKey = keyof typeof deckTemplateLabels
export const logicTemplateLabels = { good_impression: '好印象', motivation: 'やる気' } as const
export type LogicTemplateStyle = keyof typeof logicTemplateLabels
export type DeckTemplate = {
  plan: DeckPlan
  style: LogicTemplateStyle | null
  key: DeckTemplateKey
  label: string
  cards: { id: string; name: string }[]
}
type Card = Pick<SupportCard, 'id' | 'name' | 'plan'>

export function parseDeckTemplates(source: string, cards: readonly Card[]): DeckTemplate[] {
  const value: unknown = parse(source)
  const fail = (message: string): never => {
    throw new Error(`deck-templates.yaml：${message}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('育成プラン別にVoDa・DaVi・VoViの設定を記入してください。')
  }
  const plans = value as Record<string, unknown>
  if (Object.keys(plans).some((key) => !deckPlans.includes(key as DeckPlan))) {
    return fail('育成プランのキーは sense / logic / anomaly にしてください。')
  }
  return deckPlans.flatMap((plan) => {
    const groupValue = plans[plan]
    if (!groupValue || typeof groupValue !== 'object' || Array.isArray(groupValue)) {
      return fail(`${plan} の設定を記入してください。`)
    }
    const planGroups = groupValue as Record<string, unknown>
    const styles: (LogicTemplateStyle | null)[] =
      plan === 'logic' ? ['good_impression', 'motivation'] : [null]
    if (
      plan === 'logic' &&
      Object.keys(planGroups).some((key) => !Object.hasOwn(logicTemplateLabels, key))
    ) {
      return fail('logic のキーは good_impression / motivation にしてください。')
    }
    return styles.flatMap((style) => {
      const styleValue = style ? planGroups[style] : planGroups
      if (!styleValue || typeof styleValue !== 'object' || Array.isArray(styleValue)) {
        return fail(`${plan} / ${style} の設定を記入してください。`)
      }
      const groups = styleValue as Record<string, unknown>
      if (Object.keys(groups).some((key) => !Object.hasOwn(deckTemplateLabels, key))) {
        return fail('テンプレートのキーは vo_da / da_vi / vo_vi にしてください。')
      }
      return (Object.keys(deckTemplateLabels) as DeckTemplateKey[]).map((key) => {
        const label = `${plan}${style ? ` / ${logicTemplateLabels[style]}` : ''} / ${deckTemplateLabels[key]}`
        const group = groups[key]
        if (
          !group ||
          typeof group !== 'object' ||
          !('cards' in group) ||
          !Array.isArray(group.cards)
        ) {
          return fail(`${label} の cards にカード一覧を記入してください。`)
        }
        if (group.cards.length !== 0 && group.cards.length !== 6) {
          return fail(`${label} は6枚を指定してください（未設定は cards: []）。`)
        }
        const ids = new Set<string>()
        const entries = group.cards.map((entry: unknown, index: number) => {
          if (
            !entry ||
            typeof entry !== 'object' ||
            !('id' in entry) ||
            typeof entry.id !== 'string' ||
            !('name' in entry) ||
            typeof entry.name !== 'string'
          ) {
            return fail(`${label} の${index + 1}枚目は id と name の組にしてください。`)
          }
          const matches = cards.filter((card) => card.id === entry.id)
          if (matches.length !== 1) {
            return fail(`${label}：${entry.id} のIDを一意に照合できません。`)
          }
          if (matches[0]!.name !== entry.name) {
            return fail(
              `${label}：${entry.id} の名前が一致しません。正しい名前：${matches[0]!.name}`,
            )
          }
          if (ids.has(entry.id)) {
            return fail(`${label}：${entry.id} が重複しています。`)
          }
          ids.add(entry.id)
          return { id: entry.id, name: entry.name }
        })
        if (
          !entries.every((entry) =>
            canEquip(
              cards.find((card) => card.id === entry.id)!,
              plan,
            ),
          )
        ) {
          return fail(`${label}：この育成プランに編成できないカードが含まれています。`)
        }
        return { plan, style, key, label: deckTemplateLabels[key], cards: entries }
      })
    })
  })
}

// 全枠を一度に作り直す。元の編成・所持状況は変更しない。
export function deckFromTemplate(
  template: DeckTemplate,
  cards: readonly Card[],
  inventory: Inventory,
  currentPlan: DeckPlan,
): Deck {
  if (template.cards.length !== 6) {
    throw new Error('テンプレートには6枚のカードが必要です。')
  }
  if (template.plan !== currentPlan) {
    throw new Error('選択中の育成プランのテンプレートを指定してください。')
  }
  const ids = new Set<string>()
  const selected = template.cards.map((entry) => {
    const card = cards.find((card) => card.id === entry.id && card.name === entry.name)
    if (!card || ids.has(entry.id)) {
      throw new Error('テンプレートのカード指定が不正です。')
    }
    ids.add(entry.id)
    return card
  })
  if (!selected.every((card) => canEquip(card, currentPlan))) {
    throw new Error('選択中の育成プランに編成できないカードが含まれています。')
  }
  return {
    plan: currentPlan,
    slots: selected.map((card) => ({ cardId: card.id, limit: inventory[card.id] ?? 4 })),
  }
}
