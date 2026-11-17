<script setup lang="ts">
defineProps<{ rarity: string }>()
</script>

<template>
  <span
    class="rarity-badge"
    :class="`rarity-badge-${rarity.toLowerCase()}`"
    >{{ rarity }}</span
  >
</template>

<style scoped>
.rarity-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 26px;
  padding: 2px 9px;
  border: 1px solid;
  border-radius: 2px;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.2;
  white-space: nowrap;
}
.rarity-badge-ssr {
  border-color: #b4a4c6;
  background: linear-gradient(115deg, #f1cbd7 0%, #f2e4b5 33%, #cce5dc 66%, #d3d2ed 100%);
  color: #655077;
}
.rarity-badge-sr {
  border-color: #c4b185;
  background: #f6f1e5;
  color: #75603b;
}
.rarity-badge-r {
  border-color: #c4cbd2;
  background: #f2f4f6;
  color: #59636e;
}
</style>
