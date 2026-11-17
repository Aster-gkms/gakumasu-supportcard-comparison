import { scoreTypes, emptyTypeScores, scoreTargets, validateLimit } from './scoreMath.ts'
import { acquisitionActivationLimit } from './effects/acquisitionLimits.ts'
import type { SupportCard } from '../data/cards.ts'
import { getClassRewards, classActivations, type ClassReward } from './actions/classes.ts'
import type { ScoreType } from './scoreMath.ts'
import type { TypeScores } from './scoreMath.ts'
import {
  normalizeConditions,
  hasSpConditions,
  parameterBasesForConditions,
  type ScoringConditions,
} from './conditions/conditions.ts'
import {
  configurableActions,
  actionScheduleMatcher,
  actionAllowsRest,
  restAllowedOnDay,
  type ActionCounts,
} from './conditions/actionConditions.ts'
import { calculateParameterBonusSubtotal } from './effects/parameterBonus.ts'
import type { LessonKind } from './scoringConfig.ts'
import { supplyActivations } from './actions/supply.ts'
import { outingActivations } from './actions/outing.ts'
import {
  classDays,
  classRewards,
  examDays,
  freeActionSlots,
  type FreeAction,
  hifDayCount,
  intervalDay,
  intervalCustomizationLimit,
  publicLessonDays,
  selectionExamDays,
  selectionExamDeletions,
  specialTrainingCustomizationLimit,
  supplyRewards,
  outingRewards,
  pItemAcquisitionLimit,
  consultationRefreshLimit,
  consultationRefreshMultiplier,
} from './scoringConfig.ts'
import {
  consultationOperationsForSettings,
  type OperationSettings,
} from './conditions/operationSettings.ts'
import { getSupportEventOperations, type SupportEventChoice } from './effects/supportEvents.ts'
import { prepareProduceItemScores, type ItemActionReference } from './effects/produceItems.ts'
import { fixedAcquiredSkills } from './effects/acquiredSkills.ts'
import { getSkillGrant, type SkillGrant } from './effects/skillGrants.ts'
import { getSsrAcquisitionContext, type EvaluationPlan } from './effects/ssrAcquisition.ts'
import type { ActivationEvidence, ActivationSource } from './activationEvidence.ts'
import {
  acquisitionKeywordTriggers,
  getKeywordAllocations,
  type AcquisitionKeyword,
  type KeywordAcquisitions,
} from './effects/skillAcquisitions.ts'
import { consultationActivations } from './actions/consultation.ts'

function scoringKeywordAllocations(count: number, keywords: readonly AcquisitionKeyword[]) {
  return getKeywordAllocations(count, keywords, true)
}

type ActionKind =
  'lesson' | 'class' | 'selection_exam' | 'final_round' | 'interval' | 'rest' | FreeAction
export interface HifAction {
  kind: ActionKind
  main?: ScoreType
  lessonKind?: LessonKind
  consultationRefresh?: boolean
  activeEnhancements?: number
  activeDeletions?: number
  activeAcquisitions?: number
  keywordAcquisitions?: KeywordAcquisitions
  outingSleepiness?: boolean
  classReward?: ClassReward
  ssrAcquisitions?: number
}
export interface HifScheduleChoice extends HifAction {
  day: number
}
export interface ItemCopyChoice extends ItemActionReference {
  count: number
  activeAcquisitions: number
  keywordAcquisitions: KeywordAcquisitions
  ssrAcquisitions?: number
}
export interface HifScheduleSubtotal {
  actionCounts?: Record<(typeof configurableActions)[number], number>
  lessonCounts?: TypeScores
  total: number
  byType: Record<ScoreType, number>
  choices: HifScheduleChoice[]
  eventChoices: SupportEventChoice[]
  breakdown: {
    abilityIndex: number
    trigger: string
    value: number
    count: number
    total: number
    activations: ActivationEvidence[]
  }[]
  pendingAbilityIndexes: number[]
  pendingEventIndexes: number[]
  produceItemBreakdown: {
    itemIndex: number
    actionIndex: number
    trigger: string
    value: number
    count: number
    total: number
    activations: ActivationEvidence[]
  }[]
  pendingItemActions: ItemActionReference[]
  zeroScoreItemActions: ItemActionReference[]
  itemCopyChoices: ItemCopyChoice[]
  itemOperationCounts: { itemIndex: number; activationCount: number }[]
  skillGrants: SkillGrant[]
  pendingSkillGrants: string[]
  ssrAcquisition?: { plan: EvaluationPlan; limit: number; count: number }
}

const types = scoreTypes
const lessons = new Set<number>(publicLessonDays)
const classes = new Set<number>(classDays)
const exams = new Set<number>(examDays)
const freeDays = new Map(freeActionSlots.map((slot) => [slot.day, slot.actions]))
// 日付だけで決まる情報は、カードごとの探索で繰り返し集計しない。
const remainingLessonsByDay = Array.from(
  { length: hifDayCount + 1 },
  (_, day) => publicLessonDays.filter((lessonDay) => lessonDay > day).length,
)
const examDeletionsByDay = new Map(selectionExamDeletions.map((entry) => [entry.day, entry]))
const supportedTriggers = new Set([
  'lesson_end',
  'normal_end',
  'sp_end',
  'class_end',
  'exam_end',
  'rest',
  'skill_custom',
  'skill_enhance',
  'active_enhance',
  'mental_enhance',
  'skill_delete',
  'skill_change',
  'active_delete',
  'mental_delete',
  'skill_acquire',
  'skill_ssr_acquire',
  'active_acquire',
  'mental_acquire',
  'p_drink_acquire',
  'p_item_acquire',
  'consultation_drink',
  'consultation_skill_acquire',
  ...Object.values(acquisitionKeywordTriggers),
  ...freeActionSlots.flatMap((slot) => slot.actions),
  ...types.flatMap((type) => [`${type}_lesson_end`, `${type}_normal_end`, `${type}_sp_end`]),
])

