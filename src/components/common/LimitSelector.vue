<script setup lang="ts">
defineProps<{ label?: string; suffix?: boolean }>()
const value = defineModel<number>({ required: true })
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    :style="{ '--selected-limit': value }"
  >
    <button
      v-for="limit in [0, 1, 2, 3, 4]"
      :key="limit"
      type="button"
      :aria-label="`${limit}凸`"
      :aria-pressed="value === limit"
      @click="value = limit"
    >
      {{ limit }}{{ suffix ? '凸' : '' }}
    </button>
  </div>
</template>
