<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import CardDetail from './components/cards/CardDetail.vue'
import ComparisonPanel from './components/comparison/ComparisonPanel.vue'
import TrainingConditionsPanel from './components/training/TrainingConditionsPanel.vue'
import InventoryPanel from './components/inventory/InventoryPanel.vue'
import DeckPanel from './components/deck/DeckPanel.vue'
import OtherPanel from './components/other/OtherPanel.vue'
import { useInventory } from './inventory/useInventory'
import type { InventoryLimit } from './inventory/inventory'
import { emptyTypeScores } from './scoring/scoreMath'
import type { SpLessonDays } from './scoring/conditions/conditions'
import { useScores } from './scoring/runtime/useScores'
import type { ExamRatios } from './scoring/conditions/examConditions'
import type { OperationSettings } from './scoring/conditions/operationSettings'
import type { ActionCounts } from './scoring/conditions/actionConditions'
import creatorSelectionYaml from '../data/settings/creator-selection.yaml?raw'
import { creatorSelectionIds } from './data/creatorSelection'
import { loadCards, type SupportCard } from './data/cards'

const tabLabels = {
  comparison: '比較',
  inventory: '所持状況',
  deck: '編成',
  other: 'その他',
} as const
const tabs = Object.keys(tabLabels) as (keyof typeof tabLabels)[]
type WorkspaceTab = (typeof tabs)[number]
const activeTab = ref<WorkspaceTab>('comparison')
const siteHeader = ref<HTMLElement | null>(null)
let headerObserver: ResizeObserver | undefined
onMounted(() => {
  headerObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      '--site-header-height',
      `${siteHeader.value?.getBoundingClientRect().height ?? 0}px`,
    )
  })
  if (siteHeader.value) {
    headerObserver.observe(siteHeader.value)
  }
})
onBeforeUnmount(() => headerObserver?.disconnect())
const inventoryVisited = ref(false)
const deckVisited = ref(false)
const comparisonMode = ref<'fixed' | 'owned'>('fixed')
const tabScroll = { comparison: 0, inventory: 0, deck: 0, other: 0 }
async function setTab(tab: WorkspaceTab) {
  if (tab === activeTab.value) {
    return
  }
  tabScroll[activeTab.value] = window.scrollY
  activeTab.value = tab
  if (tab === 'inventory') {
    inventoryVisited.value = true
  }
  if (tab === 'deck') {
    deckVisited.value = true
  }
  await nextTick()
  window.scrollTo(0, tabScroll[tab])
}
function tabKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    return
  }
  event.preventDefault()
  const index = tabs.indexOf(activeTab.value)
  const tab =
    tabs[
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    ]!
  void setTab(tab)
  document.getElementById(`${tab}-tab`)?.focus()
}
// マスターの内容は書き換えず、読込時の差し替えだけを監視する。
const cards = shallowRef<SupportCard[]>([])
const error = ref('')
const selectedCard = shallowRef<SupportCard | null>(null)
let detailScrollY = 0
let detailReturnId = ''
const scoringLimit = ref(4)
const creatorCardIds = shallowRef(new Set<string>())
function selectCard(card: SupportCard, limit = limitFor(card.id), returnFocusId = '') {
  detailScrollY = window.scrollY
  detailReturnId = returnFocusId
  selectedCard.value = card
  detailLimit.value = limit
}

async function closeDetail() {
  const cardId = selectedCard.value?.id
  selectedCard.value = null
  await nextTick()
  if (activeTab.value === 'deck') {
    window.scrollTo(0, detailScrollY)
  }
  const searchId =
    activeTab.value === 'inventory'
      ? 'inventory-search'
      : activeTab.value === 'deck'
        ? 'deck-search'
        : 'card-search'
  const returnTarget =
    document.getElementById(detailReturnId) ??
    document.getElementById(
      activeTab.value === 'inventory'
        ? `inventory-card-${cardId}`
        : activeTab.value === 'deck'
          ? `deck-detail-${cardId}`
          : `card-${cardId}`,
    ) ??
    document.getElementById(searchId)
  if (returnTarget?.getClientRects().length === 0) {
    document.getElementById(searchId)?.focus()
    return
  }
  returnTarget?.focus({ preventScroll: activeTab.value === 'deck' })
}
try {
  cards.value = loadCards()
  creatorCardIds.value = creatorSelectionIds(cards.value, creatorSelectionYaml)
} catch (cause) {
  error.value = cause instanceof Error ? cause.message : 'データを確認してください。'
}
const scoring = useScores(cards.value)
const inventory = useInventory(cards.value)
const limitFor = (id: string) =>
  comparisonMode.value === 'owned'
    ? (inventory.limits.value[id] ?? scoringLimit.value)
    : scoringLimit.value
