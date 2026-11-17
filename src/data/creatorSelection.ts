import { parse } from 'yaml'
import type { SupportCard } from './cards.ts'

export function creatorSelectionIds(
  cards: readonly Pick<SupportCard, 'id' | 'name'>[],
  source: string,
): Set<string> {
  const entries: unknown = parse(source)
  if (
    !Array.isArray(entries) ||
    entries.some(
      (entry) =>
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.id !== 'string' ||
        !entry.id.trim() ||
        typeof entry.name !== 'string' ||
        !entry.name.trim(),
    )
  ) {
    throw new Error('creator-selection.yaml は id と name を組にした一覧にしてください。')
  }
  const ids = new Set<string>()
  const problems: string[] = []
  for (const { id, name } of entries as { id: string; name: string }[]) {
    const matches = cards.filter((card) => card.id === id)
    if (matches.length !== 1) {
      problems.push(
        `${id} / ${name}（${matches.length ? '同じIDのカードが複数あります' : 'IDが見つかりません'}）`,
      )
      continue
    }
    if (matches[0]!.name !== name) {
      problems.push(`${id} / ${name}（名前が一致しません。正しい名前：${matches[0]!.name}）`)
    }
    if (ids.has(id)) {
      problems.push(`${id} / ${name}（ID重複）`)
    }
    ids.add(id)
  }
  if (problems.length) {
    throw new Error(`creator-selection.yaml を確認してください：${problems.join('・')}`)
  }
  return ids
}
