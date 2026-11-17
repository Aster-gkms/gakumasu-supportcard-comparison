import type { SupportCard } from '../../data/cards.ts'
import { isAttachmentGrant } from '../../data/supportEffectDescriptions.ts'

export const supportEventAssumption =
  'サポートイベントはそれぞれ育成中に1回、最も有利なタイミング・対象で発生する前提で計算しています'

export interface SupportEventChoice {
  eventIndex: number
  operation: 'skill_enhance' | 'skill_change' | 'skill_delete'
  target: 'active' | 'mental' | 'basic_skill_card' | 'trouble_card'
  firing: Record<string, number>
}

// Every own event occurs once. Random targets use the most favorable valid result.
export function getSupportEventOperations(card: SupportCard): {
  events: SupportEventChoice[][]
  pendingEventIndexes: number[]
} {
  const events: SupportEventChoice[][] = []
  const pendingEventIndexes: number[] = []
  card.effects.support_event.forEach((effect, eventIndex) => {
    // 付属物獲得は既存の専用処理で評価する。原文表示用の行から重複発動させない。
    if (isAttachmentGrant(effect)) {
      return
    }
    if (effect.trigger !== 'support_event') {
      return
    }
    const operation = effect.value_type
    if (['status_add', 'hp_recovery', 'point_add'].includes(String(operation))) {
      return
    }
    if (
      (operation === 'skill_enhance' || operation === 'skill_delete') &&
      effect.target === 'skill_card'
    ) {
      const suffix = operation === 'skill_enhance' ? 'enhance' : 'delete'
      events.push(
        (['active', 'mental'] as const).map((target) => ({
          eventIndex,
          operation,
          target,
          firing: { [operation]: 1, [`${target}_${suffix}`]: 1 },
        })),
      )
    } else if (operation === 'skill_change' && effect.target === 'basic_skill_card') {
      events.push([
        { eventIndex, operation, target: 'basic_skill_card', firing: { skill_change: 1 } },
      ])
    } else if (operation === 'skill_delete' && effect.target === 'trouble_card') {
      events.push([{ eventIndex, operation, target: 'trouble_card', firing: { skill_delete: 1 } }])
    } else {
      pendingEventIndexes.push(eventIndex)
    }
  })
  return { events, pendingEventIndexes }
}
