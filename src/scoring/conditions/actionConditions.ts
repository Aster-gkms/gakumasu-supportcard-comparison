import {
  classDays,
  examDays,
  freeActionSlots,
  hifDayCount,
  intervalDay,
  publicLessonDays,
  selectionExamDays,
  restDays,
} from '../scoringConfig.ts'

export const configurableActions = [
  'activity_supply',
  'consultation',
  'outing_end',
  'special_training',
  'rest',
] as const
export type ConfigurableAction = (typeof configurableActions)[number]
export type ActionCounts = Partial<Record<ConfigurableAction, number>>
export const actionCountLabels: Record<ConfigurableAction, string> = {
  activity_supply: '差し入れ',
  consultation: '相談',
  outing_end: 'おでかけ',
  special_training: '特別指導',
  rest: '休む',
}
type CalendarAction =
  ConfigurableAction | 'lesson' | 'class' | 'selection_exam' | 'final_round' | 'interval'
export const actionAllowsRest = (kind: string) =>
  ['lesson', 'class', 'selection_exam'].includes(kind)
export const restAllowedOnDay = (day: number, canRest: boolean, forceSp = false) =>
  canRest &&
  restDays.some((candidate) => candidate === day) &&
  !(forceSp && publicLessonDays.some((candidate) => candidate === day))
export function calendarActions(day: number, canRest: boolean, forceSp: boolean): CalendarAction[] {
  let actions: CalendarAction[]
  if (publicLessonDays.some((value) => value === day)) {
    actions = ['lesson']
  } else if (classDays.some((value) => value === day)) {
    actions = ['class']
  } else if (examDays.includes(day)) {
    actions = [selectionExamDays.includes(day) ? 'selection_exam' : 'final_round']
  } else if (day === intervalDay) {
    actions = ['interval']
  } else {
    actions = [...(freeActionSlots.find((slot) => slot.day === day)?.actions ?? [])]
  }
  if (restAllowedOnDay(day, canRest, forceSp)) {
    actions.push('rest')
  }
  return actions
}

// 日・SP強制・前日の休む権利だけで決まる候補を内部で共有する。
const calendarChoices = new Map<number, readonly CalendarAction[]>()
const choicesFor = (day: number, canRest: boolean, forceSp: boolean) => {
  if (!Number.isInteger(day) || day < 1 || day > hifDayCount) {
    return calendarActions(day, canRest, forceSp)
  }
  const key = day * 4 + Number(forceSp) * 2 + Number(canRest)
  let choices = calendarChoices.get(key)
  if (!choices) {
    choices = calendarActions(day, canRest, forceSp)
    calendarChoices.set(key, choices)
  }
  return choices
}
// 上限は行動とSP強制の有無だけで決まり、条件検証ごとに探し直さない。
const actionLimits = [new Map<ConfigurableAction, number>(), new Map<ConfigurableAction, number>()]

export function actionCountLimit(action: ConfigurableAction, forceSp: boolean): number {
  const limits = actionLimits[forceSp ? 1 : 0]!
  const cached = limits.get(action)
  if (cached !== undefined) {
    return cached
  }
  const memo = new Map<number, number>()
  function maximum(day: number, canRest: boolean): number {
    if (day > hifDayCount) {
      return 0
    }
    const key = day * 2 + Number(canRest)
    if (memo.has(key)) {
      return memo.get(key)!
    }
    const value = Math.max(
      ...choicesFor(day, canRest, forceSp).map(
        (candidate) =>
          (candidate === action ? 1 : 0) + maximum(day + 1, actionAllowsRest(candidate)),
      ),
    )
    memo.set(key, value)
    return value
  }
  const maximumCount = maximum(1, false)
  limits.set(action, maximumCount)
  return maximumCount
}

