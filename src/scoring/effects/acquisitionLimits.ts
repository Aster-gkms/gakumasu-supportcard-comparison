import { acquisitionKeywordTriggers } from './skillAcquisitions.ts'
import { conditionalAcquisitionLimit } from '../scoringConfig.ts'

const conditionalTriggers = new Set<string>([
  'active_acquire',
  'mental_acquire',
  'skill_ssr_acquire',
  ...Object.values(acquisitionKeywordTriggers),
])

// 汎用獲得・相談での購入・強化等は変更しない。固有上限が小さければそちらを優先。
export function acquisitionActivationLimit(trigger: string, ownLimit = Infinity): number {
  return conditionalTriggers.has(trigger)
    ? Math.min(ownLimit, conditionalAcquisitionLimit)
    : ownLimit
}
