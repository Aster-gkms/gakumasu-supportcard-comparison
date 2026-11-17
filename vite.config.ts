import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { supportCardsPlugin } from './build/supportCards.mjs'

export default defineConfig({
  plugins: [supportCardsPlugin(), vue()],
  worker: { plugins: () => [supportCardsPlugin()] },
  base: './',
})
