<script setup lang="ts">
import { cardFilterOptions, filterCardList } from '../../data/cardFilters'
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { planLabels, sortCards, typeLabels, type SupportCard } from '../../data/cards'
import { cardThumbnailUrl } from '../../data/cardThumbnails'
import type { Inventory } from '../../inventory/inventory'
import {
  canEquip,
  changeDeckPlan,
  deckPlans,
  placeCard,
  sumDeckScores,
  sumDeckSpRates,
  type DeckPlan,
} from '../../deck/deck'
import { useDeck } from '../../deck/useDeck'
import type { ScoreService } from '../../scoring/runtime/useScores'
import { scoreTypes } from '../../scoring/scoreMath'
import CardFilter from '../list/CardFilter.vue'
import CollapsibleFilters from '../list/CollapsibleFilters.vue'
import AbilityFilter from '../list/AbilityFilter.vue'
import { summarizeFilters } from '../list/filterSummary'
import StatusBadge from '../common/StatusBadge.vue'
import RarityBadge from '../common/RarityBadge.vue'
import LimitSelector from '../common/LimitSelector.vue'
import templatesYaml from '../../../data/settings/deck-templates.yaml?raw'
import {
  parseDeckTemplates,
  deckFromTemplate,
  logicTemplateLabels,
  type LogicTemplateStyle,
  type DeckTemplate,
} from '../../deck/templates'

