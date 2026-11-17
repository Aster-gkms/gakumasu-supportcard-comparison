import { emptyTypeScores, scoreTargets, sumTypeScores, validateLimit } from '../scoreMath.ts'
import type { SupportCard } from '../../data/cards.ts'
import type { ScoreType, TypeScores } from '../scoreMath.ts'

import { parameterBonusBase, parameterBonusExamBase } from '../scoringConfig.ts'
import { averageSpLessonGain, type SpLessonParameterBasis } from '../conditions/conditions.ts'
import type { ExamParameterBasis } from '../conditions/examConditions.ts'
export interface ParameterBonusSubtotal {
  total: number
  byType: Record<ScoreType, number>
  breakdown: {
    abilityIndex: number
    base: number
    percent: number
    rawValue: number
    appliedValue: number
    total: number
    spLessons?: number
    lessonBasis?: SpLessonParameterBasis
    examBasis?: ExamParameterBasis
  }[]
  pendingAbilityIndexes: number[]
}

// 未指定時は1500。回数指定は平均100、日別指定は固定日の実値と残り日の平均を受け取る。
// 行動ごとではなく、基準値全体へ率を掛けた後に切り捨てる。
export function calculateParameterBonusSubtotal(
  card: SupportCard,
  limit: number,
  basesByType?: TypeScores,
  lessonBases?: Partial<Record<ScoreType, SpLessonParameterBasis>>,
  examBases?: Partial<Record<ScoreType, ExamParameterBasis>>,
): ParameterBonusSubtotal {
  validateLimit(limit)
  const byType = emptyTypeScores()
  const breakdown: ParameterBonusSubtotal['breakdown'] = []
  const pendingAbilityIndexes: number[] = []
  card.effects.support_ability.forEach((effect, abilityIndex) => {
    if (effect.value_type !== 'param_bonus') {
      return
    }
    const percent = Array.isArray(effect.values) ? effect.values[limit] : undefined
    if (
      effect.trigger !== 'equip' ||
      !['vo', 'da', 'vi', 'all'].includes(String(effect.type)) ||
      typeof percent !== 'number' ||
      !Number.isFinite(percent) ||
      percent < 0
    ) {
      pendingAbilityIndexes.push(abilityIndex)
      return
    }
    const targets = scoreTargets(String(effect.type))
    const groups = new Map<
      string,
      {
        base: number
        targets: ScoreType[]
        basis?: SpLessonParameterBasis
        examBasis?: ExamParameterBasis
      }
    >()
    for (const target of targets) {
      const base = basesByType?.[target] ?? parameterBonusBase
      const basis = lessonBases?.[target]
      const examBasis = examBases?.[target]
      const key = JSON.stringify([base, basis, examBasis])
      const group = groups.get(key) ?? { base, targets: [], basis, examBasis }
      group.targets.push(target)
      groups.set(key, group)
    }
    for (const { base, targets: group, basis, examBasis } of groups.values()) {
      const rawValue = percent * (base / 100)
      // 比率の循環小数で整数境界の直下へずれる浮動小数誤差だけを補正する。
      const nearestInteger = Math.round(rawValue)
      const stableValue =
        Math.abs(rawValue - nearestInteger) <= Number.EPSILON * Math.max(1, Math.abs(rawValue)) * 8
          ? nearestInteger
          : rawValue
      const appliedValue = Math.floor(stableValue)
      for (const target of group) byType[target] += appliedValue
      breakdown.push({
        abilityIndex,
        base,
        percent,
        rawValue,
        appliedValue,
        total: appliedValue * group.length,
        ...(basesByType && (basis || !examBasis)
          ? {
              spLessons: basis
                ? basis.fixed.length + basis.automaticCount
                : (base - parameterBonusExamBase) / averageSpLessonGain,
            }
          : {}),
        ...(basis ? { lessonBasis: basis } : {}),
        ...(examBasis ? { examBasis } : {}),
      })
    }
  })
  return {
    total: sumTypeScores(byType),
    byType,
    breakdown,
    pendingAbilityIndexes,
  }
}
