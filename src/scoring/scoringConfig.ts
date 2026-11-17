// HIF共通の計算定義。日付は選抜初日を1とする通算日。
// 入力の検証はconditions/、日程探索はhifSchedule.tsを参照。
// 評価条件を変更して保存結果を再生成するときはruntime/revision.tsのcalculatorVersionも更新する。
// 相談の交換数はconsultationOperations、日別の対応はconsultationScheduleを参照。

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
// 選抜試験1・2の終了後に、それぞれ基本スキルカード2枚を削除する。
export const selectionExamDeletions = [
  { day: selectionExamDays[0]!, examNumber: 1, count: 2 },
  { day: selectionExamDays[1]!, examNumber: 2, count: 2 },
] as const
// 基本カードは合計7枚、アクティブ/メンタルはそれぞれ2～5枚。
// 初期内訳も含め対象カードに最も有利な選択をする。
export const basicSkillCards = { total: 7, minPerType: 2, maxPerType: 5 } as const
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
// 2. 各行動1回あたりの報酬・操作数。
export const supplyRewards = {
  skillCards: 1, // 差し入れで獲得するスキルカード枚数
  pDrinks: 1, // 同時に獲得するPドリンク個数
  minimumDrinkRarity: 'SR', // ドリンクの最低レアリティ
  skillEnhancement: 'random', // スキルカードの強化済み/未強化はランダム
} as const
export const outingRewards = {
  regularSkillCards: 2, // おでかけで獲得する通常スキルカード枚数
  sleepinessCards: 1, // 眠気ありの報酬を選んだ場合の追加枚数
  minimumSkillCards: 1, // 報酬の仕様上の最低枚数（現行の最大点探索は通常2枚を使用）
  pDrinks: 1, // 獲得するPドリンク個数
} as const
export const classRewards = { skillCards: 1, changes: 1, sleepinessCards: 1 } as const

// 3. 相談の事前前提。交換数を変える場合はここを編集する。
// 各候補日に相談を選ぶかどうか、リフレッシュをいつ使うかは探索で選択する。
export type ConsultationOperations = Record<
  'skill_enhance' | 'skill_delete' | 'p_drink_acquire' | 'skill_acquire',
  number
>
export const consultationOperations = {
  skill_enhance: 1, // 通常の相談1回で強化する枚数
  skill_delete: 1, // 通常の相談1回で削除する枚数
  p_drink_acquire: 4, // 通常の相談1回で交換するPドリンク個数
  skill_acquire: 4, // 通常の相談1回で交換するスキルカード枚数
} as const
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
export const consultationRefreshLimit = 1 // 育成全体でリフレッシュを使える回数
export const consultationRefreshMultiplier = 2 // 使用した相談だけ、上記の操作数をこの倍率にする

// 4. カスタマイズと育成全体の上限・評価前提。
export const specialTrainingCardLimit = 2
export const customizationsPerTrainingCard = 3
export const specialTrainingCustomizationLimit =
  specialTrainingCardLimit * customizationsPerTrainingCard

export const intervalCustomizationLimit = 6 // インターバルのカスタマイズ回数
export const pItemAcquisitionLimit = 6 // 育成全体のPアイテム獲得機会
export const conditionalAcquisitionLimit = 16 // 種別・キーワード・レアリティ条件付き獲得の上限
export const ssrAcquisitionLimits = { sense: 15, logic: 16, anomaly: 15 } as const
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
