import path from 'node:path'
import fs from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { parseCards } from '../src/data/cardParsing.ts'

const publicId = 'virtual:support-card-data'
const moduleId = `\0${publicId}`

/** @returns {import('vite').Plugin} */
export function supportCardsPlugin() {
  let files = []
  return {
    name: 'support-card-data',
    configResolved(config) {
      files = ['ssr', 'sr', 'r'].map((rarity) =>
        path.resolve(config.root, `data/support-cards/${rarity}_cards.yaml`),
      )
    },
    resolveId(id) {
      if (id === publicId) {
        return moduleId
      }
    },
    async load(id) {
      if (id !== moduleId) {
        return
      }
      for (const file of files) {
        this.addWatchFile(file)
      }
      const cards = parseCards(await Promise.all(files.map((file) => fs.readFile(file, 'utf8'))))
      const serialized = JSON.stringify(cards)
      if (!isDeepStrictEqual(cards, JSON.parse(serialized))) {
        throw new Error('カードデータを情報を失わずにJavaScriptへ変換できません。')
      }
      // JSONとして復元し、__proto__等も元と同じ通常のキーとして扱う。
      return `export default JSON.parse(${JSON.stringify(serialized)})`
    },
    handleHotUpdate(context) {
      if (files.includes(path.resolve(context.file))) {
        const module = context.server.moduleGraph.getModuleById(moduleId)
        if (module) {
          context.server.moduleGraph.invalidateModule(module)
          return [module]
        }
      }
    },
  }
}