const props = defineProps<{
  cards: SupportCard[]
  inventory: Inventory
  creatorIds: Set<string>
  scoring: ScoreService
  active: boolean
}>()
const emit = defineEmits<{
  open: [card: SupportCard, limit: number, returnFocusId?: string]
}>()
const { deck, error } = useDeck(props.cards)
const scoring = props.scoring
const activeSlot = ref(0)
const summaryExpanded = ref(false)
const pinnedSummary = ref<HTMLElement | null>(null)
const pinnedHeight = ref(0)
const slotNames = ref<HTMLElement[]>([])
function measureSlotNames() {
  for (const element of slotNames.value) {
    if (element.clientWidth === 0) {
      continue
    }
    const text = element.querySelector<HTMLElement>('.deck-slot-name-text')
    element.classList.toggle(
      'is-truncated',
      Boolean(text && text.scrollWidth > element.clientWidth),
    )
  }
}
watch(
  () => deck.value.slots.map((slot) => slot?.cardId),
  async () => {
    await nextTick()
    measureSlotNames()
  },
)
let pinnedObserver: ResizeObserver | undefined
onMounted(() => {
  pinnedObserver = new ResizeObserver(() => {
    pinnedHeight.value = pinnedSummary.value?.getBoundingClientRect().height ?? 0
    measureSlotNames()
  })
  if (pinnedSummary.value) {
    pinnedObserver.observe(pinnedSummary.value)
  }
  for (const element of slotNames.value) {
    pinnedObserver.observe(element)
  }
})
onBeforeUnmount(() => pinnedObserver?.disconnect())
async function toggleSummary() {
  const pinnedBottom = pinnedSummary.value?.getBoundingClientRect().bottom ?? 0
  const anchor = Array.from(document.querySelectorAll<HTMLElement>('.deck-candidate-card')).find(
    (element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > pinnedBottom && rect.top < window.innerHeight
    },
  )
  const anchorOffset = anchor ? anchor.getBoundingClientRect().top - pinnedBottom : 0
  summaryExpanded.value = !summaryExpanded.value
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  if (
    props.active &&
    anchor &&
    anchor.isConnected &&
    pinnedSummary.value &&
    anchor.getClientRects().length > 0
  ) {
    const newOffset =
      anchor.getBoundingClientRect().top - pinnedSummary.value.getBoundingClientRect().bottom
    window.scrollBy(0, newOffset - anchorOffset)
  }
}
const dragOverSlot = ref<number | null>(null)
const placementError = ref('')
const templateError = ref('')
let templates: DeckTemplate[] = []
const logicTemplateStyle = ref<LogicTemplateStyle>('good_impression')
const currentTemplates = computed(() =>
  templates.filter(
    (template) =>
      template.plan === deck.value.plan &&
      (template.plan !== 'logic' || template.style === logicTemplateStyle.value),
  ),
)
try {
  templates = parseDeckTemplates(templatesYaml, props.cards)
} catch (cause) {
  templateError.value =
    cause instanceof Error ? cause.message : '編成テンプレートを読み込めませんでした。'
}
function applyTemplate(template: DeckTemplate) {
  try {
    deck.value = deckFromTemplate(template, props.cards, props.inventory, deck.value.plan)
    activeSlot.value = 0
    dragOverSlot.value = null
    placementError.value = ''
    if (pinnedSummary.value) {
      const slots = pinnedSummary.value.querySelector('.deck-slots')
      if (slots) {
        slots.scrollTop = 0
      }
    }
  } catch (cause) {
    placementError.value =
      cause instanceof Error ? cause.message : 'テンプレートをセットできませんでした。'
  }
}
const query = ref('')
const abilities = ref<string[]>([])
const abilityMode = ref<'any' | 'all'>('any')
const rarities = ref<string[]>([])
const types = ref<string[]>([])
const ownership = ref<string[]>([])
const creator = ref<string[]>([])
const spRate = ref<string[]>([])
const activeFilterLabels = computed(() => {
  const groups = [
    { label: 'レアリティ', selected: rarities.value, options: cardFilterOptions.rarity },
    { label: 'タイプ', selected: types.value, options: cardFilterOptions.type },
    { label: 'SP補正', selected: spRate.value, options: cardFilterOptions.spRate },
    { label: '所持', selected: ownership.value, options: cardFilterOptions.ownership },
    { label: '制作者セレクト', selected: creator.value, options: cardFilterOptions.creator },
  ]
  const labels = summarizeFilters(groups)
  if (abilities.value.length) {
    labels.push(
      `アビリティ：${abilities.value.length}件・${abilityMode.value === 'all' ? 'すべて' : 'いずれか'}`,
    )
  }
  return labels
})
const candidateSort = ref<'name' | 'score'>('name')
const cardsById = new Map(props.cards.map((card) => [card.id, card]))
const entries = computed(() =>
  deck.value.slots.map((slot) =>
    slot
      ? {
          ...slot,
          card: cardsById.get(slot.cardId)!,
          score: scoring.scores.value[`${slot.cardId}:${slot.limit}`],
          error: scoring.errors.value[`${slot.cardId}:${slot.limit}`],
        }
      : null,
  ),
)
const equipped = computed(
  () => new Set(deck.value.slots.flatMap((slot) => (slot ? [slot.cardId] : []))),
)
const summary = computed(() => sumDeckScores(deck.value.slots, scoring.scores.value))
const spRates = computed(() => sumDeckSpRates(deck.value.slots, props.cards))
const candidates = computed(() =>
  sortCards(
    filterCardList(
      props.cards,
      query.value,
      {
        rarity: rarities.value,
        type: types.value,
        ownership: ownership.value,
        creatorOnly: creator.value.length > 0,
        spRate: spRate.value,
        abilities: abilities.value,
        abilityMode: abilityMode.value,
      },
      props.inventory,
      props.creatorIds,
    ).filter((card) => canEquip(card, deck.value.plan)),
    'rarity',
    'ascending',
  ),
)
const slotLimits = computed(
  () =>
    new Map(
      deck.value.slots.filter((slot) => slot !== null).map((slot) => [slot.cardId, slot.limit]),
    ),
)
const candidateLimit = (id: string) => slotLimits.value.get(id) ?? props.inventory[id] ?? 4
const candidateScore = (id: string) => scoring.scores.value[`${id}:${candidateLimit(id)}`]
const candidateError = (id: string) => scoring.errors.value[`${id}:${candidateLimit(id)}`]
// 計算対象の候補と表示順を分け、得点更新でWorkerへ再要求しない。
const candidatesByScoreTieOrder = computed(() => sortCards(candidates.value, 'name', 'ascending'))
const displayedCandidates = computed(() => {
  if (candidateSort.value === 'name') {
    return candidates.value
  }
  return candidatesByScoreTieOrder.value
    .map((card) => {
      const score = candidateScore(card.id)
      return { card, scored: Boolean(score), total: score?.total ?? 0 }
    })
    .sort((left, right) => {
      if (left.scored !== right.scored) {
        return left.scored ? -1 : 1
      }
      return right.total - left.total
    })
    .map(({ card }) => card)
})
function requestScores() {
  if (!props.active) {
    scoring.setRequests('deck', [])
    return
  }
  // 編成枠を先に優先計算し、候補一覧は表示対象だけを凸数別にまとめる。
  scoring.setRequests('deck', [
    ...deck.value.slots.filter((slot) => slot !== null).map((slot) => ({ ...slot, priority: 1 })),
    ...candidates.value.map((card) => ({
      cardId: card.id,
      limit: candidateLimit(card.id),
    })),
  ])
}
watch(deck, requestScores, {
  deep: true,
  immediate: true,
})
watch([candidates, () => props.inventory, () => props.active], requestScores)
onBeforeUnmount(() => scoring.setRequests('deck', []))
function choosePlan(plan: DeckPlan) {
  deck.value = changeDeckPlan(deck.value, plan, props.cards)
  placementError.value = ''
}
function putCard(id: string, index = activeSlot.value) {
  try {
    deck.value = placeCard(deck.value, props.cards, id, index, props.inventory[id] ?? 4)
    placementError.value = ''
    const empty = deck.value.slots.findIndex((slot, i) => i > index && !slot)
    const firstEmpty = deck.value.slots.findIndex((slot) => !slot)
    activeSlot.value = empty >= 0 ? empty : firstEmpty >= 0 ? firstEmpty : index
  } catch (cause) {
    placementError.value =
      cause instanceof Error ? cause.message : 'カードをセットできませんでした。'
  }
}
function remove(index: number) {
  deck.value.slots[index] = null
  activeSlot.value = index
  placementError.value = ''
}
function changeLimit(index: number, limit: number) {
  const slot = deck.value.slots[index]
  if (slot) {
    slot.limit = limit
  }
}
const dragType = 'application/x-gscc-support-card'
function startDrag(event: DragEvent, id: string) {
  if (!event.dataTransfer) {
    return
  }
  event.dataTransfer.setData(dragType, id)
  event.dataTransfer.effectAllowed = 'copyMove'
}
function allowDrop(event: DragEvent, index: number) {
  if (!event.dataTransfer?.types.includes(dragType)) {
    return
  }
  event.preventDefault()
  dragOverSlot.value = index
}
function drop(event: DragEvent, index: number) {
  event.preventDefault()
  dragOverSlot.value = null
  const id = event.dataTransfer?.getData(dragType)
  if (id) {
    putCard(id, index)
  }
}
</script>

