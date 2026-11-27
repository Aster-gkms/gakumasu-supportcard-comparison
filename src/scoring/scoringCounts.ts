// 日付・行動候補はscoringConfig.ts、カード固有の効果値・発動上限はdata/support-cards/で管理する。

// 差し入れ1回の報酬。skill_acquire / p_drink_acquireの発動回数へ使う。
// 評価の前提：PドリンクはSR以上、スキルカードの強化状態はランダム。
export const supplyRewards = {
  skillCards: 1, // 獲得する通常スキルカード：枚/回
  pDrinks: 1, // 獲得するPドリンク：個/回
} as const

// おでかけ1回の報酬。眠気は汎用獲得だけに数え、種別・キーワード獲得へ含めない。
export const outingRewards = {
  regularSkillCards: 2, // 最大点探索で獲得する通常スキルカード：枚/回
  sleepinessCards: 1, // 眠気ありの候補を選んだ場合の追加枚数：枚/回
  pDrinks: 1, // 獲得するPドリンク：個/回
} as const

// 授業・営業1回の選択報酬。獲得・チェンジは別候補で、同時には加算しない。
export const classRewards = {
  skillCards: 1, // 通常カード獲得の候補で得る枚数：枚/回
  changes: 1, // チェンジ候補で変更する枚数：枚/回（獲得扱いにはしない）
  sleepinessCards: 1, // 眠気付きチェンジで追加獲得する枚数：枚/回
} as const

export type ConsultationOperations = Record<
  'skill_enhance' | 'skill_delete' | 'p_drink_acquire' | 'skill_acquire',
  number
>

// 通常の相談1回の標準操作数。育成条件の入力上限と「自動」の標準値も共有する。
// 個別指定の0は操作なし。相談の行動回数自体は変わらない。
export const consultationOperations = {
  skill_enhance: 1, // スキルカード強化時（汎用/アクティブ/メンタル）：枚/相談
  skill_delete: 1, // スキルカード削除時（汎用/アクティブ/メンタル）：枚/相談
  p_drink_acquire: 4, // Pドリンク獲得時・相談のドリンク交換後：個/相談
  skill_acquire: 4, // スキルカード獲得時・相談のカード購入後：枚/相談
} as const

// リフレッシュは使用した相談だけ全操作数を倍にする。相談選択時の発動は1回のまま。
export const consultationRefreshLimit = 1 // 育成全体の使用可能回数：回/育成
export const consultationRefreshMultiplier = 2 // 使用した相談の操作数に掛ける倍率
export const consultationDrinkAcquisitionLimit = 16 // リフレッシュ込みの相談由来ドリンク：個/育成
// この上限へ差し入れ・おでかけ・Pアイテム由来のドリンクは含めない。

// 選抜試験1・2終了後に削除する基本カード。対象の日付はscoringConfig.tsで指定する。
export const selectionExamDeletionCount = 2 // 各対象試験の終了後に削除する枚数：枚/試験
export const basicSkillCards = {
  total: 7, // 初期基本スキルカードの合計：枚
  minPerType: 2, // 初期基本カードのアクティブ/メンタル各種の最低枚数：枚
  maxPerType: 5, // 初期基本カードのアクティブ/メンタル各種の最大枚数：枚
} as const

// カスタマイズ時（skill_custom）の操作数。特別指導とインターバルは別に指定できる。
export const specialTrainingCardLimit = 2 // 特別指導1回でカスタマイズするカード：枚/回
export const customizationsPerTrainingCard = 3 // そのカード1枚のカスタマイズ：操作/枚
export const specialTrainingCustomizationLimit =
  specialTrainingCardLimit * customizationsPerTrainingCard // 特別指導1回の合計：操作/回
export const intervalCustomizationLimit = 6 // インターバルの合計：操作/回

// 育成全体の発動機会。カード固有のmax_countが小さければそちらを優先する。
export const pItemAcquisitionLimit = 6 // Pアイテム獲得時（p_item_acquire）：個/育成
export const conditionalAcquisitionLimit = 16 // 種別・キーワード・SSRの条件ごとのスキル獲得：枚/育成
// 付属スキル・固定獲得・コピーも同じ獲得枠に含む。実際の獲得機会を超えて加算しない。
export const ssrAcquisitionLimits = {
  sense: 15, // センスのSSRスキル獲得時（skill_ssr_acquire）：枚/育成
  logic: 16, // ロジックのSSRスキル獲得時：枚/育成
  anomaly: 15, // アノマリーのSSRスキル獲得時：枚/育成
} as const
// SSR獲得時効果にはconditionalAcquisitionLimitも適用し、実際の獲得機会との小さい方を使う。
