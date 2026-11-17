import { emptyTypeScores, sumTypeScores, scoreTypes } from './scoreMath.ts'
import type { SupportCard } from '../data/cards.ts'
import { calculateHifScheduleSubtotal } from './hifSchedule.ts'
import { calculateFixedAdditionSubtotal } from './effects/fixedAdditions.ts'
import { calculateParameterBonusSubtotal } from './effects/parameterBonus.ts'
import { evaluationPlans, ssrAcquisitionLimits } from './scoringConfig.ts'
import {
  normalizeConditions,
  hasSpConditions,
  parameterBasesForConditions,
  parameterLessonBases,
  type ScoringConditions,
} from './conditions/conditions.ts'
import { examParameterBases } from './conditions/examConditions.ts'

// 同じSSR上限では先頭プランを残し、同点時の採用プランも維持する。
const distinctSsrPlans = evaluationPlans.filter(
  (plan, index) =>
    evaluationPlans.findIndex(
      (candidate) => ssrAcquisitionLimits[candidate] === ssrAcquisitionLimits[plan],
    ) === index,
)

// 計算の入口。日程の最適化結果に初期値・イベント・パラボを一度だけ合算する。
export function calculateTotalScore(
  card: SupportCard,
  limit = 4,
  requestedConditions?: ScoringConditions,
) {
  const conditions = normalizeConditions(requestedConditions)
  const spConditions = hasSpConditions(conditions) ? conditions : undefined
  // 現行の日程でプランによる差があるのはSSR獲得上限だけ。
  // 差がないフリーカードは、従来も同点で選ばれた先頭プランを一度だけ評価する。
  const planDependent = card.effects.support_ability.some(
    (effect) => effect.trigger === 'skill_ssr_acquire' && effect.value_type === 'status_add',
  )
  const plans =
    card.plan === 'free' ? (planDependent ? distinctSsrPlans : [evaluationPlans[0]]) : [card.plan]
  const candidates = plans.map((plan) => {
    const schedule = calculateHifScheduleSubtotal(card, limit, plan, conditions)
    const parameter = calculateParameterBonusSubtotal(
      card,
      limit,
      parameterBasesForConditions(conditions, schedule.lessonCounts),
      spConditions && (spConditions.spLessonDays || conditions?.examRatios)
        ? parameterLessonBases(schedule.lessonCounts!, spConditions.spLessonDays)
        : undefined,
      conditions?.examRatios ? examParameterBases(conditions.examRatios) : undefined,
    )
    return { plan, schedule, parameter }
  })
  const best = candidates.reduce((best, candidate) =>
    candidate.schedule.total + candidate.parameter.total >
    best.schedule.total + best.parameter.total
      ? candidate
      : best,
  )
  const { schedule, plan, parameter } = best
  const fixed = calculateFixedAdditionSubtotal(card, limit)
  const byType = emptyTypeScores()
  for (const type of scoreTypes)
    byType[type] = fixed.byType[type] + parameter.byType[type] + schedule.byType[type]
  const pending =
    fixed.pendingEffects.length +
    parameter.pendingAbilityIndexes.length +
    schedule.pendingAbilityIndexes.length +
    schedule.pendingEventIndexes.length +
    schedule.pendingItemActions.length +
    schedule.pendingSkillGrants.length
  return {
    ...(conditions ? { conditions } : {}),
    ...(spConditions ? { lessonCounts: schedule.lessonCounts! } : {}),
    ...(conditions?.actionCounts ? { actionCounts: schedule.actionCounts! } : {}),
    cardId: card.id,
    evaluationMode: 'standalone' as const,
    limit,
    total: sumTypeScores(byType),
    byType,
    complete: pending === 0,
    pending,
    plan,
    fixed: fixed.breakdown,
    parameter: parameter.breakdown,
    abilities: schedule.breakdown,
    items: schedule.produceItemBreakdown,
    choices: schedule.choices,
    events: schedule.eventChoices,
    copies: schedule.itemCopyChoices,
    itemOperationCounts: schedule.itemOperationCounts,
    skillGrants: schedule.skillGrants,
    ssrAcquisition: schedule.ssrAcquisition,
  }
}
export type TotalScore = ReturnType<typeof calculateTotalScore>
