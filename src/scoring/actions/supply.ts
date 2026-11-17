import {
  skillAcquisitionActivations,
  type KeywordAcquisitions,
} from '../effects/skillAcquisitions.ts'
import { supplyRewards } from '../scoringConfig.ts'

export function supplyActivations(
  activeAcquisitions = 0,
  keywordAcquisitions: KeywordAcquisitions = {},
): Record<string, number> {
  const acquired = skillAcquisitionActivations(
    supplyRewards.skillCards,
    activeAcquisitions,
    keywordAcquisitions,
  )
  return {
    activity_supply: 1,
    skill_acquire: supplyRewards.skillCards,
    p_drink_acquire: supplyRewards.pDrinks,
    ...acquired,
  }
}
