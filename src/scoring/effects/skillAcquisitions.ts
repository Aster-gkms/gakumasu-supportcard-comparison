// 行動共通の獲得キーワード。枚数の割当と16枚上限の判定で同じ定義を使う。
export const acquisitionKeywordTriggers = {
  reserve: 'conserve_acquire',
  good_condition: 'good_condition_acquire',
  good_impression: 'good_impression_acquire',
  concentration: 'concentrate_acquire',
  motivation: 'motivation_acquire',
  vitality: 'genki_acquire',
  full_power: 'full_power_acquire',
  aggressive: 'aggressive_acquire',
} as const
export type AcquisitionKeyword = keyof typeof acquisitionKeywordTriggers
export type KeywordAcquisitions = Partial<Record<AcquisitionKeyword, number>>

// 通常カードだけが種別・キーワードを持つ。眠気は呼出側で汎用獲得だけに加算する。
export function skillAcquisitionActivations(
  capacity: number,
  activeAcquisitions: number,
  keywordAcquisitions: KeywordAcquisitions,
): Record<string, number> {
  if (
    !Number.isInteger(activeAcquisitions) ||
    activeAcquisitions < 0 ||
    activeAcquisitions > capacity
  ) {
    throw new Error('アクティブ獲得枚数が通常カードの獲得枚数を超えているか、不正です。')
  }
  let keywordCount = 0
  const keywordTriggers: Record<string, number> = {}
  for (const [keyword, count] of Object.entries(keywordAcquisitions)) {
    if (
      !Object.hasOwn(acquisitionKeywordTriggers, keyword) ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      throw new Error('獲得キーワードまたは枚数が不正です。')
    }
    keywordCount += count
    keywordTriggers[acquisitionKeywordTriggers[keyword as AcquisitionKeyword]] = count
  }
  if (keywordCount > capacity) {
    throw new Error('キーワード獲得枚数が通常カードの獲得枚数を超えています。')
  }
  return {
    active_acquire: activeAcquisitions,
    mental_acquire: capacity - activeAcquisitions,
    ...keywordTriggers,
  }
}

// 各キーワードに独立した購入枠を与えず、実際の獲得枚数を分け合う。
export function getKeywordAllocations(
  count: number,
  requested: readonly AcquisitionKeyword[],
  fullyAssigned = false,
): KeywordAcquisitions[] {
  const keywords = [...new Set(requested)]
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    keywords.some((key) => !Object.hasOwn(acquisitionKeywordTriggers, key))
  ) {
    throw new Error('購入枚数またはキーワードが不正です。')
  }
  const results: KeywordAcquisitions[] = []
  const visit = (index: number, remaining: number, allocation: KeywordAcquisitions) => {
    if (index === keywords.length) {
      results.push(allocation)
      return
    }
    const keyword = keywords[index]!
    // 全枚数を割り当てる場合、最後のキーワードへ残りを渡す。
    const minimum = fullyAssigned && index === keywords.length - 1 ? remaining : 0
    for (let amount = minimum; amount <= remaining; amount++) {
      visit(index + 1, remaining - amount, { ...allocation, [keyword]: amount })
    }
  }
  visit(0, count, {})
  return results
}
