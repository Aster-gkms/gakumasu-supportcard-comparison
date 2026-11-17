<script setup lang="ts">
import { useId } from 'vue'
import StatusBadge from '../common/StatusBadge.vue'
import RarityBadge from '../common/RarityBadge.vue'

const props = defineProps<{
  label: string
  options: { key: string; label: string }[]
  badgeType?: 'type' | 'rarity'
  single?: boolean
}>()
const selected = defineModel<string[]>({ required: true })
const labelId = useId()
function toggle(key: string) {
  if (key === 'all') {
    selected.value = []
  } else if (props.single) {
    selected.value = selected.value.includes(key) ? [] : [key]
  } else {
    selected.value = selected.value.includes(key)
      ? selected.value.filter((value) => value !== key)
      : [...selected.value, key]
  }
}
</script>

<template>
  <div class="score-control card-filter">
    <span
      :id="labelId"
      class="limit-label"
      >{{ label }}</span
    >
    <div class="filter-scroll">
      <div
        class="limit-selector multi-filter-selector"
        role="group"
        :aria-labelledby="labelId"
        :style="{ '--filter-count': options.length + 1 }"
      >
        <button
          v-for="option in [{ key: 'all', label: 'すべて' }, ...props.options]"
          :key="option.key"
          type="button"
          :aria-pressed="
            option.key === 'all' ? selected.length === 0 : selected.includes(option.key)
          "
          @click="toggle(option.key)"
        >
          <StatusBadge
            v-if="badgeType === 'type' && option.key !== 'all'"
            :kind="option.key"
          />
          <RarityBadge
            v-else-if="badgeType === 'rarity' && option.key !== 'all'"
            :rarity="option.key"
          />
          <template v-else>{{ option.label }}</template>
        </button>
      </div>
    </div>
  </div>
</template>
