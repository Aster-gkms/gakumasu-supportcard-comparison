import type { SupportCard, ProduceItemPart } from '../../data/cards.ts'
import { acquisitionKeywordTriggers, type AcquisitionKeyword } from './skillAcquisitions.ts'
import { acquisitionActivationLimit } from './acquisitionLimits.ts'
import { fixedAcquiredSkills } from './acquiredSkills.ts'

export const produceItemScoreAssumption =
  'Pアイテムのレッスン中スコア効果は0点とし、ステータス加算は発動条件を満たす前提で計算しています'

export interface ProduceItemScoreEffect {
  itemIndex: number
  actionIndex: number
  trigger: string
  type: string
  value: number
  cap: number
  enhancementKeyword?: string
}
export interface ItemActionReference {
  itemIndex: number
  actionIndex: number
}

export interface ProduceItemOperationEffect extends ItemActionReference {
  trigger: string
  cap: number
  copiesPerActivation: number
  enhancementKeyword?: string
  operation?: string
  name?: string
}

const lessonScoreActionKinds = new Set([
  'cost_reduce',
  'fixed_keyword_up',
  'next_turn_debuff_null',
  'keyword_turns',
  'keyword_decrease',
  'parameter_up',
  'keyword_pct_param_up',
  'keyword_up',
  'hp_cost_reduce_turns',
  'keyword_increase_boost',
  'move_card_to_hand',
  'param_up_boost',
  'enthusiasm_add',
  'extra_card_use',
  'draw_card',
  'move_idol_hand',
  'random_enhance_hand_during_lesson',
  'generate_card',
  'keyword_enhance_pct',
  'active_card_param_boost',
])
const resourceActionKinds = new Set([
  'hp_recovery',
  'point_add',
  'hp_cost',
  'max_hp_pct_recovery',
  'consult_discount',
  'special_training_customize_discount',
])

function itemTrigger(
  trigger: ProduceItemPart,
): { trigger: string; enhancementKeyword?: string } | undefined {
  const simple: Record<string, string> = {
    special_training_start: 'special_training',
    exam_start: 'exam_start',
    exam_end: 'exam_end',
    consult_selection: 'consultation',
    activity_supply_gift_selection: 'activity_supply',
    outing_end: 'outing_end',
    class_work_end: 'class_end',
    skill_change: 'skill_change',
    skill_acquire: 'skill_acquire',
  }
  if (simple[trigger.kind]) {
    return { trigger: simple[trigger.kind]! }
  }
  if (
    ['param_sp_lesson_end', 'param_lesson_end'].includes(trigger.kind) &&
    ['vo', 'da', 'vi'].includes(String(trigger.type))
  ) {
    return {
      trigger: `${trigger.type}_${trigger.kind === 'param_sp_lesson_end' ? 'sp' : 'lesson'}_end`,
    }
  }
  if (Object.hasOwn(acquisitionKeywordTriggers, String(trigger.keyword))) {
    const keyword = trigger.keyword as AcquisitionKeyword
    if (trigger.kind === 'keyword_card_acquire') {
      return { trigger: acquisitionKeywordTriggers[keyword] }
    }
    if (trigger.kind === 'keyword_card_enhance') {
      return { trigger: `${keyword}_enhance`, enhancementKeyword: keyword }
    }
  }
  return undefined
}

export function prepareProduceItemScores(card: SupportCard): {
  effects: ProduceItemScoreEffect[]
  pendingActions: ItemActionReference[]
  zeroScoreActions: ItemActionReference[]
  operationEffects: ProduceItemOperationEffect[]
} {
  const effects: ProduceItemScoreEffect[] = []
  const pendingActions: ItemActionReference[] = []
  const zeroScoreActions: ItemActionReference[] = []
  const operationEffects: ProduceItemOperationEffect[] = []
  const enhancementKeywords = new Set(
    (card.effects.produce_item ?? [])
      .filter(
        (effect) =>
          effect.trigger.kind === 'keyword_card_enhance' &&
          effect.actions.some((action) => action.kind === 'status_add'),
      )
      .map((effect) => effect.trigger.keyword),
  )
  ;(card.effects.produce_item ?? []).forEach((effect, itemIndex) => {
    effect.actions.forEach((action, actionIndex) => {
      const reference = { itemIndex, actionIndex }
      if (lessonScoreActionKinds.has(action.kind)) {
        zeroScoreActions.push(reference)
        return
      }
      if (resourceActionKinds.has(action.kind)) {
        return
      }
      if (
        [
          'select_copy',
          'select_enhance',
          'random_enhance',
          'select_cards_enhance',
          'random_trouble_delete',
          'select_delete',
          'select_change',
          'p_drink_acquire',
          'random_skill_card_r_acquire',
          'select_skill_card_r_acquire',
          'skill_card_acquire',
        ].includes(action.kind)
      ) {
        const mapped = itemTrigger(effect.trigger)
        const copiesPerActivation = action.count ?? 1
        if (
          !mapped ||
          (action.kind === 'skill_card_acquire' &&
            !Object.hasOwn(fixedAcquiredSkills, String(action.name))) ||
          effect.restriction !== undefined ||
          (effect.count_scope !== undefined && effect.count_scope !== 'per_produce') ||
          (effect.max_count !== undefined &&
            (!Number.isInteger(effect.max_count) || Number(effect.max_count) <= 0)) ||
          (effect.max_count === undefined &&
            (action.kind === 'select_copy' ||
              [
                'skill_acquire',
                'keyword_card_acquire',
                'keyword_card_enhance',
                'skill_change',
              ].includes(effect.trigger.kind))) ||
          typeof copiesPerActivation !== 'number' ||
          !Number.isInteger(copiesPerActivation) ||
          copiesPerActivation <= 0
        ) {
          pendingActions.push(reference)
        } else {
          const prepared = {
            ...mapped,
            ...reference,
            cap: acquisitionActivationLimit(mapped.trigger, effect.max_count),
            copiesPerActivation,
            operation: action.kind,
            ...(typeof action.name === 'string' ? { name: action.name } : {}),
          }
          operationEffects.push(prepared)
        }
        return
      }
      if (action.kind !== 'status_add') {
        pendingActions.push(reference)
        return
      }
      const mapped = itemTrigger(effect.trigger)
      if (
        !mapped ||
        effect.restriction !== undefined ||
        (effect.count_scope !== undefined && effect.count_scope !== 'per_produce') ||
        (mapped.enhancementKeyword !== undefined && enhancementKeywords.size > 1) ||
        !['vo', 'da', 'vi', 'all'].includes(String(action.type)) ||
        typeof action.value !== 'number' ||
        !Number.isFinite(action.value) ||
        (effect.max_count !== undefined &&
          (!Number.isInteger(effect.max_count) || effect.max_count <= 0))
      ) {
        pendingActions.push(reference)
        return
      }
      effects.push({
        ...mapped,
        ...reference,
        type: String(action.type),
        value: action.value,
        cap: acquisitionActivationLimit(mapped.trigger, effect.max_count),
      })
    })
  })
  return { effects, pendingActions, zeroScoreActions, operationEffects }
}
