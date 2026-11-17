// Keep tiny images as separate files: inlining would load all thumbnails with the JS bundle.
const thumbnails = import.meta.glob<string>('../../data/images/thumbnails/*/*.webp', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
})

export function cardThumbnailUrl(id: string): string | undefined {
  const rarity = /^SP_(R|SR|SSR)_\d+$/.exec(id)?.[1]?.toLowerCase()
  return rarity ? thumbnails[`../../data/images/thumbnails/${rarity}/${id}.webp`] : undefined
}
