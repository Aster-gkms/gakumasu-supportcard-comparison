import type { SupportCard } from '../../data/cards.ts'

export type EvaluationPlan = Exclude<SupportCard['plan'], 'free'>
import { ssrAcquisitionLimits } from '../scoringConfig.ts'

export function getSsrAcquisitionContext(card: SupportCard, requestedPlan?: EvaluationPlan) {
  const plan = requestedPlan ?? (card.plan === 'free' ? 'logic' : card.plan)
  if (!Object.hasOwn(ssrAcquisitionLimits, plan) || (card.plan !== 'free' && card.plan !== plan)) {
    throw new Error('カードに対応する育成タイプを指定してください。')
  }
  return { plan, acquisitionCount: ssrAcquisitionLimits[plan] }
}
