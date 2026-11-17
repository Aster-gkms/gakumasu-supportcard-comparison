import index from '../../data/images/index.json'

const cardDetailAssets = import.meta.glob<string>('../../data/images/card-details/*/*.webp', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
})
// 元のカード画像を配信用ビルドへ含めず、付属物の画像だけをここで読む。
const attachmentAssets = import.meta.glob<string>(
  [
    '../../data/images/produce-items/**/*.{png,jpg,jpeg}',
    '../../data/images/skill-cards/**/*.{png,jpg,jpeg}',
  ],
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
)
const imagesByCardId: Record<
  string,
  { card: { path: string }; produce_item?: { path: string }; skill_card?: { path: string } }
> = index.cards

export function cardImageUrl(
  id: string,
  kind: 'card' | 'produce_item' | 'skill_card',
): string | undefined {
  const image = imagesByCardId[id]?.[kind]
  if (!image) {
    return undefined
  }
  if (kind === 'card') {
    return cardDetailAssets[`../../data/images/${image.path}`]
  }
  return attachmentAssets[`../../data/images/${image.path}`]
}
