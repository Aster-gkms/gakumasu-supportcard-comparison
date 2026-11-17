// 表示用の名称。YAMLの識別名や効果の計算条件は変更しない。
export const effectValueLabels: Record<string, string> = {
  skill_card_grant: 'スキルカード獲得',
  produce_item_grant: 'Pアイテム獲得',
  exam_item_grant: 'コンテストアイテム獲得',
  point_add: 'Pポイント加算',
  status_add: '実数値加算',
  param_bonus: 'パラメータボーナス',
  sp_rate: 'SPレッスン発生率の補正',
  event_param_boost: 'サポートイベントのパラメータ上昇量増加',
  trigger_count_bonus: '発動回数の増加',
  support_rate_bonus: 'スキルカードサポート発生率の増加',
  skill_enhance: 'スキルカード強化',
  skill_change: 'スキルカードチェンジ',
  skill_delete: 'スキルカード削除',
  hp_recovery: '体力回復',
  max_hp_add: '最大体力上昇',
  point_gain_boost: 'Pポイント獲得量増加',
  event_hp_boost: 'サポートイベントの体力回復量増加',
  event_point_boost: 'サポートイベントの獲得Pポイント増加',
  p_drink_discount: '相談のPドリンク割引',
}

export function effectUnit(effect: Record<string, unknown>): string {
  return effect.unit === '%' ||
    ['param_bonus', 'support_rate_bonus', 'event_param_boost', 'sp_rate'].includes(
      String(effect.value_type),
    )
    ? '%'
    : ''
}

export function effectTiming(effect: Record<string, unknown>): string {
  if (effect.value_type === 'p_drink_discount') {
    return '常時（相談のPドリンクに適用）'
  }
  if (['event_hp_boost', 'event_point_boost'].includes(String(effect.value_type))) {
    return 'このカードのサポートイベント発生時'
  }
  return triggerLabels[String(effect.trigger)] ?? String(effect.trigger)
}

export function effectName(effect: Record<string, unknown>, category: string): string {
  if (
    category === 'support_ability' &&
    effect.trigger === 'produce_start' &&
    effect.value_type === 'status_add'
  ) {
    return '初期実数値加算'
  }
  if (effect.value_type === 'point_add' && effect.trigger === 'produce_start') {
    return '初期Pポイント加算'
  }
  return effectValueLabels[String(effect.value_type)] ?? String(effect.value_type)
}

export const triggerLabels: Record<string, string> = {
  produce_start: 'プロデュース開始時',
  equip: '常時',
  lesson_end: 'レッスン終了時',
  sp_end: 'SPレッスン終了時',
  vo_sp_end: 'VoのSPレッスン終了時',
  da_sp_end: 'DaのSPレッスン終了時',
  vi_sp_end: 'ViのSPレッスン終了時',
  vo_lesson_end: 'Voレッスン終了時',
  da_lesson_end: 'Daレッスン終了時',
  vi_lesson_end: 'Viレッスン終了時',
  vo_normal_end: 'Voの通常レッスン終了時',
  da_normal_end: 'Daの通常レッスン終了時',
  vi_normal_end: 'Viの通常レッスン終了時',
  exam_end: '試験・オーディション終了時',
  class_end: '授業・営業終了時',
  outing_end: 'おでかけ終了時',
  consultation: '相談選択時',
  consultation_drink: '相談でPドリンク交換時',
  consultation_skill_acquire: '相談でスキルカード交換後',
  activity_supply: '活動支給・差し入れ選択時',
  special_training: '特別指導開始時',
  rest: '休む選択時',
  skill_acquire: 'スキルカード獲得時',
  skill_ssr_acquire: 'SSRスキルカード獲得時',
  skill_enhance: 'スキルカード強化時',
  skill_delete: 'スキルカード削除時',
  skill_change: 'スキルカードチェンジ時',
  skill_custom: 'スキルカードカスタマイズ時',
  active_acquire: 'アクティブスキルカード獲得時',
  active_enhance: 'アクティブスキルカード強化時',
  active_delete: 'アクティブスキルカード削除時',
  mental_acquire: 'メンタルスキルカード獲得時',
  mental_enhance: 'メンタルスキルカード強化時',
  mental_delete: 'メンタルスキルカード削除時',
  p_item_acquire: 'Pアイテム獲得時',
  p_drink_acquire: 'Pドリンク獲得時',
  genki_acquire: '元気効果のスキルカード獲得時',
  good_condition_acquire: '好調効果のスキルカード獲得時',
  good_impression_acquire: '好印象効果のスキルカード獲得時',
  conserve_acquire: '温存効果のスキルカード獲得時',
  concentrate_acquire: '集中効果のスキルカード獲得時',
  motivation_acquire: 'やる気効果のスキルカード獲得時',
  full_power_acquire: '全力効果のスキルカード獲得時',
  aggressive_acquire: '強気効果のスキルカード獲得時',
}
