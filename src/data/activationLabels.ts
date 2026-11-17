import type { ActivationEvidence } from '../scoring/activationEvidence.ts'
import { triggerLabels } from './effectLabels.ts'

const actions: Record<string, string> = {
  lesson: '公開レッスン',
  class: '授業',
  consultation: '相談',
  activity_supply: '差し入れ',
  outing_end: 'おでかけ',
  special_training: '特別指導',
  selection_exam: '選抜試験',
  final_round: '本戦ラウンド',
  interval: 'インターバル',
  rest: '休む',
}

export function activationEvidenceLabel(
  entry: ActivationEvidence,
  trigger: string,
  triggerText?: string,
): string {
  const { source, firing, opportunities, count, directCount, itemCount } = entry
  let location: string
  if (source.kind === 'day') {
    const choice = source.choice
    const day = choice.day <= 20 ? `選抜${choice.day}日目` : `本戦${choice.day - 20}日目`
    const lesson =
      choice.kind === 'lesson'
        ? `（${choice.main?.toUpperCase()}・${choice.lessonKind === 'sp' ? 'SP' : '通常'}）`
        : ''
    location = `${day}・${actions[choice.kind]}${lesson}${choice.consultationRefresh ? '（リフレッシュ使用）' : ''}`
  } else if (source.kind === 'exam_deletion') {
    location = `選抜${source.day}日目・選抜試験${source.examNumber}終了後：基本カード${source.count}枚削除`
    if (['active_delete', 'mental_delete'].includes(trigger)) {
      location += `（アクティブ${firing.active_delete ?? 0}枚・メンタル${firing.mental_delete ?? 0}枚）`
    }
  } else if (source.kind === 'support_event') {
    location = 'サポートイベント（日付未固定）'
  } else if (source.kind === 'skill_grants') {
    location = `${source.skillNames?.length ? source.skillNames.map((name) => `「${name}」`).join('・') : 'スキルカード'}の獲得（日付未固定）`
  } else {
    location = '育成全体のPアイテム獲得（日付未固定）'
  }
  let operation = ''
  if (source.kind === 'day' && source.choice.kind === 'consultation') {
    if (['p_drink_acquire', 'consultation_drink'].includes(trigger)) {
      operation = `Pドリンクを${firing.consultation_drink ?? firing.p_drink_acquire ?? 0}個交換`
    } else if (['skill_acquire', 'consultation_skill_acquire'].includes(trigger)) {
      operation = `スキルカードを${firing.consultation_skill_acquire ?? 0}枚交換`
    }
  }
  const operations: Record<string, [string, string]> = {
    p_drink_acquire: ['Pドリンク獲得', '個'],
    p_item_acquire: ['Pアイテム獲得', '個'],
    skill_acquire: ['スキルカード獲得', '枚'],
    skill_ssr_acquire: ['SSRスキルカード獲得', '枚'],
    active_acquire: ['アクティブスキルカード獲得', '枚'],
    mental_acquire: ['メンタルスキルカード獲得', '枚'],
    skill_enhance: ['スキルカード強化', '枚'],
    active_enhance: ['アクティブスキルカード強化', '枚'],
    mental_enhance: ['メンタルスキルカード強化', '枚'],
    skill_delete: ['スキルカード削除', '枚'],
    active_delete: ['アクティブスキルカード削除', '枚'],
    mental_delete: ['メンタルスキルカード削除', '枚'],
    skill_change: ['スキルカードチェンジ', '枚'],
    skill_custom: ['カスタマイズ', '回'],
  }
  const lessonEnd =
    source.kind === 'day' &&
    source.choice.kind === 'lesson' &&
    /^(?:(?:vo|da|vi)_)?(?:lesson|normal|sp)_end$/.test(trigger)
  if (!operation && opportunities && !lessonEnd && source.kind !== 'exam_deletion') {
    const detail = operations[trigger]
    if (detail) {
      operation = `${detail[0]}${opportunities}${detail[1]}`
    } else if (trigger.endsWith('_acquire')) {
      operation = `${(triggerText ?? triggerLabels[trigger] ?? trigger).replace(/時$/, '')}${opportunities}枚`
    } else {
      operation = `${triggerText ?? triggerLabels[trigger] ?? actions[trigger] ?? trigger}の機会${opportunities}回`
    }
  }
  const counted = itemCount
    ? `直接${directCount}回 ＋ Pアイテムの追加効果${itemCount}回 ＝ ${count}回発動`
    : `${count}回発動`
  const capped =
    directCount < opportunities
      ? `（発動上限により${opportunities - directCount}回は加算なし）`
      : ''
  return `${location}${operation ? `：${operation}` : ''} → ${counted}${capped}`
}