function updateOwnership(id: string, limit: InventoryLimit) {
  inventory.set([id], limit)
  if (comparisonMode.value === 'owned' && limit !== null) {
    detailLimit.value = limit
  }
}
const conditionsOpen = ref(false)
const detailLimit = ref(scoringLimit.value)
const spLessonCounts = ref(emptyTypeScores())
const selectedSpLessonDays = ref<SpLessonDays>({})
const selectedActionCounts = ref<ActionCounts>({})
const selectedExamRatios = ref<ExamRatios>({})
const selectedOperationSettings = ref<OperationSettings>({})
const scoringConditions = computed(() => ({
  spLessons: spLessonCounts.value,
  spLessonDays: selectedSpLessonDays.value,
  actionCounts: selectedActionCounts.value,
  examRatios: selectedExamRatios.value,
  operationSettings: selectedOperationSettings.value,
}))
watch(scoringConditions, (conditions) => scoring.setConditions(conditions), {
  deep: true,
  immediate: true,
})
watch([selectedCard, detailLimit], ([card, limit]) =>
  scoring.setRequests('detail', card ? [{ cardId: card.id, limit, priority: 2 }] : []),
)
</script>

<template>
  <header
    ref="siteHeader"
    class="site-header"
  >
    <div class="site-header-inner">
      <div class="site-brand">
        <p class="eyebrow">GAKUMASU SUPPORT CARD COMPARISON</p>
        <h1>学マス サポートカード比較</h1>
      </div>
      <div
        class="workspace-tabs"
        role="tablist"
        aria-label="表示切り替え"
        @keydown="tabKey"
      >
        <button
          v-for="tab in tabs"
          :id="`${tab}-tab`"
          :key="tab"
          role="tab"
          type="button"
          :aria-selected="activeTab === tab"
          :tabindex="activeTab === tab ? 0 : -1"
          :aria-controls="`${tab}-panel`"
          @click="setTab(tab)"
        >
          {{ tabLabels[tab] }}
        </button>
      </div>
    </div>
  </header>
  <div
    v-show="activeTab === 'comparison'"
    id="comparison-panel"
    class="app-workspace"
    role="tabpanel"
    aria-labelledby="comparison-tab"
  >
    <ComparisonPanel
      v-model:mode="comparisonMode"
      v-model:limit="scoringLimit"
      :cards="cards"
      :inventory="inventory.limits.value"
      :creator-ids="creatorCardIds"
      :scoring="scoring"
      :active="activeTab === 'comparison'"
      :error="error"
      :conditions="scoringConditions"
      :selected-card-id="selectedCard?.id"
      @open="selectCard"
    />
  </div>
  <div
    id="inventory-panel"
    v-show="activeTab === 'inventory'"
    role="tabpanel"
    aria-labelledby="inventory-tab"
  >
    <InventoryPanel
      v-if="inventoryVisited"
      :cards="cards"
      :inventory="inventory.limits.value"
      :creator-ids="creatorCardIds"
      :error="inventory.error.value"
      :can-undo="inventory.undoState.value !== null"
      @change="inventory.set"
      @import="inventory.update"
      @undo="inventory.undo"
      @open="selectCard"
    />
  </div>
  <div
    id="deck-panel"
    v-show="activeTab === 'deck'"
    role="tabpanel"
    aria-labelledby="deck-tab"
  >
    <DeckPanel
      v-if="deckVisited"
      :cards="cards"
      :inventory="inventory.limits.value"
      :creator-ids="creatorCardIds"
      :scoring="scoring"
      :active="activeTab === 'deck'"
      @open="selectCard"
    />
  </div>
  <div
    id="other-panel"
    v-show="activeTab === 'other'"
    role="tabpanel"
    aria-labelledby="other-tab"
  >
    <OtherPanel />
  </div>
  <CardDetail
    v-if="selectedCard"
    :card="selectedCard"
    :initial-limit="detailLimit"
    :scores="scoring.scores.value"
    :owned-limit="inventory.limits.value[selectedCard.id] ?? null"
    :inventory-error="inventory.error.value"
    @ownership-change="updateOwnership(selectedCard!.id, $event)"
    @limit-change="
      (limit: number) => {
        detailLimit = limit
      }
    "
    @close="closeDetail"
  />
  <Teleport
    :to="selectedCard ? '#card-detail-dialog' : 'body'"
    defer
  >
    <TrainingConditionsPanel
      v-if="activeTab === 'comparison' || activeTab === 'deck' || !!selectedCard"
      v-model:open="conditionsOpen"
      v-model:counts="spLessonCounts"
      v-model:days="selectedSpLessonDays"
      v-model:actions="selectedActionCounts"
      v-model:exams="selectedExamRatios"
      v-model:operations="selectedOperationSettings"
      :detail-open="!!selectedCard"
    />
  </Teleport>
</template>
