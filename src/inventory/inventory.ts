import type { SupportCard } from '../data/cards.ts'

export type InventoryLimit = number | null
export type Inventory = Record<string, number>
export type InventoryChanges = Record<string, InventoryLimit>
export type ImportMode = 'merge' | 'replace'
export const inventoryOptions = [null, 0, 1, 2, 3, 4] as const
export const inventoryLimitLabel = (limit: InventoryLimit) =>
  limit === null ? '未所持' : `${limit}凸`
export const inventoryStorageKey = 'gakumas-supportcard-inventory-v1'
export const inventoryFormat = 'gakumasu-support-card-comparison'
type CardIdentity = Pick<SupportCard, 'id' | 'name'>

export function validInventoryLimit(value: unknown): value is InventoryLimit {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4)
  )
}

// インポート全体を検証してから反映する。エラー時に一部だけ取り込まない。
export function parseInventory(source: string, cards: readonly CardIdentity[]) {
  let data: unknown
  try {
    data = JSON.parse(source.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('JSONファイルを読み取れません。書き出したファイルを選択してください。')
  }
  if (!data || typeof data !== 'object') {
    throw new Error('所持状況のファイル形式が正しくありません。')
  }
  const document = data as Record<string, unknown>
  if (
    // 既存の保存データと書き出し済みファイルも引き続き読み込めるようにする。
    (document.format !== inventoryFormat && document.format !== 'gakumas-supportcard-inventory') ||
    document.version !== 1 ||
    !Array.isArray(document.cards)
  ) {
    throw new Error('対応していない所持状況のファイル形式・バージョンです。')
  }
  const known = new Map(cards.map((card) => [card.id, card.name]))
  const entries: InventoryChanges = Object.create(null)
  let renamed = 0
  for (const entry of document.cards) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      !entry.name.trim() ||
      !validInventoryLimit(entry.limitBreak)
    ) {
      throw new Error('カードにはID・名前・未所持または0～4の凸数が必要です。')
    }
    if (!known.has(entry.id)) {
      throw new Error(`未登録のカードIDです：${entry.id}`)
    }
    if (Object.hasOwn(entries, entry.id)) {
      throw new Error(`カードIDが重複しています：${entry.id}`)
    }
    entries[entry.id] = entry.limitBreak
    if (known.get(entry.id) !== entry.name) {
      renamed++
    }
  }
  return { entries, renamed }
}

export function applyInventory(
  current: Inventory,
  incoming: InventoryChanges,
  mode: ImportMode,
): Inventory {
  const result: Inventory = mode === 'replace' ? {} : { ...current }
  for (const [id, value] of Object.entries(incoming)) {
    if (!validInventoryLimit(value)) {
      throw new Error('所持状況は未所持または0～4凸で指定してください。')
    }
    if (value === null) {
      delete result[id]
    } else {
      result[id] = value
    }
  }
  return result
}

export function serializeInventory(cards: readonly CardIdentity[], inventory: Inventory): string {
  return (
    JSON.stringify(
      {
        format: inventoryFormat,
        version: 1,
        cards: cards.map((card) => ({
          id: card.id,
          name: card.name,
          limitBreak: inventory[card.id] ?? null,
        })),
      },
      null,
      2,
    ) + '\n'
  )
}
