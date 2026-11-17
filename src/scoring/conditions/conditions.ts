import { emptyTypeScores, scoreTypes, type ScoreType, type TypeScores } from '../scoreMath.ts'
import {
  parameterBonusExamBase,
  parameterBonusLessonRewards,
  publicLessonDays,
  parameterBonusBase,
} from '../scoringConfig.ts'
import { normalizeExamRatios, examParameterBases, type ExamRatios } from './examConditions.ts'
import { normalizeOperationSettings, type OperationSettings } from './operationSettings.ts'
import {
  configurableActions,
  actionCountLabels,
  actionCountLimit,
  actionScheduleMatcher,
  type ActionCounts,
} from './actionConditions.ts'

export interface ScoringConditions {
  spLessons: TypeScores
  spLessonDays?: SpLessonDays
  actionCounts?: ActionCounts
  examRatios?: ExamRatios
  operationSettings?: OperationSettings
}
export function hasSpConditions(conditions?: ScoringConditions): boolean {
  return (
    !!conditions &&
    (scoreTypes.some((type) => conditions.spLessons[type] > 0) ||
      Object.keys(conditions.spLessonDays ?? {}).length > 0)
  )
}
export type SpLessonDays = Partial<Record<number, ScoreType>>
export const spLessonDays = publicLessonDays
export function spLessonDayLabel(day: number): string {
  return day <= 20 ? `選抜${day}日目` : `本戦${day - 20}日目`
}
export function requiredSpLessons(counts: TypeScores, days: SpLessonDays = {}): TypeScores {
  const fixed = emptyTypeScores()
  for (const type of Object.values(days))
    if (type) {
      fixed[type]++
    }
  return Object.fromEntries(
    scoreTypes.map((type) => [type, Math.max(counts[type], fixed[type])]),
  ) as TypeScores
}
export const lessonCountLimit = publicLessonDays.length
export const averageSpLessonGain =
  parameterBonusLessonRewards.reduce((sum, entry) => sum + entry.sp, 0) / lessonCountLimit

// 指定回数を確保し、残りは同じタイプも含めてカードごとに最適化する。
export function normalizeConditions(conditions?: ScoringConditions): ScoringConditions | undefined {
  if (!conditions) {
    return undefined
  }
  const counts = emptyTypeScores()
  for (const type of scoreTypes) {
    const count = conditions.spLessons?.[type]
    if (!Number.isInteger(count) || count < 0 || count > lessonCountLimit) {
      throw new Error('SPレッスン回数は0～8の整数で指定してください。')
    }
    counts[type] = count
  }
  const total = scoreTypes.reduce((sum, type) => sum + counts[type], 0)
  if (total > lessonCountLimit) {
    throw new Error('SPレッスンの指定回数は合計8回以内にしてください。')
  }
  const days: SpLessonDays = {}
  for (const [key, type] of Object.entries(conditions.spLessonDays ?? {})) {
    const day = Number(key)
    if (
      !publicLessonDays.some((candidate) => candidate === day) ||
      String(day) !== key ||
      !scoreTypes.includes(type as ScoreType)
    ) {
      throw new Error('SPレッスンの日別指定が不正です。')
    }
    days[day] = type as ScoreType
  }
  const required = requiredSpLessons(counts, days)
  if (scoreTypes.reduce((sum, type) => sum + required[type], 0) > lessonCountLimit) {
    throw new Error('日別指定とSPレッスン回数を同時に満たせません。')
  }
  const forceSp = total > 0 || Object.keys(days).length > 0
  const actions: ActionCounts = {}
  for (const [key, count] of Object.entries(conditions.actionCounts ?? {})) {
    if (!configurableActions.includes(key as (typeof configurableActions)[number])) {
      throw new Error('行動回数の指定が不正です。')
    }
    const action = key as (typeof configurableActions)[number]
    if (!Number.isInteger(count) || count < 0 || count > actionCountLimit(action, forceSp)) {
      throw new Error(`${actionCountLabels[action]}の回数が指定可能な範囲外です。`)
    }
    actions[action] = count
  }
  if (Object.keys(actions).length && !actionScheduleMatcher(actions, forceSp)(1, false, {})) {
    throw new Error('この行動回数は同日の排他・休める日の条件を同時に満たせません。')
  }
  const examRatios = normalizeExamRatios(conditions.examRatios)
  const operationSettings = normalizeOperationSettings(conditions.operationSettings)
  return forceSp || Object.keys(actions).length || examRatios || operationSettings
    ? {
        spLessons: counts,
        ...(Object.keys(days).length ? { spLessonDays: days } : {}),
        ...(Object.keys(actions).length ? { actionCounts: actions } : {}),
        ...(examRatios ? { examRatios } : {}),
        ...(operationSettings ? { operationSettings } : {}),
      }
    : undefined
}

