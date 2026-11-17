import { emptyTypeScores, scoreTypes, type ScoreType, type TypeScores } from '../scoreMath.ts'
import { parameterBonusExamRewards } from '../scoringConfig.ts'

export type ExamNumber = (typeof parameterBonusExamRewards)[number]['examNumber']
export type ExamRatios = Partial<Record<ExamNumber, TypeScores>>
export function normalizeExamRatios(input?: ExamRatios): ExamRatios | undefined {
  const result: ExamRatios = {}
  for (const [key, row] of Object.entries(input ?? {})) {
    const exam = parameterBonusExamRewards.find((entry) => String(entry.examNumber) === key)
    if (!exam || !row || typeof row !== 'object') {
      throw new Error('選抜試験の配分比率が不正です。')
    }
    const ratio = emptyTypeScores()
    for (const type of scoreTypes) {
      const value = row[type]
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        throw new Error('試験の比率は0～100の整数で指定してください。')
      }
      ratio[type] = value
    }
    if (scoreTypes.some((type) => ratio[type] > 0)) {
      result[exam.examNumber] = ratio
    }
  }
  return Object.keys(result).length ? result : undefined
}

export interface ExamParameterBasis {
  total: number
  rows: {
    examNumber: ExamNumber
    day: number
    fixedPerType: number
    allocatable: number
    allocated: number
    ratio?: TypeScores
  }[]
}
// 比率は配分上昇値だけに適用する。固定分は維持し、中間値は丸めない。
export function examParameterBases(ratios?: ExamRatios): Record<ScoreType, ExamParameterBasis> {
  return Object.fromEntries(
    scoreTypes.map((type) => {
      const rows = parameterBonusExamRewards.map((entry) => {
        const ratio = ratios?.[entry.examNumber]
        const sum = ratio ? scoreTypes.reduce((sum, type) => sum + ratio[type], 0) : 0
        const allocated = ratio && sum ? (entry.allocatable * ratio[type]) / sum : entry.allocatable
        return { ...entry, allocated, ...(ratio && sum ? { ratio } : {}) }
      })
      return [
        type,
        { rows, total: rows.reduce((sum, entry) => sum + entry.fixedPerType + entry.allocated, 0) },
      ]
    }),
  ) as Record<ScoreType, ExamParameterBasis>
}
