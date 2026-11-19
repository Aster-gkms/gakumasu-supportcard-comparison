<script setup lang="ts">
import { nextTick, ref } from 'vue'

defineProps<{
  controls: string
  summary: string[]
  resultsId: string
}>()
const open = ref(false)

async function showResults(resultsId: string) {
  open.value = false
  await nextTick()
  const target = document.getElementById(resultsId)
  if (target?.isConnected && target.getClientRects().length) {
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
}
</script>

<template>
  <div
    class="score-controls collapsible-filters"
    :class="{ 'is-filters-open': open }"
  >
    <div class="filter-toggle-row">
      <button
        type="button"
        class="filter-toggle"
        :aria-expanded="open"
        :aria-controls="controls"
        @click="open = !open"
      >
        絞り込み
        <span aria-hidden="true">{{ open ? '▲' : '▼' }}</span>
      </button>
      <p class="filter-summary">{{ summary.length ? summary.join(' ／ ') : '指定なし' }}</p>
    </div>
    <slot :show-results="() => showResults(resultsId)" />
  </div>
</template>
