import { shallowRef, ref } from 'vue'
import type { SupportCard } from '../data/cards'
import {
  applyInventory,
  parseInventory,
  serializeInventory,
  inventoryStorageKey,
  type Inventory,
  type InventoryLimit,
  type InventoryChanges,
  type ImportMode,
} from './inventory.ts'

// 保存先をこの一か所に集約する。画面とカード詳細は同じ状態を参照する。
export function useInventory(cards: readonly SupportCard[]) {
  const limits = shallowRef<Inventory>({})
  const error = ref('')
  const ids = new Set(cards.map((card) => card.id))
  const undoState = shallowRef<Inventory | null>(null)
  try {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(inventoryStorageKey)
      if (saved === null) {
        limits.value = Object.fromEntries(cards.map((card) => [card.id, 4]))
      } else {
        limits.value = applyInventory({}, parseInventory(saved, cards).entries, 'replace')
      }
    }
  } catch {
    error.value =
      '保存済みの所持状況を読み込めませんでした。このブラウザの保存設定やファイルからの復元を確認してください。'
  }

  function save() {
    try {
      window.localStorage.setItem(inventoryStorageKey, serializeInventory(cards, limits.value))
      error.value = ''
    } catch {
      error.value =
        'ブラウザに保存できませんでした。入力内容は画面に残っています。エクスポートで保存してください。'
    }
  }
  function update(entries: InventoryChanges, mode: ImportMode = 'merge') {
    if (Object.keys(entries).some((id) => !ids.has(id))) {
      throw new Error('未登録のカードIDです。')
    }
    const next = applyInventory(limits.value, entries, mode)
    undoState.value = limits.value
    limits.value = next
    save()
  }
  function undo() {
    if (undoState.value === null) {
      return
    }
    limits.value = undoState.value
    undoState.value = null
    save()
  }
  const set = (cardIds: string[], limit: InventoryLimit) =>
    update(Object.fromEntries(cardIds.map((id) => [id, limit])))
  return { limits, error, set, update, undoState, undo }
}
