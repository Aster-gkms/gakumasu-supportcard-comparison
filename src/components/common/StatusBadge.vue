<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ kind: string; label?: string; small?: boolean }>(), {
  small: false,
})
const labels: Record<string, string> = {
  vo: 'Vo',
  da: 'Da',
  vi: 'Vi',
  as: 'AS',
  p_point: 'Pポイント',
  hp: '体力',
}
const accessibleLabel = computed(() => props.label ?? labels[props.kind] ?? props.kind)
</script>

<template>
  <span
    class="status-badge"
    :class="[`status-badge-${kind}`, { 'status-badge-small': small }]"
    role="img"
    :aria-label="accessibleLabel"
  >
    <svg
      v-if="kind === 'hp'"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M12 21 3.4 12.6C-2 7.2 5.7.1 12 6.5 18.3.1 26 7.2 20.6 12.6Z"
        fill="currentColor"
      />
    </svg>
    <span
      v-else
      aria-hidden="true"
      >{{ kind === 'p_point' ? 'P' : (labels[kind] ?? kind) }}</span
    >
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #e4eaf0;
  color: #26394a;
  font-size: 0.75rem;
  font-weight: 700;
  vertical-align: middle;
}
.status-badge-vo {
  background: #c93649;
  color: white;
}
.status-badge-da {
  background: #2467bf;
  color: white;
}
.status-badge-vi {
  background: #f4ce38;
  color: #403400;
}
.status-badge-as {
  background: #7aeb34;
  color: #244411;
}
.status-badge-p_point {
  background: #b9e8fa;
  color: #164b63;
}
.status-badge-hp {
  border: 2px solid #7aeb34;
  background: #7aeb34;
  color: white;
}
.status-badge svg {
  width: 19px;
  height: 19px;
}
.status-badge-small {
  width: 22px;
  height: 22px;
  margin-right: 4px;
}
.status-badge-small svg {
  width: 13px;
  height: 13px;
}
</style>
