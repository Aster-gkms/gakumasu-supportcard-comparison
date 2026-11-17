import { emptyTypeScores, scoreTargets, sumTypeScores, validateLimit } from '../scoreMath.ts'
import type { SupportCard } from '../../data/cards.ts'
import type { ScoreType } from '../scoreMath.ts'

type FixedCategory = 'support_event' | 'support_ability'
export interface FixedAdditionSubtotal {
  total: number
  byType: Record<ScoreType, number>
  breakdown: {
    category: FixedCategory
    effectIndex: number
    value: number
    appliedValue: number
    bonusPercent: number
    bonusAbilityIndex?: number
    count: number
    total: number
  }[]
  pendingEffects: { category: FixedCategory; effectIndex: number }[]
}

export function calculateFixedAdditionSubtotal(
  card: SupportCard,
  limit: number,
): FixedAdditionSubtotal {
  validateLimit(limit)
  const byType = emptyTypeScores()
  const breakdown: FixedAdditionSubtotal['breakdown'] = []
  const pendingEffects: FixedAdditionSubtotal['pendingEffects'] = []
  const boosts = card.effects.support_ability.flatMap((effect, effectIndex) =>
    effect.value_type === 'event_param_boost' ? [{ effect, effectIndex }] : [],
  )
  let eventBoost: number | null = 0
  for (const { effect, effectIndex } of boosts) {
    const value = Array.isArray(effect.values) ? effect.values[limit] : undefined
    if (
      boosts.length !== 1 ||
      effect.trigger !== 'equip' ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      eventBoost = null
      pendingEffects.push({ category: 'support_ability', effectIndex })
    } else {
      eventBoost = value
    }
  }
  for (const category of ['support_event', 'support_ability'] as const) {
    card.effects[category].forEach((effect, effectIndex) => {
      if (effect.value_type !== 'status_add') {
        return
      }
      if (category === 'support_ability' && effect.trigger !== 'produce_start') {
        return
      }
      const value = Array.isArray(effect.values) ? effect.values[limit] : undefined
      if (
        (category === 'support_event' && eventBoost === null) ||
        !['vo', 'da', 'vi', 'all'].includes(String(effect.type)) ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        pendingEffects.push({ category, effectIndex })
        return
      }
      const targets = scoreTargets(String(effect.type))
      const bonusPercent = category === 'support_event' ? eventBoost! : 0
      const appliedValue =
        category === 'support_event' ? Math.floor((value * (100 + bonusPercent)) / 100) : value
      for (const target of targets) byType[target] += appliedValue
      breakdown.push({
        category,
        effectIndex,
        value,
        appliedValue,
        bonusPercent,
        ...(category === 'support_event' && boosts.length === 1
          ? { bonusAbilityIndex: boosts[0]!.effectIndex }
          : {}),
        count: 1,
        total: appliedValue * targets.length,
      })
    })
  }
  return {
    total: sumTypeScores(byType),
    byType,
    breakdown,
    pendingEffects,
  }
}