export function conditionsKey(conditions?: ScoringConditions): string {
  const normalized = normalizeConditions(conditions)
  return normalized
    ? `sp:${scoreTypes.map((type) => normalized.spLessons[type]).join(',')}${
        normalized.spLessonDays
          ? `:days:${publicLessonDays
              .filter((day) => normalized.spLessonDays![day])
              .map((day) => `${day}=${normalized.spLessonDays![day]}`)
              .join(',')}`
          : ''
      }${normalized.actionCounts ? `:actions:${configurableActions.map((key) => normalized.actionCounts![key] ?? 'auto').join(',')}` : ''}${normalized.examRatios ? `:exams:${JSON.stringify(normalized.examRatios)}` : ''}${normalized.operationSettings ? `:operations:${JSON.stringify(normalized.operationSettings)}` : ''}`
    : 'ideal'
}

export interface SpLessonParameterBasis {
  fixed: { day: number; gain: number }[]
  automaticCount: number
  remainingCount: number
  remainingTotal: number
  average: number
  automaticGain: number
  gain: number
}
export function parameterLessonBases(
  counts: TypeScores,
  days: SpLessonDays = {},
): Record<ScoreType, SpLessonParameterBasis> {
  const remaining = parameterBonusLessonRewards.filter((entry) => !days[entry.day])
  const remainingTotal = remaining.reduce((sum, entry) => sum + entry.sp, 0)
  const average = remaining.length ? remainingTotal / remaining.length : 0
  return Object.fromEntries(
    scoreTypes.map((type) => {
      const fixed = parameterBonusLessonRewards
        .filter((entry) => days[entry.day] === type)
        .map((entry) => ({ day: entry.day, gain: entry.sp }))
      const automaticCount = counts[type] - fixed.length
      // 平均を丸めず、元の合計×回数÷残り枠数で計算する。
      const automaticGain = remaining.length
        ? (remainingTotal * automaticCount) / remaining.length
        : 0
      return [
        type,
        {
          fixed,
          automaticCount,
          remainingCount: remaining.length,
          remainingTotal,
          average,
          automaticGain,
          gain: fixed.reduce((sum, entry) => sum + entry.gain, 0) + automaticGain,
        },
      ]
    }),
  ) as Record<ScoreType, SpLessonParameterBasis>
}
export function parameterBasesForLessons(counts: TypeScores, days: SpLessonDays = {}): TypeScores {
  const lessons = parameterLessonBases(counts, days)
  return Object.fromEntries(
    scoreTypes.map((type) => [type, parameterBonusExamBase + lessons[type].gain]),
  ) as TypeScores
}
export function parameterBasesForConditions(
  conditions?: ScoringConditions,
  counts?: TypeScores,
): TypeScores | undefined {
  const sp = hasSpConditions(conditions)
  if (!sp && !conditions?.examRatios) {
    return undefined
  }
  const lessons = sp ? parameterBasesForLessons(counts!, conditions?.spLessonDays) : undefined
  const exams = examParameterBases(conditions?.examRatios)
  return Object.fromEntries(
    scoreTypes.map((type) => [
      type,
      (lessons?.[type] ?? parameterBonusBase) - parameterBonusExamBase + exams[type].total,
    ]),
  ) as TypeScores
}
