<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, useId } from 'vue'
defineProps<{ label: string }>()
const tooltipId = useId()
const tooltip = ref<HTMLElement | null>(null)
const infoButton = ref<HTMLButtonElement | null>(null)
const tooltipOpen = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
let sizeObserver: ResizeObserver | undefined
function cancelClose() {
  clearTimeout(closeTimer)
}
function closeTooltip() {
  cancelClose()
  tooltip.value?.hidePopover()
}
function handleScroll(event: Event) {
  if (event.target instanceof Node && tooltip.value?.contains(event.target)) {
    return
  }
  closeTooltip()
}
function openTooltip() {
  cancelClose()
  tooltip.value?.showPopover()
  positionTooltip()
}
function positionTooltip() {
  const popup = tooltip.value
  const button = infoButton.value
  if (!popup || !button || !popup.matches(':popover-open')) {
    return
  }
  const anchor = button.getBoundingClientRect()
  popup.style.setProperty(
    '--tooltip-content-max-height',
    `${Math.max(24, Math.min(window.innerHeight - 58, anchor.top - 42))}px`,
  )
  const bounds = popup.getBoundingClientRect()
  const target = anchor.left + anchor.width / 2
  const left = Math.max(
    8,
    Math.min(target - bounds.width / 2, window.innerWidth - bounds.width - 8),
  )
  popup.style.left = `${left}px`
  popup.style.top = `${Math.max(8, anchor.top - bounds.height - 8)}px`
  popup.style.setProperty(
    '--tooltip-arrow-left',
    `${Math.max(12, Math.min(target - left, bounds.width - 12))}px`,
  )
}
function leaveTooltip() {
  if (document.activeElement !== infoButton.value) {
    closeTimer = setTimeout(closeTooltip, 150)
  }
}
function dismissTooltip(event: KeyboardEvent) {
  if (!tooltip.value?.matches(':popover-open')) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  closeTooltip()
}
onMounted(() => {
  sizeObserver = new ResizeObserver(positionTooltip)
  if (tooltip.value) {
    sizeObserver.observe(tooltip.value)
  }
  document.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', positionTooltip)
})
onBeforeUnmount(() => {
  cancelClose()
  sizeObserver?.disconnect()
  document.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', positionTooltip)
})
</script>

<template>
  <div
    class="calculation-info"
    @pointerenter="
      (event) => {
        if (event.pointerType === 'mouse') openTooltip()
      }
    "
    @pointerleave="leaveTooltip"
    @keydown.esc="dismissTooltip"
  >
    <button
      ref="infoButton"
      type="button"
      class="calculation-info-button"
      :aria-label="`${label}の説明`"
      :aria-describedby="tooltipOpen ? tooltipId : undefined"
      :aria-expanded="tooltipOpen"
      @focus="openTooltip"
      @blur="closeTooltip"
      @click="openTooltip"
    >
      <span class="calculation-tooltip-label"
        ><slot name="label">{{ label }}</slot></span
      >
      <span
        class="calculation-info-icon"
        aria-hidden="true"
        >ⓘ</span
      >
    </button>
    <div
      ref="tooltip"
      :id="tooltipId"
      popover="auto"
      role="tooltip"
      class="calculation-tooltip"
      @toggle="(event) => (tooltipOpen = (event as ToggleEvent).newState === 'open')"
      @pointerenter="cancelClose"
      @pointerleave="leaveTooltip"
    >
      <slot />
    </div>
  </div>
</template>
