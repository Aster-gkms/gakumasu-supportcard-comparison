import type { SupportCard } from '../../data/cards.ts'
import { acquisitionKeywordTriggers, type AcquisitionKeyword } from './skillAcquisitions.ts'

export interface SkillGrant {
  cardId: string
  name: string
  enhanced: boolean
  rarity: string
  type: string
  keywords: AcquisitionKeyword[]
  uncertainKeywords: string[]
  firing: Record<string, number>
}

export function getSkillGrant(card: SupportCard, enhanced = true): SkillGrant | undefined {
  if (card.tag !== 'skill') {
    return undefined
  }
  const source = card.skill_card_detail?.source_data
  if (
    !source ||
    !['active', 'mental'].includes(String(source.type)) ||
    !['sr', 'ssr', 'r'].includes(String(source.rarity))
  ) {
    return undefined
  }
  const effects = Array.isArray(source.effects) ? (source.effects as Record<string, unknown>[]) : []
  const variant =
    effects.find((effect) => effect.level === (enhanced ? 'plus' : 'base')) ??
    effects.find((effect) => effect.level === 'base')
  const keywords = new Set<AcquisitionKeyword>()
  const uncertain = new Set<string>()
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') {
      return
    }
    const object = value as Record<string, unknown>
    const action = object.action as Record<string, unknown> | undefined
    if (action) {
      const key = String(action.key)
      if (key === 'good_condition_turns') {
        keywords.add('good_condition')
      }
      if (
        ['keyword_up', 'fixed_keyword_up', 'change_policy', 'change_policy_stage'].includes(key)
      ) {
        if (Object.hasOwn(acquisitionKeywordTriggers, String(action.keyword))) {
          keywords.add(action.keyword as AcquisitionKeyword)
        } else if (action.keyword === 'full_power_value') {
          keywords.add('full_power')
        }
      } else if (
        [
          'keyword_pct_param_up',
          'param_up_keyword_multiply',
          'param_up_cumulative_keyword_pct_boost',
          'keyword_enhance_boost',
        ].includes(key)
      ) {
        const keyword = action.keyword === 'full_power_value' ? 'full_power' : action.keyword
        if (Object.hasOwn(acquisitionKeywordTriggers, String(keyword))) {
          keywords.add(keyword as AcquisitionKeyword)
        }
      } else if (
        action.keyword &&
        Object.hasOwn(acquisitionKeywordTriggers, String(action.keyword))
      ) {
        uncertain.add(String(action.keyword))
      }
    }
    for (const child of Object.values(object)) visit(child)
  }
  visit(variant?.effect)
  for (const keyword of keywords) uncertain.delete(keyword)
  const firing: Record<string, number> = { skill_acquire: 1, [`${source.type}_acquire`]: 1 }
  if (source.rarity !== 'ssr') {
    firing.ssr_ineligible_acquire = 1
  }
  for (const keyword of keywords) firing[acquisitionKeywordTriggers[keyword]] = 1
  return {
    cardId: card.id,
    name: card.skill_card_name ?? String(source.name),
    enhanced,
    rarity: String(source.rarity),
    type: String(source.type),
    keywords: [...keywords],
    uncertainKeywords: [...uncertain],
    firing,
  }
}
