<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { planLabels, tagLabels, typeLabels, type SupportCard } from '../../data/cards'
import {
  triggerLabels,
  effectValueLabels,
  effectName,
  effectUnit,
  effectTiming,
} from '../../data/effectLabels'
import { cardImageUrl } from '../../data/cardImages'
import SkillCardDetail from './SkillCardDetail.vue'
import ProduceItemEffect from './ProduceItemEffect.vue'
import StatusBadge from '../common/StatusBadge.vue'
import RarityBadge from '../common/RarityBadge.vue'
import LimitSelector from '../common/LimitSelector.vue'
import { getScoreAssumptions } from '../../scoring/effects/assumptions'
import ScoreDetail from '../score/ScoreDetail.vue'
import type { TotalScore } from '../../scoring/totalScore'
import { supportEffectText, supportEventEntries } from '../../data/supportEffectDescriptions'
import OwnershipSelector from '../inventory/OwnershipSelector.vue'
import type { InventoryLimit } from '../../inventory/inventory'

const props = defineProps<{
  card: SupportCard
  initialLimit?: number
  scores?: Record<string, TotalScore>
  ownedLimit?: InventoryLimit
  inventoryError?: string
}>()
const cardImage = computed(() => cardImageUrl(props.card.id, 'card'))
const itemImage = computed(() => cardImageUrl(props.card.id, 'produce_item'))
const skillImage = computed(() => cardImageUrl(props.card.id, 'skill_card'))
const effectGroups = computed(() =>
  [
    {
      key: 'skill_card',
      label: 'スキルカード',
      effects: [],
      detail: props.card.skill_card_detail,
    },
    {
      key: 'support_event',
      label: 'サポートイベント',
      effects: supportEventEntries(props.card).map(({ effect }) => effect),
    },
    {
      key: 'support_ability',
      label: 'サポートアビリティ',
      effects: props.card.effects.support_ability,
    },
  ].filter((group) => group.effects.length > 0 || group.detail),
)
const effectCount = computed(
  () =>
    effectGroups.value.reduce((total, group) => total + group.effects.length, 0) +
    (props.card.effects.produce_item?.length ?? 0),
)
const emit = defineEmits<{
  close: []
  limitChange: [limit: number]
  ownershipChange: [limit: InventoryLimit]
}>()
const dialog = ref<HTMLDialogElement | null>(null)
const title = ref<HTMLHeadingElement | null>(null)
const selectedLimit = ref(props.initialLimit ?? 4)
watch(
  () => props.initialLimit,
  (limit) => {
    selectedLimit.value = limit ?? 4
  },
)
watch(selectedLimit, (limit) => emit('limitChange', limit))
const maximumScore = computed(() => props.scores?.[`${props.card.id}:${selectedLimit.value}`])
const scoreAssumptions = computed(() =>
  getScoreAssumptions(props.card, maximumScore.value?.ssrAcquisition),
)
let previousOverflow = ''
let backdropPointerDown = false

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialog.value?.showModal()
  title.value?.focus()
})

onBeforeUnmount(() => {
  dialog.value?.close()
  document.body.style.overflow = previousOverflow
})

function isBackdrop(event: MouseEvent): boolean {
  if (event.target !== dialog.value || !dialog.value) {
    return false
  }
  const bounds = dialog.value.getBoundingClientRect()
  return (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
}

function handleBackdropPointerDown(event: PointerEvent) {
  backdropPointerDown = isBackdrop(event)
}

function clickBackdrop(event: MouseEvent) {
  if (backdropPointerDown && isBackdrop(event)) {
    emit('close')
  }
  backdropPointerDown = false
}

function keepFocus(event: KeyboardEvent) {
  const controls = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, summary, [tabindex="0"]',
    ) ?? [],
  ).filter(
    (control) =>
      !control.matches(':disabled') &&
      !control.closest('[inert]') &&
      control.getClientRects().length > 0,
  )
  if (!controls?.length) {
    return
  }
  const first = controls[0]!
  const last = controls[controls.length - 1]!
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === title.value)
  ) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const fieldLabels: Record<string, string> = {
  trigger: '発動タイミング',
  value_type: '効果の種類',
  max_count: '発動回数の上限',
  condition: '発動条件',
  source: '効果の由来',
  trigger_target: '回数を増やす対象',
  scales_with: '回数増加の基準',
  description: '補足説明',
  selection: '選択方法',
  target: '対象',
  unlock_level: '解放Lv',
}