type ActionCountRanges = Partial<Record<ConfigurableAction, { min: number; max: number }>>
const matcherCache = new Map<string, ReturnType<typeof createActionScheduleMatcher>>()
export function actionScheduleMatcher(counts: ActionCounts, forceSp: boolean) {
  const cacheKey = JSON.stringify([forceSp, configurableActions.map((key) => counts[key] ?? null)])
  let matcher = matcherCache.get(cacheKey)
  if (!matcher) {
    const ranges = Object.fromEntries(
      configurableActions
        .filter((key) => counts[key] !== undefined)
        .map((key) => [key, { min: counts[key]!, max: counts[key]! }]),
    )
    matcher = createActionScheduleMatcher(ranges, forceSp)
    matcherCache.set(cacheKey, matcher)
    if (matcherCache.size > 32) {
      matcherCache.delete(matcherCache.keys().next().value!)
    }
  }
  return matcher
}
// ステータス効果に依存しない日程の成立判定。実際の翌日休み・同日の排他を共有する。
export function createActionScheduleMatcher(ranges: ActionCountRanges, forceSp: boolean) {
  const keys = configurableActions.filter((key) => ranges[key])
  const maxima = keys.map((key) => ranges[key]!.max)
  const minima = keys.map((key) => ranges[key]!.min)
  const minimumIsSafe = minima.map((minimum) => Number.isSafeInteger(minimum))
  // 指定対象の回数と翌日休めるかが同じ選択肢は、成立判定では同じ遷移になる。
  const trackedActions = new Set<string>(keys)
  const prepareChoices = (day: number, canRest: boolean) => {
    const seen = new Set<string>()
    return choicesFor(day, canRest, forceSp).flatMap((action) => {
      const countedAction = trackedActions.has(action) ? (action as ConfigurableAction) : undefined
      const nextCanRest = actionAllowsRest(action)
      const key = `${countedAction ?? ''}:${nextCanRest}`
      if (seen.has(key)) {
        return []
      }
      seen.add(key)
      return [{ action: countedAction, canRest: nextCanRest }]
    })
  }
  const dailyChoices = Array.from({ length: hifDayCount + 1 }, (_, day) =>
    day ? [prepareChoices(day, false), prepareChoices(day, true)] : undefined,
  )
  // 残り日程で各行動を選べる最大回数。最低回数に届かない状態を早期に除く。
  const remainingMaxima = Array.from({ length: hifDayCount + 2 }, () => [
    keys.map(() => 0),
    keys.map(() => 0),
  ])
  for (let day = hifDayCount; day >= 1; day--) {
    for (const restIndex of [0, 1]) {
      remainingMaxima[day]![restIndex] = keys.map((key, index) =>
        dailyChoices[day]![restIndex]!.reduce(
          (maximum, choice) =>
            Math.max(
              maximum,
              Number(choice.action === key) +
                remainingMaxima[day + 1]![Number(choice.canRest)]![index]!,
            ),
          0,
        ),
      )
    }
  }
  // 日・休む可否・回数を桁とする整数キー。汎用呼出しで範囲外なら文字列へ戻す。
  let capacity = (hifDayCount + 1) * 2
  const canUseNumericKeys = maxima.every((maximum) => {
    capacity *= maximum + 1
    return Number.isSafeInteger(maximum) && maximum >= 0 && Number.isSafeInteger(capacity)
  })
  const memo = new Map<string | number, boolean>()
  function canFinish(day: number, canRest: boolean, counts: ActionCounts): boolean {
    const restIndex = Number(canRest)
    let useNumber = canUseNumericKeys && Number.isInteger(day) && day >= 1
    let encoded = day * 2 + restIndex
    for (let i = 0; i < keys.length; i++) {
      const count = counts[keys[i]!] ?? 0
      if (count > maxima[i]!) {
        return false
      }
      if (!Number.isInteger(count) || count < 0) {
        useNumber = false
      }
      if (useNumber) {
        encoded = encoded * (maxima[i]! + 1) + count
      }
    }
    if (day > hifDayCount) {
      // 回数範囲は作成時の値で統一し、呼出元のオブジェクト変更を持ち込まない。
      return keys.every((key, index) => (counts[key] ?? 0) >= minima[index]!)
    }
    const memoKey = useNumber
      ? encoded
      : `${day}:${canRest}:${keys.map((key) => counts[key] ?? 0).join(',')}`
    const cached = memo.get(memoKey)
    if (cached !== undefined) {
      return cached
    }
    // 既知の状態は上のメモから返し、残り回数の検査も繰り返さない。
    const remaining =
      Number.isInteger(day) && day >= 1 && day <= hifDayCount
        ? remainingMaxima[day]![restIndex]
        : undefined
    if (remaining) {
      for (let i = 0; i < keys.length; i++) {
        const count = counts[keys[i]!] ?? 0
        if (minimumIsSafe[i] && Number.isSafeInteger(count) && count + remaining[i]! < minima[i]!) {
          memo.set(memoKey, false)
          return false
        }
      }
    }
    const choices = dailyChoices[day]?.[restIndex] ?? prepareChoices(day, canRest)
    const possible = choices.some(({ action, canRest: nextCanRest }) => {
      const next = action ? { ...counts, [action]: (counts[action] ?? 0) + 1 } : counts
      return canFinish(day + 1, nextCanRest, next)
    })
    memo.set(memoKey, possible)
    return possible
  }
  return canFinish
}
