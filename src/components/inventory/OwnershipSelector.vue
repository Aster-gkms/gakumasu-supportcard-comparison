<script setup lang="ts">
import {
  inventoryOptions,
  inventoryLimitLabel,
  type InventoryLimit,
} from '../../inventory/inventory'
defineProps<{ label: string; value: InventoryLimit }>()
const emit = defineEmits<{ change: [value: InventoryLimit] }>()
</script>

<template>
  <div
    class="limit-selector ownership-select"
    role="group"
    :aria-label="label"
    :style="{
      '--selected-limit': value === null ? 0 : value + 1,
      '--ownership-offset': value === null ? '0px' : '8px',
    }"
  >
    <button
      v-for="limit in inventoryOptions"
      :key="String(limit)"
      type="button"
      :aria-pressed="value === limit"
      @click="emit('change', limit)"
    >
      {{ inventoryLimitLabel(limit) }}
    </button>
  </div>
</template>