function displayField(key: string, value: unknown): string {
  if (key === 'trigger' && value === 'support_event') {
    return '常時'
  }
  if (key === 'selection') {
    return value === 'random' ? 'ランダム' : value === 'select' ? '選択' : String(value)
  }
  if (key === 'target') {
    return (
      (
        {
          skill_card: 'スキルカード',
          basic_skill_card: '名前に「基本」を含むスキルカード',
          trouble_card: 'トラブルカード',
        } as Record<string, string>
      )[String(value)] ?? String(value)
    )
  }
  if (key === 'max_count') {
    return `プロデュース中${value}回`
  }
  if (['trigger', 'trigger_target', 'scales_with'].includes(key)) {
    return triggerLabels[String(value)] ?? String(value)
  }
  if (key === 'value_type') {
    return effectValueLabels[String(value)] ?? String(value)
  }
  if (key === 'type') {
    return (
      (
        { ...typeLabels, all: '全タイプ', p_point: 'Pポイント', hp: '体力' } as Record<
          string,
          string
        >
      )[String(value)] ?? String(value)
    )
  }
  if (key === 'source' && value === 'item') {
    return 'プロデュースアイテム'
  }
  if (typeof value === 'boolean') {
    return value ? 'はい' : 'いいえ'
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function effectValues(effect: Record<string, unknown>): unknown[] {
  return Array.isArray(effect.values) ? effect.values : []
}

function effectTypes(value: unknown): string[] {
  return value === 'all' ? ['vo', 'da', 'vi'] : [String(value)]
}
</script>

<template>
  <dialog
    id="card-detail-dialog"
    ref="dialog"
    class="detail-dialog"
    aria-labelledby="card-detail-title"
    @cancel.prevent="emit('close')"
    @keydown.tab="keepFocus"
    @pointerdown="handleBackdropPointerDown"
    @click="clickBackdrop"
  >
    <section
      class="card-detail"
      aria-labelledby="card-detail-title"
    >
      <div class="card-detail-header">
        <div
          class="card-overview"
          :class="{ 'has-image': !!cardImage }"
        >
          <div class="card-overview-info">
            <div class="heading">
              <h2
                id="card-detail-title"
                ref="title"
                tabindex="-1"
              >
                {{ card.name }}
              </h2>
            </div>
            <dl class="card-summary">
              <div class="card-summary-identity">
                <dt>レアリティ</dt>
                <dd><RarityBadge :rarity="card.rarity" /></dd>
              </div>
              <div class="card-summary-identity">
                <dt>タイプ</dt>
                <dd><StatusBadge :kind="card.type" /></dd>
              </div>
              <div class="card-summary-identity">
                <dt>プラン</dt>
                <dd>{{ planLabels[card.plan] }}</dd>
              </div>
              <div class="card-summary-event">
                <dt>サポートイベント</dt>
                <dd>{{ tagLabels[card.tag] }}</dd>
              </div>
              <div v-if="card.skill_card_name && !card.skill_card_detail">
                <dt>スキルカード名</dt>
                <dd>{{ card.skill_card_name }}</dd>
              </div>
            </dl>
          </div>
          <img
            v-if="cardImage"
            class="card-illustration"
            :src="cardImage"
            :alt="card.name"
            decoding="async"
          />
        </div>
        <button
          type="button"
          class="detail-close"
          aria-label="詳細を閉じる"
          @click="$emit('close')"
        >
          <span class="detail-close-label">詳細を閉じる</span>
          <span
            class="detail-close-icon"
            aria-hidden="true"
            >×</span
          >
        </button>
      </div>
      <div
        v-if="ownedLimit !== undefined"
        class="detail-inventory-control"
      >
        <span>所持状況</span>
        <OwnershipSelector
          :id="`detail-ownership-${card.id}`"
          :label="`${card.name}の所持状況`"
          :value="ownedLimit"
          @change="emit('ownershipChange', $event)"
        />
        <span class="note">変更は自動保存されます</span>
        <p
          v-if="inventoryError"
          role="alert"
          class="inventory-error"
        >
          {{ inventoryError }}
        </p>
      </div>
      <div class="effects-toolbar">
        <h3>効果一覧（{{ effectCount }}件）</h3>
        <div class="limit-control">
          <span class="limit-label">表示する凸数</span>
          <LimitSelector
            v-model="selectedLimit"
            class="limit-selector"
            label="表示する凸数"
          />
        </div>
        <p
          class="note"
          role="status"
        >
          {{ selectedLimit }}凸の効果値を表示中
        </p>
      </div>
      <ScoreDetail :score="maximumScore" />
      <details
        v-if="scoreAssumptions.length"
        class="score-assumptions"
      >
        <summary>計算上の前提</summary>
        <p
          v-for="note in scoreAssumptions"
          :key="note"
        >
          {{ note }}
        </p>
      </details>
      <div
        class="card-effect-groups"
        :class="{
          'has-skill': !!card.skill_card_detail,
          'has-attachment': !!(
            card.skill_card_detail ||
            card.produce_item_name ||
            card.effects.produce_item?.length
          ),
        }"
      >
        <div
          v-if="card.produce_item_name || card.effects.produce_item?.length"
          class="effect-group produce-item-group"
        >
          <h3>Pアイテム</h3>
          <ProduceItemEffect
            v-for="(effect, index) in card.effects.produce_item ?? []"
            :key="index"
            :effect="effect"
            :name="index === 0 ? (card.produce_item_name ?? effect.name) : undefined"
            :description="card.produce_item_detail?.description"
          >
            <img
              v-if="itemImage && index === 0"
              class="produce-item-illustration"
              :src="itemImage"
              :alt="card.produce_item_name ?? 'Pアイテム'"
              decoding="async"
            />
          </ProduceItemEffect>
          <div
            v-if="!card.effects.produce_item?.length"
            class="effect produce-item-effect"
          >
            <h4
              v-if="card.produce_item_name"
              class="attachment-name"
            >
              {{ card.produce_item_name }}
            </h4>
            <img
              v-if="itemImage"
              class="produce-item-illustration"
              :src="itemImage"
              :alt="card.produce_item_name ?? 'Pアイテム'"
              decoding="async"
            />
            <p class="note">効果の記載はありません。</p>
          </div>
        </div>
        <div
          v-for="group in effectGroups"
          :key="group.key"
          class="effect-group"
          :class="`effect-group-${group.key}`"
        >
          <h3>
            {{ group.label
            }}<template v-if="!group.detail">（{{ group.effects.length }}件）</template>
          </h3>
          <SkillCardDetail
            v-if="group.detail"
            :detail="group.detail"
            :name="group.key === 'skill_card' ? card.skill_card_name : undefined"
            :image-url="group.key === 'skill_card' ? skillImage : undefined"
            :image-alt="card.skill_card_name"
          />
          <p
            v-if="group.effects.length === 0 && !group.detail"
            class="note"
          >
            効果の記載はありません。
          </p>
          <div class="effects-grid">
            <article
              v-for="(effect, index) in group.effects"
              :key="index"
              class="effect"
            >
              <div class="effect-heading">
                <div class="effect-title">
                  <span
                    v-if="group.key === 'support_ability' || group.key === 'support_event'"
                    class="ability-number-badge"
                    :aria-label="`効果 ${index + 1}`"
                    >{{ index + 1 }}</span
                  >
                  <StatusBadge
                    v-if="effect.value_type === 'hp_recovery' && effect.type == null"
                    kind="hp"
                    label="体力回復"
                  />
                  <div
                    v-if="effect.type != null"
                    class="type-badges"
                  >
                    <StatusBadge
                      v-for="type in effectTypes(effect.type)"
                      :key="type"
                      :kind="type"
                      :label="`対象タイプ ${displayField('type', type)}`"
                    />
                  </div>
                  <h4>
                    {{ supportEffectText(effect, selectedLimit) ?? effectName(effect, group.key) }}
                  </h4>
                </div>
                <p
                  v-if="effectValues(effect).length"
                  class="effect-value"
                >
                  効果値：<strong :key="selectedLimit"
                    >{{ effectValues(effect)[selectedLimit] ?? '記載なし'
                    }}{{
                      effectValues(effect)[selectedLimit] != null ? effectUnit(effect) : ''
                    }}</strong
                  >
                </p>
              </div>
              <div
                v-if="
                  group.key !== 'support_event' ||
                  !['skill_enhance', 'skill_delete', 'skill_change'].includes(
                    String(effect.value_type),
                  )
                "
                class="effect-calculation"
              >
                <dl class="detail-fields">
                  <dt>計算上の分類</dt>
                  <dd>{{ effectName(effect, group.key) }}</dd>
                  <template
                    v-for="(value, key) in effect"
                    :key="key"
                  >
                    <template
                      v-if="
                        ![
                          'values',
                          'template',
                          'unit',
                          'value_type',
                          'type',
                          'unlock_level',
                          'target',
                        ].includes(key) && !(group.key === 'support_event' && key === 'trigger')
                      "
                    >
                      <dt>{{ fieldLabels[key] ?? key }}</dt>
                      <dd>
                        {{
                          key === 'trigger' && group.key === 'support_ability'
                            ? effectTiming(effect)
                            : displayField(key, value)
                        }}
                      </dd>
                    </template>
                  </template>
                </dl>
              </div>
            </article>
          </div>
        </div>
      </div>
      <p v-if="effectCount === 0">効果の記載はありません。</p>
    </section>
  </dialog>
</template>
