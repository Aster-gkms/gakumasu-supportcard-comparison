<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EffectTooltip from '../common/EffectTooltip.vue'
const props = defineProps<{
  heading: string
  effectIndex?: number
  classification?: string
  timing?: string
}>()
const headingElement = ref<HTMLElement | null>(null)
const headingExpanded = ref(false)
const headingOverflows = ref(false)
let headingObserver: ResizeObserver | undefined
function measureHeading() {
  const element = headingElement.value
  if (!element || element.clientWidth === 0) {
    return
  }
  const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
  headingOverflows.value = element.scrollHeight > lineHeight * 2 + 1
}
function observeHeading() {
  headingObserver?.disconnect()
  if (headingElement.value) {
    headingObserver?.observe(headingElement.value)
  }
  measureHeading()
}
onMounted(() => {
  headingObserver = new ResizeObserver(measureHeading)
  observeHeading()
})
watch([() => props.heading, () => props.effectIndex], async () => {
  await nextTick()
  observeHeading()
})
async function expandHeading(event: MouseEvent | KeyboardEvent) {
  if (!headingOverflows.value || headingExpanded.value) {
    return
  }
  if (
    event instanceof KeyboardEvent &&
    !(event.target as HTMLElement).closest('.calculation-info-button')
  ) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  headingElement.value
    ?.closest('.calculation-info')
    ?.querySelector<HTMLElement>('.calculation-tooltip:popover-open')
    ?.hidePopover()
  headingExpanded.value = true
  await nextTick()
  headingElement.value?.focus({ preventScroll: true })
}
onBeforeUnmount(() => headingObserver?.disconnect())
</script>

<template>
  <EffectTooltip
    v-if="heading && (classification || timing)"
    :label="effectIndex === undefined ? heading : `効果 ${effectIndex + 1}：${heading}`"
    @keydown.enter="expandHeading"
    @keydown.space="expandHeading"
  >
    <template #label
      ><span class="calculation-heading-label">
        <span
          v-if="effectIndex !== undefined"
          class="ability-number-badge"
          :aria-label="`効果 ${effectIndex + 1}`"
          >{{ effectIndex + 1 }}</span
        >
        <span
          ref="headingElement"
          tabindex="-1"
          class="calculation-heading"
          :class="{
            'calculation-heading-collapsed': !headingExpanded,
            'calculation-heading-expandable': headingOverflows && !headingExpanded,
          }"
          @click="expandHeading"
          ><span class="calculation-heading-text">{{ heading }}</span></span
        >
      </span></template
    >
    <dl class="calculation-context">
      <template v-if="classification"
        ><dt>計算上の分類</dt>
        <dd>{{ classification }}</dd></template
      >
      <template v-if="timing"
        ><dt>発動タイミング</dt>
        <dd>{{ timing }}</dd></template
      >
    </dl>
  </EffectTooltip>
  <span
    v-else-if="heading"
    class="calculation-heading-label"
    ><span
      v-if="effectIndex !== undefined"
      class="ability-number-badge"
      :aria-label="`効果 ${effectIndex + 1}`"
      >{{ effectIndex + 1 }}</span
    ><span
      ref="headingElement"
      tabindex="-1"
      class="calculation-heading"
      :class="{
        'calculation-heading-collapsed': !headingExpanded,
        'calculation-heading-expandable': headingOverflows && !headingExpanded,
      }"
      @click="expandHeading"
      ><span class="calculation-heading-text">{{ heading }}</span></span
    ></span
  >
</template>
