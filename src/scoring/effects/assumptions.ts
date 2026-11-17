import type { SupportCard } from '../../data/cards.ts'
import { planLabels } from '../../data/cards.ts'
import { intervalCustomizationLimit, pItemAcquisitionLimit } from '../scoringConfig.ts'
import { getSsrAcquisitionContext } from './ssrAcquisition.ts'
import type { EvaluationPlan } from './ssrAcquisition.ts'
import { getSupportEventOperations, supportEventAssumption } from './supportEvents.ts'
import { produceItemScoreAssumption } from './produceItems.ts'
import { acquisitionActivationLimit } from './acquisitionLimits.ts'

const restAssumption =
  '「休む」はレッスン・授業・選抜試験を行った翌日の行動に代えて選べます。選抜試験・本戦ラウンド・インターバルでは選べません'

const conditionsSatisfiedAssumption =
  '最大点は効果の発動条件を満たしている前提で計算しています。発動回数の上限と行動の排他制約は維持します'

const resourcesAvailableAssumption =
  'Pポイント・体力の不足は考慮せず、設定された行動・交換回数をすべて実行可能として計算しています'

export function getScoreAssumptions(
  card: SupportCard,
  actualSsr?: { plan: EvaluationPlan; limit: number; count: number },
): string[] {
  const notes: string[] = [conditionsSatisfiedAssumption, resourcesAvailableAssumption]
  if (
    card.effects.support_ability.some((effect) =>
      Number.isFinite(acquisitionActivationLimit(String(effect.trigger))),
    ) ||
    card.effects.produce_item?.some((effect) => effect.trigger.kind === 'keyword_card_acquire')
  ) {
    notes.push(
      '種別・キーワード・レアリティ条件付きのスキルカード獲得時効果は、条件ごとに育成全体で最大16枚まで数えます。固有上限やSSRのプラン別上限が小さい場合はそちらを優先します',
    )
  }
  if (card.tag === 'skill') {
    notes.push(
      '付属スキルカードは基本的に強化済みを1枚獲得する前提です。獲得時効果を発動し、強化時効果は発動しません',
    )
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
