import { ref, watch } from 'vue'
import type { SupportCard } from '../data/cards'
import { deckStorageKey, emptyDeck, parseDeck } from './deck.ts'

export function useDeck(cards: readonly SupportCard[]) {
  const deck = ref(emptyDeck())
  const error = ref('')
  try {
    const saved = window.localStorage.getItem(deckStorageKey)
    if (saved !== null) {
      deck.value = parseDeck(saved, cards)
    }
  } catch {
    error.value = '保存済みの編成を読み込めませんでした。編成し直すと新しい内容を保存します。'
  }
  watch(
    deck,
    (value) => {
      try {
        window.localStorage.setItem(deckStorageKey, JSON.stringify({ version: 1, ...value }))
        error.value = ''
      } catch {
        error.value = '編成を保存できませんでした。ブラウザの保存設定を確認してください。'
      }
    },
    { deep: true },
  )
  return { deck, error }
}
