import { loadCards } from './cards'
export const cardsById = new Map(loadCards().map((card) => [card.id, card]))
