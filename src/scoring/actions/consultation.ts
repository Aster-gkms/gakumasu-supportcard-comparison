import {
  consultationOperations,
  consultationRefreshMultiplier,
  type ConsultationOperations,
} from '../scoringConfig.ts'
import {
  skillAcquisitionActivations,
  type KeywordAcquisitions,
} from '../effects/skillAcquisitions.ts'

export function consultationActivations(
  refresh: boolean,
  activeEnhancements = 0,
  activeDeletions = 0,
  activeAcquisitions = 0,
  keywordAcquisitions: KeywordAcquisitions = {},
  operationCounts: ConsultationOperations = consultationOperations,
): Record<string, number> {
  const multiplier = refresh ? consultationRefreshMultiplier : 1
  const enhancements = operationCounts.skill_enhance * multiplier
  const deletions = operationCounts.skill_delete * multiplier
  const acquisitions = operationCounts.skill_acquire * multiplier
  if (
    !Number.isInteger(activeEnhancements) ||
    activeEnhancements < 0 ||
    activeEnhancements > enhancements ||
    !Number.isInteger(activeDeletions) ||
    activeDeletions < 0 ||
    activeDeletions > deletions ||
    !Number.isInteger(activeAcquisitions) ||
    activeAcquisitions < 0 ||
    activeAcquisitions > acquisitions
  ) {
    throw new Error('アクティブ対象の操作回数が操作機会の範囲外です。')
  }
  const operations = Object.fromEntries(
    Object.entries(operationCounts).map(([trigger, count]) => [trigger, count * multiplier]),
  )
  return {
    consultation: 1,
    ...operations,
    active_enhance: activeEnhancements,
    mental_enhance: enhancements - activeEnhancements,
    active_delete: activeDeletions,
    mental_delete: deletions - activeDeletions,
    ...skillAcquisitionActivations(acquisitions, activeAcquisitions, keywordAcquisitions),
    consultation_drink: operationCounts.p_drink_acquire * multiplier,
    consultation_skill_acquire: operationCounts.skill_acquire * multiplier,
  }
}
