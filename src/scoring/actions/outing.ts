import {
  skillAcquisitionActivations,
  type KeywordAcquisitions,
} from '../effects/skillAcquisitions.ts'
import { outingRewards } from '../scoringConfig.ts'

export function outingActivations(
  withSleepiness = true,
  activeAcquisitions = 0,
  keywordAcquisitions: KeywordAcquisitions = {},
): Record<string, number> {
  const acquired = skillAcquisitionActivations(
    outingRewards.regularSkillCards,
    activeAcquisitions,
    keywordAcquisitions,
  )
  return {
    outing_end: 1,
    skill_acquire:
      outingRewards.regularSkillCards + (withSleepiness ? outingRewards.sleepinessCards : 0),
    p_drink_acquire: outingRewards.pDrinks,
    ...acquired,
  }
}
