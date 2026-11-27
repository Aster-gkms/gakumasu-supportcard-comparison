import type { SupportCard } from '../../data/cards.ts'
import { planLabels } from '../../data/cards.ts'
import {
  intervalCustomizationLimit,
  pItemAcquisitionLimit,
  consultationDrinkAcquisitionLimit,
  conditionalAcquisitionLimit,
} from '../scoringConfig.ts'
import { getSsrAcquisitionContext } from './ssrAcquisition.ts'
import type { EvaluationPlan } from './ssrAcquisition.ts'
import { getSupportEventOperations, supportEventAssumption } from './supportEvents.ts'
import { produceItemScoreAssumption } from './produceItems.ts'
import { acquisitionActivationLimit } from './acquisitionLimits.ts'

const restAssumption = '「休む」はレッスン・授業・選抜試験を行った翌日に選ぶ形として計算しています'

const conditionsSatisfiedAssumption = '最大点は効果の発動条件を満たしている前提で計算しています'

const resourcesAvailableAssumption = 'Pポイント・体力の不足は考慮していません'

export function getScoreAssumptions(
  card: SupportCard,
  actualSsr?: { plan: EvaluationPlan; limit: number; count: number },
): string[] {
  const notes: string[] = [conditionsSatisfiedAssumption, resourcesAvailableAssumption]
  if (
    card.effects.support_ability.some((effect) =>
      ['consultation_drink', 'p_drink_acquire'].includes(String(effect.trigger)),
    )
  ) {
    notes.push(
      `相談で獲得するPドリンクは、リフレッシュ分を含め育成全体で最大${consultationDrinkAcquisitionLimit}個まで数えます`,
    )
  }
  if (
    card.effects.support_ability.some((effect) =>
      Number.isFinite(acquisitionActivationLimit(String(effect.trigger))),
    ) ||
    card.effects.produce_item?.some((effect) => effect.trigger.kind === 'keyword_card_acquire')
  ) {
    notes.push(
      `条件付きのスキルカード獲得時効果は、条件ごとに育成全体で最大${conditionalAcquisitionLimit}枚まで数えます`,
    )
  }
  if (card.tag === 'skill') {
    notes.push('サポートイベントによるスキルカードは基本的に強化済みを1枚獲得する前提です')
  }
  if (
    card.effects.support_ability.some(
      (effect) => effect.trigger === 'p_item_acquire' && effect.value_type === 'status_add',
    )
  ) {
    notes.push(
      `Pアイテム獲得時の発動機会を育成全体で${pItemAcquisitionLimit}回として計算しています`,
    )
  }
  if (card.effects.produce_item?.length) {
    notes.push(produceItemScoreAssumption)
  }
  if (getSupportEventOperations(card).events.length) {
    notes.push(supportEventAssumption)
  }
  if (
    card.effects.support_ability.some(
      (effect) => effect.trigger === 'skill_ssr_acquire' && effect.value_type === 'status_add',
    )
  ) {
    const context = getSsrAcquisitionContext(card)
    const plan = actualSsr?.plan ?? context.plan
    const acquisitionCount = actualSsr?.limit ?? context.acquisitionCount
    notes.push(
      actualSsr
        ? `SSRスキルカード獲得枚数を${actualSsr.count}枚として計算しています（${planLabels[plan]}、上限${acquisitionCount}枚）`
        : `SSRスキルカード獲得枚数の上限を${acquisitionCount}枚としています（${planLabels[plan]}）`,
    )
  }
  if (
    card.effects.support_ability.some(
      (effect) => effect.trigger === 'skill_custom' && effect.value_type === 'status_add',
    )
  ) {
    notes.push(
      `インターバルでのカスタマイズ回数を${intervalCustomizationLimit}回として計算しています`,
    )
  }
  if (
    card.effects.support_ability.some(
      (effect) => effect.trigger === 'rest' && effect.value_type === 'status_add',
    )
  ) {
    notes.push(restAssumption)
  }
  return notes
}
