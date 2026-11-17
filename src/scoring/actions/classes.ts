import {
  skillAcquisitionActivations,
  type KeywordAcquisitions,
} from '../effects/skillAcquisitions.ts'
import { classDays, classAcquisitionDays, classRewards } from '../scoringConfig.ts'
export type ClassReward = 'acquire' | 'change' | 'change_with_sleepiness'

export function getClassRewards(day: number): ClassReward[] {
  if (!(classDays as readonly number[]).includes(day)) {
    throw new Error('授業日ではありません。')
  }
  return classAcquisitionDays.includes(day)
    ? ['acquire', 'change_with_sleepiness']
    : ['change', 'change_with_sleepiness']
}

export function classActivations(
  reward: ClassReward,
  activeAcquisitions = 0,
  keywordAcquisitions: KeywordAcquisitions = {},
): Record<string, number> {
  const capacity = reward === 'acquire' ? classRewards.skillCards : 0
  const acquired = skillAcquisitionActivations(capacity, activeAcquisitions, keywordAcquisitions)
  switch (reward) {
    case 'acquire':
      return {
        class_end: 1,
        skill_acquire: classRewards.skillCards,
        ...acquired,
      }
    case 'change':
      return { class_end: 1, skill_change: classRewards.changes }
    case 'change_with_sleepiness':
      return {
        class_end: 1,
        skill_change: classRewards.changes,
        skill_acquire: classRewards.sleepinessCards,
      }
    default:
      throw new Error('授業の報酬が不正です。')
  }
}
