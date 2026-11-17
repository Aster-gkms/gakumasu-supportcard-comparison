import {
  consultationOperations,
  consultationOperationsForDay,
  specialTrainingCustomizationLimit,
  intervalCustomizationLimit,
} from '../scoringConfig.ts'

export const operationSettingFields = [
  {
    key: 'consultation_drinks',
    label: 'ドリンク交換',
    max: consultationOperations.p_drink_acquire,
    unit: '個',
    group: 'consultation',
  },
  {
    key: 'consultation_cards',
    label: 'カード購入',
    max: consultationOperations.skill_acquire,
    unit: '枚',
    group: 'consultation',
  },
  {
    key: 'consultation_enhancements',
    label: '強化',
    max: consultationOperations.skill_enhance,
    unit: '枚',
    group: 'consultation',
  },
  {
    key: 'consultation_deletions',
    label: '削除',
    max: consultationOperations.skill_delete,
    unit: '枚',
    group: 'consultation',
  },
  {
    key: 'special_training_customizations',
    label: '特別指導のカスタマイズ',
    max: specialTrainingCustomizationLimit,
    unit: '回',
    group: 'special_training',
  },
  {
    key: 'interval_customizations',
    label: 'インターバルのカスタマイズ',
    max: intervalCustomizationLimit,
    unit: '回',
    group: 'special_training',
  },
] as const
export type OperationSettingKey = (typeof operationSettingFields)[number]['key']
export type OperationSettings = Partial<Record<OperationSettingKey, number>>
export function operationSettingValue(
  settings: OperationSettings,
  key: OperationSettingKey,
): number {
  return settings[key] ?? operationSettingFields.find((field) => field.key === key)!.max
}
export function normalizeOperationSettings(
  settings?: OperationSettings,
): OperationSettings | undefined {
  const normalized: OperationSettings = {}
  for (const [key, value] of Object.entries(settings ?? {})) {
    const field = operationSettingFields.find((field) => field.key === key)
    if (!field || !Number.isInteger(value) || value < 0 || value > field.max) {
      throw new Error('相談・カスタマイズの操作数が指定可能な範囲外です。')
    }
  }
  for (const field of operationSettingFields) {
    const value = settings?.[field.key]
    if (value !== undefined && value !== field.max) {
      normalized[field.key] = value
    }
  }
  return Object.keys(normalized).length ? normalized : undefined
}
export function consultationOperationsForSettings(day: number, settings?: OperationSettings) {
  const base = consultationOperationsForDay(day)
  return {
    ...base,
    p_drink_acquire: settings?.consultation_drinks ?? base.p_drink_acquire,
    skill_acquire: settings?.consultation_cards ?? base.skill_acquire,
    skill_enhance: settings?.consultation_enhancements ?? base.skill_enhance,
    skill_delete: settings?.consultation_deletions ?? base.skill_delete,
  }
}
