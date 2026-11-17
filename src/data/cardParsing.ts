import { parse } from 'yaml'
import { validateCardSources } from './cardSchema.ts'

export function parseCards(sources: string[]) {
  function* parsedSources() {
    for (const source of sources) {
      yield parse(source)
    }
  }
  return validateCardSources(parsedSources())
}
