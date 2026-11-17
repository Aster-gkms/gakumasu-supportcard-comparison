<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AttachmentDetail } from '../../data/cards'
const props = defineProps<{
  detail: AttachmentDetail
  imageUrl?: string
  imageAlt?: string
  name?: string
}>()
const selectedVariant = ref('強化後')
const activeVariant = computed(() =>
  props.detail.variants?.find((variant) => variant.label === selectedVariant.value),
)
watch(
  () => props.detail,
  () => {
    selectedVariant.value = '強化後'
  },
)
</script>

<template>
  <div class="attachment-detail effect">
    <div class="attachment-topline">
      <div class="attachment-identity">
        <h4
          v-if="name"
          class="attachment-name"
        >
          {{ name }}
        </h4>
        <p class="note attachment-meta">{{ detail.description }}</p>
      </div>
      <div
        v-if="detail.variants?.length"
        class="skill-variant-selector"
        role="group"
        aria-label="スキルカードの強化状態"
      >
        <button
          v-for="label in ['未強化', '強化後']"
          :key="label"
          type="button"
          :aria-pressed="selectedVariant === label"
          @click="selectedVariant = label"
        >
          {{ label }}
        </button>
      </div>
    </div>
    <div
      class="attachment-body"
      :class="{ 'has-image': !!imageUrl }"
    >
      <div class="attachment-body-text">
        <p
          v-if="detail.text"
          class="attachment-text"
        >
          {{ detail.text }}
        </p>
        <template v-if="detail.variants?.length">
          <div
            v-if="activeVariant"
            class="skill-variant"
          >
            <div class="attachment-heading">
              <span
                v-if="activeVariant.cost"
                class="note"
                >コスト：{{ activeVariant.cost }}</span
              >
            </div>
            <p class="attachment-text">{{ activeVariant.text }}</p>
          </div>
          <p
            v-else
            class="note"
          >
            {{ selectedVariant }}の効果は記載がありません。
          </p>
        </template>
      </div>
      <img
        v-if="imageUrl"
        class="skill-card-illustration"
        :src="imageUrl"
        :alt="imageAlt ?? 'スキルカード'"
        decoding="async"
      />
    </div>
    <details
      v-if="detail.customization?.length"
      class="attachment-customization"
    >
      <summary>カスタマイズ（枠上限：{{ detail.custom_cap ?? '記載なし' }}）</summary>
      <div class="effects-grid">
        <article
          v-for="(slot, index) in detail.customization"
          :key="index"
          class="effect"
        >
          <h4>{{ slot.name }}</h4>
          <p
            v-for="stage in slot.stages"
            :key="stage.stage"
            class="attachment-text"
          >
            段階{{ stage.stage }}・{{ stage.cost }}P：{{ stage.text }}
          </p>
        </article>
      </div>
    </details>
  </div>
</template>
