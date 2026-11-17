import text from './produceItemText.json' with { type: 'json' }
import type { ProduceItemPart } from './cards'

const keyword = text.keyword as Record<string, string>
const typeNames: Record<string, string> = { vo: 'ボーカル', da: 'ダンス', vi: 'ビジュアル' }
const actions: Record<string, string> = {
  ...text.action,
  status_add: '{{param}}上昇+{{value}}',
  point_add: 'Pポイント+{{value}}',
  select_copy: 'スキルカードを選択してコピー',
  random_trouble_delete: 'ランダムなトラブルカードを削除',
  skill_card_acquire: '{{name}}を獲得',
  next_turn_debuff_null: '次のターン、低下状態無効{{count}}回',
  keyword_decrease: '{{keyword}}減少{{value}}',
  hp_cost: '固定体力消費{{value}}',
  draw_card: 'スキルカードを引く',
  random_enhance_hand_during_lesson: 'ランダムな手札{{count}}枚をレッスン中強化',
}

export function itemPartText(
  part: ProduceItemPart,
  section: 'trigger' | 'condition' | 'restriction' | 'action',
): string {
  if (section === 'action' && part.kind === 'p_drink_acquire') {
    return part.name
      ? `${part.name}を${part.count}個獲得`
      : `ランダムなPドリンク${part.min_rarity ? `（${part.min_rarity}以上）` : ''}を${part.count}個獲得`
  }
  if (section === 'action' && part.kind === 'move_card_to_hand') {
    return `ランダムな山札か捨札の${part.keyword ? `${keyword[String(part.keyword)]}効果の` : ''}スキルカード${part.rarity ? `（${part.rarity}）` : ''}を手札に移動`
  }
  const templates: Record<string, string> = section === 'action' ? actions : text[section]
  const template = templates[part.kind]
  if (template === undefined) {
    return `未対応の表示：${part.kind}`
  }
  const params: Record<string, unknown> = { ...part, param: typeNames[String(part.type)] }
  for (const key of ['keyword', 'keyword2', 'keyword3'])
    if (part[key] !== undefined) {
      params[key] = keyword[String(part[key])]
    }
  let result = template.replace(/\{\{\s*(\w+)\s*\}\}/gu, (_, key: string) =>
    String(params[key] ?? '記載なし'),
  )
  if (part.kind === 'keyword_up' && part.multiplier !== undefined) {
    result += `（${keyword[String(part.multiplier_keyword)]}効果を${part.multiplier}倍適用）`
  }
  result = result.replace(/、$/u, '')
  return result
    .replace(/全力値減少/gu, '全力値低下')
    .replace(/(絶好調|好調|集中|好印象|やる気)減少/gu, '$1消費')
}
