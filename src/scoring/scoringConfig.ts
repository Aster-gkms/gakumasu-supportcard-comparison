// HIF共通の計算定義。日付は選抜初日を1とする通算日。
// 入力の検証はconditions/、日程探索はhifSchedule.tsを参照。
// 報酬個数・操作数・獲得上限の手動編集はscoringCounts.ts。ここでは日程と日別対応を管理する。
import {
  consultationOperations,
  selectionExamDeletionCount,
  type ConsultationOperations,
} from './scoringCounts.ts'
// 既存の参照先でも同じ定義を使用できるよう、互換の入口として再公開する。
export * from './scoringCounts.ts'

export type LessonKind = 'normal' | 'sp'

// 1. 日程と排他的な行動候補。候補回数を同時にすべて実行できるとは限らない。
// 選抜は通算1～20日、本戦は通算21～29日（例: 通算26日は本戦6日目）。
export const hifDayCount = 29
export const publicLessonDays = [2, 4, 9, 11, 15, 18, 22, 25] as const
// 休む候補日。従来の翌日権・SP指定時の排他制約も併せて適用する。
export const restDays = [3, 5, 8, 10, 12, 14, 16, 18, 19, 23, 25] as const
export const classDays = [3, 6, 10, 17, 21, 24] as const
export const classAcquisitionDays: readonly number[] = [3, 6]
export const selectionExamDays: readonly number[] = [7, 13, 20]
export const finalRoundDays = [27, 29] as const
export const examDays = [...selectionExamDays, ...finalRoundDays] as const
// 各対象試験の終了後に削除する基本カード枚数はscoringCounts.tsを参照。
export const selectionExamDeletions = [
  { day: selectionExamDays[0]!, examNumber: 1, count: selectionExamDeletionCount },
  { day: selectionExamDays[1]!, examNumber: 2, count: selectionExamDeletionCount },
] as const
export const intervalDay = 28

export type FreeAction = 'outing_end' | 'consultation' | 'activity_supply' | 'special_training'
export const freeActionSlots: readonly { day: number; actions: readonly FreeAction[] }[] = [
  { day: 1, actions: ['consultation', 'activity_supply', 'special_training'] },
  { day: 5, actions: ['outing_end', 'consultation'] },
  { day: 8, actions: ['outing_end', 'activity_supply'] },
  { day: 12, actions: ['consultation', 'special_training'] },
  { day: 14, actions: ['outing_end', 'activity_supply'] },
  { day: 16, actions: ['outing_end', 'consultation', 'activity_supply'] },
  { day: 19, actions: ['consultation', 'special_training'] },
  { day: 23, actions: ['outing_end', 'activity_supply'] },
  { day: 26, actions: ['consultation'] },
]
// 行動名: consultation=相談、activity_supply=差し入れ、outing_end=おでかけ、
// special_training=特別指導。同じ行の選択肢は同日には1つだけ実行する。
// 各相談候補日の標準操作数はscoringCounts.tsの共通設定を使う。
// 各相談候補日の事前前提。相談を選ばなかった日の操作は加算しない。
export const consultationSchedule: readonly { day: number; operations: ConsultationOperations }[] =
  freeActionSlots
    .filter((slot) => slot.actions.includes('consultation'))
    .map((slot) => ({ day: slot.day, operations: consultationOperations }))
export function consultationOperationsForDay(day: number): ConsultationOperations {
  const assumption = consultationSchedule.find((entry) => entry.day === day)
  if (!assumption) {
    throw new Error(`相談の事前前提がない日です: ${day}`)
  }
  return assumption.operations
}
// パラボ基準値の内訳。
// 日付は通算日。現行は全SP・自由配分を対象タイプへ寄せた基準を使う。
export const parameterBonusLessonRewards = [
  { day: 2, normal: 50, sp: 60 },
  { day: 4, normal: 60, sp: 80 },
  { day: 9, normal: 70, sp: 80 },
  { day: 11, normal: 80, sp: 100 },
  { day: 15, normal: 90, sp: 100 },
  { day: 18, normal: 100, sp: 120 },
  { day: 22, normal: 110, sp: 120 },
  { day: 25, normal: 120, sp: 140 },
] as const
export const parameterBonusExamRewards = [
  { day: selectionExamDays[0], examNumber: 1, fixedPerType: 20, allocatable: 80 },
  { day: selectionExamDays[1], examNumber: 2, fixedPerType: 80, allocatable: 200 },
  { day: selectionExamDays[2], examNumber: 3, fixedPerType: 100, allocatable: 220 },
] as const
export const parameterBonusLessonBase = parameterBonusLessonRewards.reduce(
  (sum, entry) => sum + entry.sp,
  0,
)
export const parameterBonusExamBase = parameterBonusExamRewards.reduce(
  (sum, entry) => sum + entry.fixedPerType + entry.allocatable,
  0,
)
export const parameterBonusBase = parameterBonusLessonBase + parameterBonusExamBase
export const evaluationPlans = ['sense', 'logic', 'anomaly'] as const