export function getHifActions(
  day: number,
  previousAction?: HifAction,
  refreshAvailable = true,
  targetVariants = { enhancement: true, deletion: true, acquisition: true },
  acquisitionKeywords: readonly AcquisitionKeyword[] = [],
  operationSettings?: OperationSettings,
): HifAction[] {
  let actions: HifAction[]
  if (lessons.has(day)) {
    actions = types.flatMap((main) =>
      (['sp', 'normal'] as const).map((lessonKind) => ({
        kind: 'lesson' as const,
        main,
        lessonKind,
      })),
    )
  } else if (classes.has(day)) {
    actions = types.flatMap((main) =>
      getClassRewards(day).map((classReward) => ({ kind: 'class' as const, main, classReward })),
    )
  } else if (exams.has(day)) {
    actions = [{ kind: selectionExamDays.includes(day) ? 'selection_exam' : 'final_round' }]
  } else if (day === intervalDay) {
    actions = [{ kind: 'interval' }]
  } else if (freeDays.has(day)) {
    actions = freeDays.get(day)!.map((kind) => ({ kind }))
  } else {
    throw new Error(`HIFの日程が未定義です: ${day}`)
  }
  if (refreshAvailable) {
    actions = actions.flatMap((action) =>
      action.kind === 'consultation'
        ? [action, { ...action, consultationRefresh: true }]
        : [action],
    )
  }
  actions = actions.flatMap((action) => {
    if (action.kind === 'class' && action.classReward === 'acquire') {
      const choices: HifAction[] = []
      for (
        let activeAcquisitions = 0;
        activeAcquisitions <= (targetVariants.acquisition ? classRewards.skillCards : 0);
        activeAcquisitions++
      )
        for (const keywordAcquisitions of scoringKeywordAllocations(
          classRewards.skillCards,
          acquisitionKeywords,
        ))
          choices.push({ ...action, activeAcquisitions, keywordAcquisitions })
      return choices
    }
    if (action.kind === 'outing_end') {
      const choices: HifAction[] = []
      for (const outingSleepiness of [true, false])
        for (
          let activeAcquisitions = 0;
          activeAcquisitions <= (targetVariants.acquisition ? outingRewards.regularSkillCards : 0);
          activeAcquisitions++
        )
          for (const keywordAcquisitions of scoringKeywordAllocations(
            outingRewards.regularSkillCards,
            acquisitionKeywords,
          ))
            choices.push({ ...action, outingSleepiness, activeAcquisitions, keywordAcquisitions })
      return choices
    }
    if (action.kind === 'activity_supply') {
      const choices: HifAction[] = []
      for (
        let activeAcquisitions = 0;
        activeAcquisitions <= (targetVariants.acquisition ? supplyRewards.skillCards : 0);
        activeAcquisitions++
      )
        for (const keywordAcquisitions of scoringKeywordAllocations(
          supplyRewards.skillCards,
          acquisitionKeywords,
        ))
          choices.push({ ...action, activeAcquisitions, keywordAcquisitions })
      return choices
    }
    if (action.kind !== 'consultation') {
      return [action]
    }
    const multiplier = action.consultationRefresh ? consultationRefreshMultiplier : 1
    const operationCounts = consultationOperationsForSettings(day, operationSettings)
    const choices: HifAction[] = []
    const keywordChoices = scoringKeywordAllocations(
      operationCounts.skill_acquire * multiplier,
      acquisitionKeywords,
    )
    for (
      let activeEnhancements = 0;
      activeEnhancements <=
      (targetVariants.enhancement ? operationCounts.skill_enhance * multiplier : 0);
      activeEnhancements++
    )
      for (
        let activeDeletions = 0;
        activeDeletions <=
        (targetVariants.deletion ? operationCounts.skill_delete * multiplier : 0);
        activeDeletions++
      )
        for (
          let activeAcquisitions = 0;
          activeAcquisitions <=
          (targetVariants.acquisition ? operationCounts.skill_acquire * multiplier : 0);
          activeAcquisitions++
        )
          for (const keywordAcquisitions of keywordChoices)
            choices.push({
              ...action,
              activeEnhancements,
              activeDeletions,
              activeAcquisitions,
              keywordAcquisitions,
            })
    return choices
  })
  const canRest = previousAction && actionAllowsRest(previousAction.kind)
  if (restAllowedOnDay(day, !!canRest)) {
    actions.push({ kind: 'rest' })
  }
  return actions
}

function activations(
  action: HifAction,
  day: number,
  operationSettings?: OperationSettings,
): Record<string, number> {
  if (action.kind === 'lesson') {
    return {
      lesson_end: 1,
      [`${action.main}_lesson_end`]: 1,
      [`${action.lessonKind}_end`]: 1,
      [`${action.main}_${action.lessonKind}_end`]: 1,
    }
  }
  if (action.kind === 'class') {
    if (!action.classReward) {
      throw new Error('授業の報酬が未指定です。')
    }
    return classActivations(
      action.classReward,
      action.activeAcquisitions,
      action.keywordAcquisitions,
    )
  }
  if (action.kind === 'selection_exam' || action.kind === 'final_round') {
    return { exam_start: 1, exam_end: 1 }
  }
  if (action.kind === 'interval') {
    return {
      skill_custom: operationSettings?.interval_customizations ?? intervalCustomizationLimit,
    }
  }
  if (action.kind === 'special_training') {
    return {
      special_training: 1,
      skill_custom:
        operationSettings?.special_training_customizations ?? specialTrainingCustomizationLimit,
    }
  }
  if (action.kind === 'activity_supply') {
    return supplyActivations(action.activeAcquisitions, action.keywordAcquisitions)
  }
  if (action.kind === 'outing_end') {
    return outingActivations(
      action.outingSleepiness,
      action.activeAcquisitions,
      action.keywordAcquisitions,
    )
  }
  if (action.kind === 'consultation') {
    return consultationActivations(
      action.consultationRefresh === true,
      action.activeEnhancements,
      action.activeDeletions,
      action.activeAcquisitions,
      action.keywordAcquisitions,
      consultationOperationsForSettings(day, operationSettings),
    )
  }
  return { [action.kind]: 1 }
}

