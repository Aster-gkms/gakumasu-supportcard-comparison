// スキルカードの動作に影響するので例外として個別記載。
export const fixedAcquiredSkills = {
  'ハッピー♪': {
    plan: 'anomaly',
    rarity: 'R',
    type: 'mental',
    enhanced: false,
    keywords: ['reserve', 'vitality'],
    base: { policy: 'reserve', vitality: 7, cost: -3 },
    enhancedVariant: { policy: 'reserve', vitality: 10, cost: -2 },
  },
} as const
