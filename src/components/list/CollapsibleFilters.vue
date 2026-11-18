<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  controls: string
  summary: string[]
}>()
const open = ref(false)
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
    <slot />
  </div>
</template>