// 単体カードの直接加算とPアイテム操作連鎖を、同じ日程・共有上限で解決する。
// HIF29日を動的計画法で探索し、同じ残り制約の状態では最も高い得点だけを残す。
// 日別の行動・獲得・コピーは同じ状態へ加算する。行動別の独立最大値を足さない。
export function calculateHifScheduleSubtotal(
  card: SupportCard,
  limit: number,
  requestedPlan?: EvaluationPlan,
  requestedConditions?: ScoringConditions,
): HifScheduleSubtotal {
  validateLimit(limit)
  const normalizedConditions = normalizeConditions(requestedConditions)
  const conditions = hasSpConditions(normalizedConditions) ? normalizedConditions : undefined
  const requestedActions = normalizedConditions?.actionCounts
  const constrainedActions = configurableActions.filter(
    (key) => requestedActions?.[key] !== undefined,
  )
  const canFinishActions = requestedActions
    ? actionScheduleMatcher(requestedActions, !!conditions)
    : undefined
  const parameterTypes = conditions
    ? types.filter((type) =>
        card.effects.support_ability.some(
          (effect) =>
            effect.value_type === 'param_bonus' &&
            effect.trigger === 'equip' &&
            (effect.type === type || effect.type === 'all'),
        ),
      )
    : []
  const pendingAbilityIndexes: number[] = []
  const abilityEffects = card.effects.support_ability.flatMap((effect, abilityIndex) => {
    if (effect.value_type !== 'status_add' || effect.trigger === 'produce_start') {
      return []
    }
    const value = Array.isArray(effect.values) ? effect.values[limit] : undefined
    if (
      !supportedTriggers.has(String(effect.trigger)) ||
      !['vo', 'da', 'vi', 'all'].includes(String(effect.type)) ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (effect.max_count !== undefined &&
        (!Number.isInteger(effect.max_count) || Number(effect.max_count) <= 0))
    ) {
      pendingAbilityIndexes.push(abilityIndex)
      return []
    }
    return [
      {
        category: 'support_ability' as const,
        abilityIndex,
        trigger: String(effect.trigger),
        type: String(effect.type),
        value,
        cap: acquisitionActivationLimit(
          String(effect.trigger),
          Number(effect.max_count ?? Infinity),
        ),
      },
    ]
  })
  const items = prepareProduceItemScores(card)
  const ssrContext = abilityEffects.some((effect) => effect.trigger === 'skill_ssr_acquire')
    ? getSsrAcquisitionContext(card, requestedPlan)
    : undefined
  const ssrFromFiring = (count: number, firing: Record<string, number>) =>
    Math.min(
      Math.max(
        0,
        (firing.active_acquire ?? 0) +
          (firing.mental_acquire ?? 0) -
          (firing.ssr_ineligible_acquire ?? 0),
      ),
      Math.max(0, (ssrContext?.acquisitionCount ?? 0) - count),
    )
  const effects = [
    ...abilityEffects,
    ...items.effects.map((effect) => ({
      ...effect,
      category: 'produce_item' as const,
      abilityIndex: -1,
    })),
  ]
  type History = {
    previous?: History
    source: ActivationSource
    firing: Record<string, number>
    beforeCounts: readonly number[]
    afterCounts: readonly number[]
    beforeSsrCount: number
  }
  type ChoicePath = {
    previous?: ChoicePath
    choice: HifScheduleChoice
  }
  type State = {
    // 未使用の項目もundefinedで持ち、探索中の全状態でプロパティを揃える。
    lessonCounts: TypeScores | undefined
    actionCounts: ActionCounts | undefined
    total: number
    // 共有カウンタは新しい状態へ差し替える。直接変更は履歴と派生キーを壊す。
    readonly counts: readonly number[]
    path: ChoicePath | undefined
    canRest: boolean
    refreshesUsed: number
    eventChoices: SupportEventChoice[]
    readonly copyCounts: readonly number[]
    itemCopyChoices: ItemCopyChoice[]
    readonly ssrCount: number
    history: History | undefined
    cachedTransitionKey: string | number | undefined
  }
  // 採用した発動履歴を共有チェーンで保持し、探索・キャッシュのキーには含めない。
  const withHistory = (
    before: State,
    after: State,
    source: ActivationSource,
    firing: Record<string, number>,
  ): State => {
    const ssrAcquisitions = ssrFromFiring(before.ssrCount, firing)
    const hasEvidence = effects.some((effect, index) => {
      const opportunities =
        'enhancementKeyword' in effect && effect.enhancementKeyword
          ? (firing.skill_enhance ?? 0)
          : effect.trigger === 'skill_ssr_acquire'
            ? ssrAcquisitions
            : (firing[effect.trigger] ?? 0)
      return opportunities > 0 || after.counts[index] !== before.counts[index]
    })
    // 探索中は不変のカウンタ配列への参照だけを保持し、選ばれた日程だけ説明を組み立てる。
    return hasEvidence
      ? {
          ...after,
          history: {
            previous: before.history,
            source,
            firing,
            beforeCounts: before.counts,
            afterCounts: after.counts,
            beforeSsrCount: before.ssrCount,
          },
        }
      : after
  }
  const applyDirectFiring = (state: State, firing: Record<string, number>) => {
    let total = state.total
    const counts = state.counts.map((count, index) => {
      const effect = effects[index]!
      const opportunities =
        'enhancementKeyword' in effect && effect.enhancementKeyword
          ? (firing.skill_enhance ?? 0)
          : (firing[effect.trigger] ?? 0)
      const added = Math.min(opportunities, Math.max(0, effect.cap - count))
      total += effect.value * added * (effect.type === 'all' ? 3 : 1)
      return count + added
    })
    return { total, counts }
  }
  const boundedItems = new Set(
    items.operationEffects
      .filter((effect) => Number.isFinite(effect.cap))
      .map((effect) => effect.itemIndex),
  )
  const boundedEffectIndexes = effects.flatMap((effect, index) =>
    Number.isFinite(effect.cap) ? [index] : [],
  )
  const boundedItemIndexes = [...boundedItems]
  const initialTransitionKey =
    boundedEffectIndexes.length || boundedItemIndexes.length || ssrContext ? undefined : 0
  // 各カウンタを桁として扱う。安全な整数に収まらない定義では文字列キーを使う。
  // ビット演算は32bitへ切り詰めるため使用しない。
  const effectRadices = boundedEffectIndexes.map((index) => effects[index]!.cap + 1)
  const itemRadices = boundedItemIndexes.map(
    (index) =>
      Math.max(
        ...items.operationEffects
          .filter((effect) => effect.itemIndex === index)
          .map((effect) => effect.cap),
      ) + 1,
  )
  const ssrRadix = (ssrContext?.acquisitionCount ?? 0) + 1
  const transitionRadices = [...effectRadices, ...itemRadices, ssrRadix]
  const stateRadices = [
    ...transitionRadices,
    2,
    consultationRefreshLimit + 1,
    ...constrainedActions.map(() => hifDayCount + 1),
    ...(conditions ? types.map((type) => conditions.spLessons[type] + 1) : []),
    ...parameterTypes.map(() => publicLessonDays.length + 1),
  ]
  const canEncode = (radices: number[]) => {
    let capacity = 1
    for (const radix of radices) {
      capacity *= radix
      if (!Number.isSafeInteger(radix) || radix < 1 || !Number.isSafeInteger(capacity)) {
        return false
      }
    }
    return true
  }
  const numericTransitions = canEncode(transitionRadices)
  const numericStates = canEncode(stateRadices)
  const effectKey = (counts: readonly number[]) => {
    let key = ''
    for (const index of boundedEffectIndexes) key += `${counts[index]},`
    return key
  }
  const operationKey = (counts: readonly number[]) =>
    boundedItemIndexes.map((index) => counts[index]).join(',')
  // 1つの発動機会の結果は、効果上限・操作上限・SSR残数だけで決まる。
  // SPの割当や指定行動回数を含めると、同じ遷移を別日程ごとに再計算してしまう。
  const calculateTransitionKey = (state: State): string | number => {
    if (!numericTransitions) {
      return `${effectKey(state.counts)}:${operationKey(state.copyCounts)}:${state.ssrCount}`
    }
    let key = 0
    for (let i = 0; i < boundedEffectIndexes.length; i++) {
      key = key * effectRadices[i]! + state.counts[boundedEffectIndexes[i]!]!
    }
    for (let i = 0; i < boundedItemIndexes.length; i++) {
      key = key * itemRadices[i]! + state.copyCounts[boundedItemIndexes[i]!]!
    }
    return key * ssrRadix + state.ssrCount
  }
  // カウンタは不変なので、同じ状態の派生キーは一度だけ求める。
  // counts/copyCounts/ssrCountを変更した遷移では必ず初期値へ戻す。
  const transitionStateKey = (state: State): string | number => {
    if (state.cachedTransitionKey === undefined) {
      state.cachedTransitionKey = calculateTransitionKey(state)
    }
    return state.cachedTransitionKey
  }
  const stateKey = (
    state: State,
    canRest = state.canRest,
    refreshesUsed = state.refreshesUsed,
    lessonCounts = state.lessonCounts,
    actionCounts = state.actionCounts,
  ): string | number => {
    if (!numericStates) {
      return `${canRest ? 1 : 0}:${refreshesUsed}:${transitionStateKey(state)}${requestedActions ? `:actions:${constrainedActions.map((key) => actionCounts?.[key] ?? 0).join(',')}` : ''}${conditions ? `:lessons:${types.map((type) => Math.min(lessonCounts![type], conditions.spLessons[type])).join(',')}:${parameterTypes.map((type) => lessonCounts![type]).join(',')}` : ''}`
    }
    let key =
      (Number(transitionStateKey(state)) * 2 + (canRest ? 1 : 0)) * (consultationRefreshLimit + 1) +
      refreshesUsed
    for (const action of constrainedActions) {
      key = key * (hifDayCount + 1) + (actionCounts?.[action] ?? 0)
    }
    if (conditions) {
      for (const type of types) {
        key =
          key * (conditions.spLessons[type] + 1) +
          Math.min(lessonCounts![type], conditions.spLessons[type])
      }
      for (const type of parameterTypes) {
        key = key * (publicLessonDays.length + 1) + lessonCounts![type]
      }
    }
    return key
  }
  const targetVariants = {
    enhancement: effects.some((effect) =>
      ['active_enhance', 'mental_enhance'].includes(effect.trigger),
    ),
    deletion: effects.some((effect) => ['active_delete', 'mental_delete'].includes(effect.trigger)),
    acquisition: effects.some((effect) =>
      ['active_acquire', 'mental_acquire'].includes(effect.trigger),
    ),
  }
  const acquisitionKeywords = (
    Object.keys(acquisitionKeywordTriggers) as AcquisitionKeyword[]
  ).filter((keyword) =>
    [...effects, ...items.operationEffects].some(
      (effect) => effect.trigger === acquisitionKeywordTriggers[keyword],
    ),
  )
  const neededKeywords = (state: State) =>
    acquisitionKeywords.filter((keyword) => {
      const trigger = acquisitionKeywordTriggers[keyword]
      return (
        effects.some(
          (effect, index) => effect.trigger === trigger && state.counts[index]! < effect.cap,
        ) ||
        items.operationEffects.some(
          (effect) =>
            effect.trigger === trigger && state.copyCounts[effect.itemIndex]! < effect.cap,
        )
      )
    })
  const variantsFor = (state: State) => ({
    enhancement: effects.some(
      (effect, index) =>
        ['active_enhance', 'mental_enhance'].includes(effect.trigger) &&
        state.counts[index]! < effect.cap,
    ),
    deletion: effects.some(
      (effect, index) =>
        ['active_delete', 'mental_delete'].includes(effect.trigger) &&
        state.counts[index]! < effect.cap,
    ),
    acquisition: effects.some(
      (effect, index) =>
        ['active_acquire', 'mental_acquire'].includes(effect.trigger) &&
        state.counts[index]! < effect.cap,
    ),
  })
  // 候補の種別・キーワードは有限上限の残数だけで決まり、SP配分には依存しない。
  // 無上限の効果は常に候補を要するため、transitionStateKeyで区別する必要がない。
  const preparationCache = new Map<
    string | number,
    {
      variants: ReturnType<typeof variantsFor>
      keywords: AcquisitionKeyword[]
      key: string
    }
  >()
  const staticPreparation =
    !targetVariants.enhancement &&
    !targetVariants.deletion &&
    !targetVariants.acquisition &&
    !acquisitionKeywords.length
      ? { variants: targetVariants, keywords: acquisitionKeywords, key: 'false:false:false:' }
      : undefined
  const preparationFor = (state: State) => {
    if (staticPreparation) {
      return staticPreparation
    }
    const key = transitionStateKey(state)
    let prepared = preparationCache.get(key)
    if (!prepared) {
      const variants = variantsFor(state)
      const keywords = neededKeywords(state)
      prepared = {
        variants,
        keywords,
        key: [
          variants.enhancement,
          variants.deletion,
          variants.acquisition,
          keywords.join(','),
        ].join(':'),
      }
      if (preparationCache.size < 5000) {
        preparationCache.set(key, prepared)
      }
    }
    return prepared
  }
  const relevantFiring = new Set(
    [...effects, ...items.operationEffects].map((effect) =>
      'enhancementKeyword' in effect && effect.enhancementKeyword
        ? 'skill_enhance'
        : effect.trigger,
    ),
  )
  if (ssrContext) {
    relevantFiring.add('active_acquire')
    relevantFiring.add('mental_acquire')
  }
  // 候補の比較にはSSR対象外の枚数も必要。対象トリガーの配列は1回だけ作る。
  const actionFiringTriggers = [
    ...relevantFiring,
    ...(ssrContext ? ['ssr_ineligible_acquire'] : []),
  ]
  const applyUncachedFiring = (state: State, firing: Record<string, number>): State[] => {
    // 対象効果へ接続するかはapplyFiringで確認済み。
    const ssrAcquisitions = ssrFromFiring(state.ssrCount, firing)
    const countedFiring = { ...firing, skill_ssr_acquire: ssrAcquisitions }
    let candidates: State[] = [
      {
        ...state,
        ...applyDirectFiring(state, countedFiring),
        ssrCount: state.ssrCount + ssrAcquisitions,
        cachedTransitionKey: initialTransitionKey,
      },
    ]
    if (!items.operationEffects.length) {
      return candidates
    }
    const reserved = [...state.copyCounts]
    const jobs: { effect: (typeof items.operationEffects)[number]; count: number }[] = []
    const activatedItems = new Map<number, number>()
    for (const effect of items.operationEffects) {
      let activations = activatedItems.get(effect.itemIndex)
      if (activations === undefined) {
        const opportunities = effect.enhancementKeyword
          ? (firing.skill_enhance ?? 0)
          : (firing[effect.trigger] ?? 0)
        activations = Math.min(opportunities, Math.max(0, effect.cap - reserved[effect.itemIndex]!))
        activatedItems.set(effect.itemIndex, activations)
        reserved[effect.itemIndex]! += activations
      }
      if (activations) {
        jobs.push({ effect, count: activations * effect.copiesPerActivation })
      }
    }
    candidates = candidates.map((candidate) => ({
      ...candidate,
      copyCounts: reserved,
      cachedTransitionKey: initialTransitionKey,
    }))
    for (const { effect, count } of jobs) {
      const next: State[] = []
      for (const candidate of candidates) {
        const operation = effect.operation
        if (operation === 'skill_card_acquire') {
          const skill = fixedAcquiredSkills[effect.name as keyof typeof fixedAcquiredSkills]
          if (!skill) {
            throw new Error('固定獲得カードが未登録です。')
          }
          const acquired: Record<string, number> = {
            skill_acquire: count,
            mental_acquire: count,
            ssr_ineligible_acquire: count,
          }
          for (const keyword of skill.keywords)
            acquired[acquisitionKeywordTriggers[keyword]] = count
          next.push(...applyFiring(candidate, acquired))
          continue
        }
        if (
          operation === 'p_drink_acquire' ||
          operation === 'select_change' ||
          operation === 'random_trouble_delete'
        ) {
          const trigger =
            operation === 'select_change'
              ? 'skill_change'
              : operation === 'random_trouble_delete'
                ? 'skill_delete'
                : 'p_drink_acquire'
          next.push(...applyFiring(candidate, { [trigger]: count }))
          continue
        }
        const enhance = ['select_enhance', 'random_enhance', 'select_cards_enhance'].includes(
          String(operation),
        )
        const deletion = operation === 'select_delete'
        if (enhance || deletion) {
          const trigger = enhance ? 'skill_enhance' : 'skill_delete'
          const suffix = enhance ? 'enhance' : 'delete'
          const variants = enhance ? targetVariants.enhancement : targetVariants.deletion
          for (let active = 0; active <= (variants ? count : 0); active++)
            next.push(
              ...applyFiring(candidate, {
                [trigger]: count,
                [`active_${suffix}`]: active,
                [`mental_${suffix}`]: count - active,
              }),
            )
          continue
        }
        for (
          let activeAcquisitions = 0;
          activeAcquisitions <= (targetVariants.acquisition ? count : 0);
          activeAcquisitions++
        )
          for (const keywordAcquisitions of scoringKeywordAllocations(
            count,
            neededKeywords(candidate),
          )) {
            const acquired: Record<string, number> = {
              skill_acquire: count,
              active_acquire: activeAcquisitions,
              mental_acquire: count - activeAcquisitions,
            }
            if (operation !== 'select_copy') {
              acquired.ssr_ineligible_acquire = count
            }
            for (const [keyword, amount] of Object.entries(keywordAcquisitions))
              acquired[acquisitionKeywordTriggers[keyword as AcquisitionKeyword]] = amount
            const updated =
              operation === 'select_copy'
                ? {
                    ...candidate,
                    itemCopyChoices: [
                      ...candidate.itemCopyChoices,
                      {
                        itemIndex: effect.itemIndex,
                        actionIndex: effect.actionIndex,
                        count,
                        activeAcquisitions,
                        keywordAcquisitions,
                        ...(ssrContext
                          ? { ssrAcquisitions: ssrFromFiring(candidate.ssrCount, acquired) }
                          : {}),
                      },
                    ],
                  }
                : candidate
            next.push(...applyFiring(updated, acquired))
          }
      }
      candidates = next
    }
    return candidates
  }
  type Transition = {
    counts: number[]
    operations: number[]
    total: number
    ssrCount: number
    copies: ItemCopyChoice[]
    countsChanged: boolean
    operationsChanged: boolean
  }
  // 発動と残り上限を別々に引き、整数キーを毎回文字列へ結合し直さない。
  // 二段のMap全体で最大5000遷移を保持する。
  const transitionCache = new Map<string, Map<string | number, Transition[]>>()
  let transitionCacheSize = 0
  // falseは対象効果に関係しない発動。キーや遷移結果を作らずに再利用する。
  const firingKeys = new WeakMap<Record<string, number>, string | false>()
  const applyFiring = (state: State, firing: Record<string, number>): State[] => {
    let firingKey = firingKeys.get(firing)
    if (firingKey === false) {
      return [state]
    }
    if (firingKey === undefined) {
      if (!Object.entries(firing).some(([key, value]) => value > 0 && relevantFiring.has(key))) {
        firingKeys.set(firing, false)
        return [state]
      }
      firingKey = JSON.stringify(firing)
      firingKeys.set(firing, firingKey)
    }
    const key = transitionStateKey(state)
    let transitions = transitionCache.get(firingKey)
    const cached = transitions?.get(key)
    if (cached) {
      // カウンタとコピー履歴は不変。差分がない配列は元の参照を共有できる。
      return cached.map((delta) => ({
        ...state,
        counts: delta.countsChanged
          ? state.counts.map((count, i) => count + delta.counts[i]!)
          : state.counts,
        copyCounts: delta.operationsChanged
          ? state.copyCounts.map((count, i) => count + delta.operations[i]!)
          : state.copyCounts,
        total: state.total + delta.total,
        ssrCount: delta.ssrCount,
        cachedTransitionKey: initialTransitionKey,
        itemCopyChoices: delta.copies.length
          ? [...state.itemCopyChoices, ...delta.copies]
          : state.itemCopyChoices,
      }))
    }
    const result = applyUncachedFiring(state, firing)
    if (transitionCacheSize < 5000 && result.length < 100) {
      if (!transitions) {
        transitions = new Map()
        transitionCache.set(firingKey, transitions)
      }
      transitionCacheSize++
      transitions.set(
        key,
        result.map((next) => ({
          counts: next.counts.map((count, i) => count - state.counts[i]!),
          operations: next.copyCounts.map((count, i) => count - state.copyCounts[i]!),
          total: next.total - state.total,
          ssrCount: next.ssrCount,
          copies: next.itemCopyChoices.slice(state.itemCopyChoices.length),
          countsChanged: next.counts.some((count, i) => count !== state.counts[i]),
          operationsChanged: next.copyCounts.some((count, i) => count !== state.copyCounts[i]),
        })),
      )
    }
    return result
  }
  const applyExamDeletions = (before: State, day: number): State[] => {
    const reward = examDeletionsByDay.get(day)
    if (!reward) {
      return [before]
    }
    // 合計4枚の任意の種別配分は、初期7枚・各種2～5枚の範囲で実現できる。
    // 相談等の削除対象は基本カードに限定されないため、その枚数とは分離する。
    const candidates: State[] = []
    for (let active = 0; active <= (targetVariants.deletion ? reward.count : 0); active++) {
      const firing = {
        skill_delete: reward.count,
        active_delete: active,
        mental_delete: reward.count - active,
      }
      candidates.push(
        ...applyFiring(before, firing).map((after) =>
          withHistory(before, after, { kind: 'exam_deletion', ...reward }, firing),
        ),
      )
    }
    return candidates
  }
  let states = new Map<string | number, State>([
    [
      '',
      {
        total: 0,
        counts: effects.map(() => 0),
        canRest: false,
        refreshesUsed: 0,
        eventChoices: [],
        copyCounts: (card.effects.produce_item ?? []).map(() => 0),
        itemCopyChoices: [],
        ssrCount: 0,
        cachedTransitionKey: initialTransitionKey,
        path: undefined,
        history: undefined,
        lessonCounts: conditions ? emptyTypeScores() : undefined,
        actionCounts: requestedActions ? {} : undefined,
      },
    ],
  ])
  const ownGrant = getSkillGrant(card)
  const skillGrants = ownGrant ? [ownGrant] : []
  const grantFiring: Record<string, number> = {}
  for (const grant of skillGrants)
    for (const [trigger, count] of Object.entries(grant.firing))
      grantFiring[trigger] = (grantFiring[trigger] ?? 0) + count
  if (skillGrants.length) {
    const next = new Map<string | number, State>()
    for (const state of states.values())
      for (const activated of applyFiring(state, grantFiring)) {
        const key = stateKey(activated)
        if (!next.has(key) || next.get(key)!.total < activated.total) {
          next.set(
            key,
            withHistory(
              state,
              activated,
              {
                kind: 'skill_grants',
                cardIds: skillGrants.map((grant) => grant.cardId),
                skillNames: skillGrants.map((grant) => grant.name),
              },
              grantFiring,
            ),
          )
        }
      }
    states = next
  }
  for (let day = 1; day <= hifDayCount; day++) {
    const next = new Map<string | number, State>()
    const actionCache = new Map<string, { action: HifAction; firing: Record<string, number> }[]>()
    const hasExamDeletion = examDeletionsByDay.has(day)
    const fixedLessonType = conditions?.spLessonDays?.[day]
    const preparedActions = (state: State) => {
      const { variants, keywords, key: preparationKey } = preparationFor(state)
      const refreshAvailable = state.refreshesUsed < consultationRefreshLimit
      const key = `${state.canRest ? 1 : 0}:${refreshAvailable ? 1 : 0}:${preparationKey}`
      let prepared = actionCache.get(key)
      if (!prepared) {
        prepared = getHifActions(
          day,
          state.path?.choice,
          refreshAvailable,
          variants,
          keywords,
          normalizedConditions?.operationSettings,
        )
          .filter(
            (action) =>
              !(
                conditions &&
                lessons.has(day) &&
                (action.kind !== 'lesson' || action.lessonKind !== 'sp')
              ) &&
              (!fixedLessonType || action.main === fixedLessonType),
          )
          .map((action) => ({
            action,
            firing: activations(action, day, normalizedConditions?.operationSettings),
          }))
        // 得点への発動機会と将来の制約が同じ候補は、最初の1つだけ残す。
        // 同点時の日程・発動根拠の選択順も維持する。
        const seen = new Set<string>()
        prepared = prepared.filter(({ action, firing }) => {
          const firingKey = actionFiringTriggers.map((trigger) => firing[trigger] ?? 0).join(',')
          const identity = JSON.stringify([
            actionAllowsRest(action.kind),
            action.consultationRefresh === true,
            conditions && action.kind === 'lesson' ? action.main : '',
            constrainedActions.includes(action.kind as (typeof configurableActions)[number])
              ? action.kind
              : '',
            firingKey,
          ])
          if (seen.has(identity)) {
            return false
          }
          seen.add(identity)
          return true
        })
        actionCache.set(key, prepared)
      }
      return prepared
    }
    for (const state of states.values()) {
      for (const { action, firing } of preparedActions(state)) {
        let lessonCounts = state.lessonCounts
        if (lessonCounts && action.kind === 'lesson') {
          lessonCounts = { ...lessonCounts, [action.main!]: lessonCounts[action.main!] + 1 }
        }
        if (conditions && lessonCounts) {
          const remaining = remainingLessonsByDay[day]!
          const needed = types.reduce(
            (sum, type) => sum + Math.max(0, conditions.spLessons[type] - lessonCounts[type]),
            0,
          )
          if (needed > remaining) {
            continue
          }
        }
        let actionCounts = state.actionCounts
        if (
          actionCounts &&
          constrainedActions.includes(action.kind as (typeof configurableActions)[number])
        ) {
          const key = action.kind as (typeof configurableActions)[number]
          actionCounts = { ...actionCounts, [key]: (actionCounts[key] ?? 0) + 1 }
        }
        if (
          canFinishActions &&
          !canFinishActions(day + 1, actionAllowsRest(action.kind), actionCounts!)
        ) {
          continue
        }
        const firedStates = applyFiring(state, firing)
        const activatedStates = hasExamDeletion
          ? firedStates.flatMap((after) =>
              applyExamDeletions(
                withHistory(state, after, { kind: 'day', choice: { day, ...action } }, firing),
                day,
              ),
            )
          : firedStates
        for (const activated of activatedStates) {
          const { total, counts } = activated
          const canRest = actionAllowsRest(action.kind)
          const refreshesUsed = state.refreshesUsed + (action.consultationRefresh ? 1 : 0)
          // 上限のない発動回数は累積点へ影響するが、今後の発動機会は変えない。
          // 内訳には実際の回数を保持しつつ、将来が同じ状態は統合する。
          const key = stateKey(activated, canRest, refreshesUsed, lessonCounts, actionCounts)
          const previous = next.get(key)
          if (!previous || previous.total < total) {
            next.set(key, {
              // 通常日の履歴は、保持する候補だけに作る。
              // 試験後削除がある日は上で日→削除の順に履歴を連結済み。
              ...(hasExamDeletion
                ? activated
                : withHistory(
                    state,
                    activated,
                    { kind: 'day', choice: { day, ...action } },
                    firing,
                  )),
              total,
              counts,
              ...(lessonCounts ? { lessonCounts } : {}),
              ...(actionCounts ? { actionCounts } : {}),
              canRest,
              refreshesUsed,
              eventChoices: state.eventChoices,
              path: {
                previous: state.path,
                choice: {
                  day,
                  ...action,
                  ...(ssrContext ? { ssrAcquisitions: ssrFromFiring(state.ssrCount, firing) } : {}),
                },
              },
            })
          }
        }
      }
    }
    states = next
  }
  if (!states.size) {
    throw new Error('指定した行動回数を満たす日程がありません。')
  }
  const { events, pendingEventIndexes } = getSupportEventOperations(card)
  for (const options of events) {
    const next = new Map<string | number, State>()
    for (const state of states.values())
      for (const event of options)
        for (const activated of applyFiring(state, event.firing)) {
          const updated = {
            ...withHistory(state, activated, { kind: 'support_event', event }, event.firing),
            eventChoices: [...state.eventChoices, event],
          }
          const key = stateKey(updated)
          if (!next.has(key) || next.get(key)!.total < updated.total) {
            next.set(key, updated)
          }
        }
    states = next
  }
  const acquisitionStates = new Map<string | number, State>()
  for (const state of states.values())
    for (const updated of applyFiring(state, { p_item_acquire: pItemAcquisitionLimit })) {
      const key = stateKey(updated)
      if (!acquisitionStates.has(key) || acquisitionStates.get(key)!.total < updated.total) {
        acquisitionStates.set(
          key,
          withHistory(
            state,
            updated,
            { kind: 'p_item_acquire' },
            { p_item_acquire: pItemAcquisitionLimit },
          ),
        )
      }
    }
  states = acquisitionStates
  const parameterScores = new Map<string, number>()
  const parameterScore = (state: State) => {
    if (!conditions) {
      return 0
    }
    // 同じSP配分のパラボは、獲得や行動の履歴が違っても同じ。
    const key = types.map((type) => state.lessonCounts![type]).join(',')
    let score = parameterScores.get(key)
    if (score === undefined) {
      score = calculateParameterBonusSubtotal(
        card,
        limit,
        parameterBasesForConditions(normalizedConditions, state.lessonCounts),
      ).total
      parameterScores.set(key, score)
    }
    return score
  }
  const best = [...states.values()].reduce((best, state) =>
    state.total + parameterScore(state) > best.total + parameterScore(best) ? state : best,
  )
  const byType = emptyTypeScores()
  const choices: HifScheduleChoice[] = []
  for (let node = best.path; node; node = node.previous) choices.push(node.choice)
  choices.reverse()
  const history: History[] = []
  for (let node = best.history; node; node = node.previous) history.push(node)
  const activationsByEffect = new Map<number, ActivationEvidence[]>()
  for (const node of history.reverse()) {
    const countedFiring: Record<string, number> = {
      ...node.firing,
      skill_ssr_acquire: ssrFromFiring(node.beforeSsrCount, node.firing),
    }
    effects.forEach((effect, effectIndex) => {
      const opportunities =
        'enhancementKeyword' in effect && effect.enhancementKeyword
          ? (countedFiring.skill_enhance ?? 0)
          : (countedFiring[effect.trigger] ?? 0)
      const count = node.afterCounts[effectIndex]! - node.beforeCounts[effectIndex]!
      if (!opportunities && !count) {
        return
      }
      const directCount = Math.min(
        opportunities,
        Math.max(0, effect.cap - node.beforeCounts[effectIndex]!),
      )
      const activation: ActivationEvidence = {
        source: node.source,
        firing: node.firing,
        opportunities,
        count,
        directCount,
        itemCount: count - directCount,
      }
      const entries = activationsByEffect.get(effectIndex) ?? []
      entries.push(activation)
      activationsByEffect.set(effectIndex, entries)
    })
  }
  const produceItemBreakdown: HifScheduleSubtotal['produceItemBreakdown'] = []
  const breakdown = effects.flatMap((effect, index) => {
    const count = best.counts[index]!
    const targets = scoreTargets(String(effect.type))
    for (const target of targets) byType[target] += effect.value * count
    if (effect.category === 'produce_item') {
      produceItemBreakdown.push({
        itemIndex: effect.itemIndex,
        actionIndex: effect.actionIndex,
        trigger: effect.trigger,
        activations: activationsByEffect.get(index) ?? [],
        value: effect.value,
        count,
        total: effect.value * count * targets.length,
      })
      return []
    }
    return [
      {
        abilityIndex: effect.abilityIndex,
        trigger: effect.trigger,
        activations: activationsByEffect.get(index) ?? [],
        value: effect.value,
        count,
        total: effect.value * count * targets.length,
      },
    ]
  })
  return {
    ...(conditions ? { lessonCounts: best.lessonCounts! } : {}),
    ...(requestedActions
      ? {
          actionCounts: Object.fromEntries(
            configurableActions.map((key) => [
              key,
              choices.filter((choice) => choice.kind === key).length,
            ]),
          ) as Record<(typeof configurableActions)[number], number>,
        }
      : {}),
    total: best.total,
    byType,
    choices,
    eventChoices: best.eventChoices,
    breakdown,
    pendingAbilityIndexes,
    pendingEventIndexes,
    produceItemBreakdown,
    pendingItemActions: items.pendingActions,
    zeroScoreItemActions: items.zeroScoreActions,
    itemCopyChoices: best.itemCopyChoices,
    skillGrants,
    pendingSkillGrants: [
      ...(card.tag === 'skill' && !ownGrant ? [card.id] : []),
      ...skillGrants
        .filter((grant) => grant.uncertainKeywords.length > 0)
        .map((grant) => grant.cardId),
    ],
    itemOperationCounts: [...new Set(items.operationEffects.map((effect) => effect.itemIndex))].map(
      (itemIndex) => ({ itemIndex, activationCount: best.copyCounts[itemIndex]! }),
    ),
    ...(ssrContext
      ? {
          ssrAcquisition: {
            plan: ssrContext.plan,
            limit: ssrContext.acquisitionCount,
            count: best.ssrCount,
          },
        }
      : {}),
  }
}
