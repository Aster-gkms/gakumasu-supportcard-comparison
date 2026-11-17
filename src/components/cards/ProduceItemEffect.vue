<script setup lang="ts">
import type { ProduceItemEffect } from '../../data/cards'
import { itemPartText } from '../../data/produceItemLabels'
import StatusBadge from '../common/StatusBadge.vue'
defineProps<{ effect: ProduceItemEffect; description?: string; name?: string }>()
</script>

<template>
  <article class="effect produce-item-effect">
    <slot />
    <h4
      v-if="name"
      class="attachment-name"
    >
      {{ name }}
    </h4>
    <p
      v-if="description"
      class="note attachment-meta"
    >
      {{ description }}
    </p>
    <dl class="detail-fields">
      <template v-if="effect.restriction"
        ><dt>適用範囲</dt>
        <dd>{{ itemPartText(effect.restriction, 'restriction') }}</dd></template
      >
      <dt>発動タイミング</dt>
      <dd>{{ itemPartText(effect.trigger, 'trigger') || '記載なし' }}</dd>
      <template v-if="effect.condition"
        ><dt>発動条件</dt>
        <dd>{{ itemPartText(effect.condition, 'condition') }}</dd></template
      >
      <template v-if="effect.max_count !== undefined"
        ><dt>発動回数の上限</dt>
        <dd>
          {{ effect.count_scope === 'per_lesson' ? 'レッスン内' : 'プロデュース中'
          }}{{ effect.max_count }}回
        </dd></template
      >
    </dl>
    <ul class="item-actions">
      <li
        v-for="(action, index) in effect.actions"
        :key="index"
        class="attachment-text"
      >
        <StatusBadge
          v-if="action.kind === 'status_add' && ['vo', 'da', 'vi'].includes(String(action.type))"
          :kind="String(action.type)"
          small
        />
        <StatusBadge
          v-if="['hp_recovery', 'max_hp_pct_recovery'].includes(action.kind)"
          kind="hp"
          label="体力回復"
          small
        />
        <StatusBadge
          v-if="action.kind === 'point_add'"
          kind="p_point"
          label="対象 Pポイント"
          small
        />
        {{ itemPartText(action, 'action') }}
      </li>
    </ul>
  </article>
</template>
