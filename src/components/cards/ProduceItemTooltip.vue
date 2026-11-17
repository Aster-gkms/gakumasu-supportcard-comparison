<script setup lang="ts">
import type { SupportCard } from '../../data/cards'
import EffectTooltip from '../common/EffectTooltip.vue'
import ProduceItemEffect from './ProduceItemEffect.vue'

defineProps<{ card: SupportCard }>()
</script>

<template>
  <EffectTooltip label="Pアイテム">
    <div class="produce-item-tooltip">
      <p class="produce-item-tooltip-name">{{ card.produce_item_name ?? 'Pアイテム' }}</p>
      <ProduceItemEffect
        v-for="(effect, index) in card.effects.produce_item"
        :key="index"
        :effect="effect"
      />
      <p v-if="!card.effects.produce_item?.length">
        {{ card.produce_item_detail?.description ?? '効果の記載がありません。' }}
      </p>
    </div>
  </EffectTooltip>
</template>