<template>
  <main
    class="deck-workspace"
    :style="{ '--deck-pinned-height': `${pinnedHeight}px` }"
  >
    <div class="heading">
      <h2>サポート編成</h2>
      <span>{{ equipped.size }} / 6枚</span>
    </div>
    <p class="note deck-intro">
      実際に編成を組んだ場合の点数やSP率を確認できます。カード一覧には、所持状況タブで設定した凸数が反映されます。未所持の場合はデフォルトで4凸扱いになります。
    </p>
    <div class="deck-plan-control">
      <span id="deck-plan-label">育成プラン</span>
      <div
        id="deck-plan"
        class="deck-plan-selector"
        role="group"
        aria-labelledby="deck-plan-label"
      >
        <button
          v-for="plan in deckPlans"
          :key="plan"
          type="button"
          :data-plan="plan"
          :aria-pressed="deck.plan === plan"
          @click="choosePlan(plan)"
        >
          {{ planLabels[plan] }}
        </button>
      </div>
      <span class="note">選択プランとフリーのカードを編成できます。</span>
    </div>
    <div
      class="deck-template-control"
      role="group"
      aria-label="編成テンプレート"
    >
      <span>テンプレート</span>
      <div
        v-if="deck.plan === 'logic'"
        class="deck-plan-selector"
        role="group"
        aria-label="ロジックのテンプレート分類"
      >
        <button
          v-for="(label, style) in logicTemplateLabels"
          :key="style"
          type="button"
          :data-template-style="style"
          :aria-pressed="logicTemplateStyle === style"
          @click="logicTemplateStyle = style"
        >
          {{ label }}
        </button>
      </div>
      <button
        v-for="template in currentTemplates"
        :key="template.key"
        type="button"
        :data-template="template.key"
        :disabled="!template.cards.length"
        :title="template.cards.length ? `${template.label}の6枚を一括セット` : 'テンプレート未設定'"
        @click="applyTemplate(template)"
      >
        {{ template.label }}
      </button>
    </div>
    <p
      v-if="templateError"
      class="inventory-error"
      role="alert"
    >
      {{ templateError }}
    </p>
    <p
      v-if="error || placementError || scoring.errors.value.worker"
      role="alert"
      class="inventory-error"
    >
      {{ error || placementError || scoring.errors.value.worker }}
    </p>
    <div
      ref="pinnedSummary"
      class="deck-pinned-summary"
      :class="{ 'is-collapsed': !summaryExpanded }"
    >
      <div
        class="deck-totals"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="deck-total">
          <span>個別最大点の合計</span
          ><strong
            >{{ summary.pending ? '計算中…' : summary.total.toLocaleString('ja-JP')
            }}<small v-if="!summary.pending">点</small></strong
          >
        </div>
        <div
          v-for="type in scoreTypes"
          :key="type"
          class="deck-type-total"
        >
          <StatusBadge
            :kind="type"
            small
          />
          <div class="deck-type-values">
            <strong>{{
              summary.pending ? '—' : summary.byType[type].toLocaleString('ja-JP')
            }}</strong><small
              class="deck-type-sp-rate"
              title="SPレッスン発生率補正の合計"
              >SP +{{ spRates[type].toLocaleString('ja-JP', { maximumFractionDigits: 2 }) }}%</small
            >
          </div>
        </div>
        <button
          type="button"
          class="deck-summary-toggle"
          :aria-expanded="summaryExpanded"
          aria-controls="deck-slots"
          @click="toggleSummary"
        >
          {{ summaryExpanded ? '縮小' : '展開' }}
          <span aria-hidden="true">{{ summaryExpanded ? '▲' : '▼' }}</span>
        </button>
      </div>
      <p
        v-if="summary.incomplete"
        class="note"
      >
        一部のカードに計算未対応の効果があります。合計は計算済みの効果のみです。
      </p>
      <div
        id="deck-slots"
        class="deck-slots"
        aria-label="6枚の編成枠"
      >
        <article
          v-for="(entry, index) in entries"
          :key="index"
          class="deck-slot"
          :class="{ 'is-active': activeSlot === index, 'is-drag-over': dragOverSlot === index }"
          :data-slot="index"
          @dragover="allowDrop($event, index)"
          @dragleave="dragOverSlot = null"
          @drop="drop($event, index)"
          @dragend="dragOverSlot = null"
        >
          <button
            type="button"
            class="deck-slot-select"
            :aria-label="`${index + 1}枠目${entry ? `：${entry.card.name}` : '：空き'}を選択`"
            :aria-pressed="activeSlot === index"
            :draggable="!!entry"
            @dragstart="entry && startDrag($event, entry.cardId)"
            @click="activeSlot = index"
          >
            <span class="deck-slot-number">{{ index + 1 }}枠目</span>
            <img
              v-if="entry"
              :src="cardThumbnailUrl(entry.cardId)"
              :alt="entry.card.name"
              draggable="false"
            />
            <span
              v-else
              class="deck-slot-empty"
              >＋<small>カードをセット</small></span
            >
            <span
              ref="slotNames"
              class="deck-slot-name"
            >
              <span class="deck-slot-name-text">{{ entry ? entry.card.name : '空き枠' }}</span>
            </span>
          </button>
          <template v-if="entry">
            <button
              :id="`deck-slot-detail-${index}`"
              type="button"
              class="deck-slot-detail"
              :aria-label="`${index + 1}枠目の${entry.card.name}の詳細`"
              aria-haspopup="dialog"
              :draggable="false"
              @dragstart.stop.prevent
              @click.stop="emit('open', entry.card, entry.limit, `deck-slot-detail-${index}`)"
            >
              詳細
            </button>
            <button
              type="button"
              class="deck-slot-remove"
              :aria-label="`${index + 1}枠目から外す`"
              @click="remove(index)"
            >
              ×
            </button>
            <div class="deck-slot-controls">
              <span>凸数</span>
              <LimitSelector
                class="deck-slot-limits"
                :label="`${index + 1}枠目の凸数`"
                :model-value="entry.limit"
                @update:model-value="changeLimit(index, $event)"
              />
            </div>
            <div class="deck-contribution-row">
              <p class="deck-contribution">
                <strong>{{
                  entry.score
                    ? entry.score.total.toLocaleString('ja-JP') + '点'
                    : entry.error
                      ? '計算失敗'
                      : '計算中…'
                }}</strong>
              </p>
              <div
                v-if="entry.score"
                class="deck-contribution-types"
              >
                <span
                  v-for="type in scoreTypes"
                  :key="type"
                  class="deck-type-contribution"
                  ><span>{{ typeLabels[type] }}</span
                  ><span>{{ entry.score.byType[type] }}</span></span
                >
              </div>
            </div>
            <p
              v-if="entry.error"
              class="inventory-error"
            >
              {{ entry.error }}
            </p>
          </template>
        </article>
      </div>
    </div>
    <div class="search">
      <label for="deck-search">カード名・スキルカード名・Pアイテム名で検索</label
      ><input
        id="deck-search"
        v-model="query"
        type="search"
        placeholder="名前の一部を入力"
      />
    </div>
    <CollapsibleFilters
      v-slot="{ showResults }"
      results-id="deck-filter-results"
      class="deck-filters"
      controls="deck-filter-rarity deck-filter-type deck-filter-sp-rate deck-filter-ownership deck-filter-creator deck-filter-abilities"
      :summary="activeFilterLabels"
    >
      <CardFilter
        id="deck-filter-rarity"
        v-model="rarities"
        label="レアリティ"
        :options="cardFilterOptions.rarity"
        badge-type="rarity"
      />
      <CardFilter
        id="deck-filter-type"
        v-model="types"
        label="タイプ"
        :options="cardFilterOptions.type"
        badge-type="type"
      />
      <CardFilter
        id="deck-filter-sp-rate"
        v-model="spRate"
        label="SPレッスン発生率補正"
        :options="cardFilterOptions.spRate"
        single
        data-filter="sp-rate"
      />
      <CardFilter
        id="deck-filter-ownership"
        v-model="ownership"
        label="所持"
        :options="cardFilterOptions.ownership"
        single
      />
      <CardFilter
        id="deck-filter-creator"
        v-model="creator"
        label="制作者セレクト"
        :options="cardFilterOptions.creator"
        single
      />
      <AbilityFilter
        id="deck-filter-abilities"
        v-model="abilities"
        v-model:mode="abilityMode"
        :cards="cards"
        :result-count="candidates.length"
        @show-results="showResults"
      />
    </CollapsibleFilters>
    <div class="deck-candidates-toolbar">
      <h3
        id="deck-filter-results"
        class="deck-candidates-heading filter-results-anchor"
        tabindex="-1"
      >
        カード一覧 <small>{{ candidates.length }}枚</small>
      </h3>
      <div
        class="deck-candidate-sort"
        role="group"
        aria-label="カード一覧の並び順"
      >
        <button
          type="button"
          data-candidate-sort="name"
          :aria-pressed="candidateSort === 'name'"
          @click="candidateSort = 'name'"
        >
          名前順
        </button>
        <button
          type="button"
          data-candidate-sort="score"
          :aria-pressed="candidateSort === 'score'"
          @click="candidateSort = 'score'"
        >
          点数順
        </button>
      </div>
    </div>
    <div class="deck-candidates">
      <article
        v-for="card in displayedCandidates"
        :key="card.id"
        class="deck-candidate-card"
        :class="{ 'is-equipped': equipped.has(card.id) }"
      >
        <button
          type="button"
          class="deck-candidate"
          :class="{ 'is-equipped': equipped.has(card.id) }"
          :data-card-id="card.id"
          :title="card.name"
          :aria-label="`${card.name}を${activeSlot + 1}枠目にセット`"
          draggable="true"
          @dragstart="startDrag($event, card.id)"
          @dragend="dragOverSlot = null"
          @click="putCard(card.id)"
        >
          <img
            :src="cardThumbnailUrl(card.id)"
            :alt="card.name"
            draggable="false"
            loading="lazy"
            decoding="async"
          />
          <span class="deck-candidate-name">{{ card.name }}</span>
          <span class="deck-candidate-meta"
            ><RarityBadge :rarity="card.rarity" /><StatusBadge
              :kind="card.type"
              small
            /><span>{{
              equipped.has(card.id)
                ? '編成中'
                : inventory[card.id] === undefined
                  ? '未所持'
                  : `${inventory[card.id]}凸`
            }}</span>
            <strong
              class="deck-candidate-score"
              :title="`${candidateLimit(card.id)}凸`"
              >{{
                candidateScore(card.id)
                  ? candidateScore(card.id)!.total.toLocaleString('ja-JP') + '点'
                  : candidateError(card.id) || scoring.errors.value.worker
                    ? '計算失敗'
                    : '計算中…'
              }}</strong
            >
          </span>
        </button>
        <button
          :id="`deck-detail-${card.id}`"
          type="button"
          class="deck-candidate-detail"
          :data-detail-card-id="card.id"
          :aria-label="`${card.name}の詳細を見る`"
          aria-haspopup="dialog"
          draggable="false"
          @click="emit('open', card, candidateLimit(card.id))"
        >
          詳細
        </button>
      </article>
    </div>
    <p
      v-if="!candidates.length"
      class="note"
    >
      該当するカードはありません。
    </p>
  </main>
</template>
