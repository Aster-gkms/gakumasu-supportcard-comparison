<script setup lang="ts">
import { computed, ref, shallowRef, watch, onBeforeUnmount, toRefs } from 'vue'
import { cardFilterOptions, filterCardList, type CardFilterKey } from '../../data/cardFilters'
import {
  planLabels,
  tagLabels,
  sortCards,
  cardAttachmentName,
  supportCardMaxLevel,
  type SortDirection,
  type SupportCard,
} from '../../data/cards'
import { cardThumbnailUrl } from '../../data/cardThumbnails'
import type { Inventory } from '../../inventory/inventory'
import type { ScoreService } from '../../scoring/runtime/useScores'
import type { ScoringConditions } from '../../scoring/conditions/conditions'
import StatusBadge from '../common/StatusBadge.vue'
import RarityBadge from '../common/RarityBadge.vue'
import LimitSelector from '../common/LimitSelector.vue'
import CardFilter from '../list/CardFilter.vue'
import CollapsibleFilters from '../list/CollapsibleFilters.vue'
import AbilityFilter from '../list/AbilityFilter.vue'
import { summarizeFilters } from '../list/filterSummary'
import ActiveConditionsSummary from '../training/ActiveConditionsSummary.vue'

const props = defineProps<{
  cards: SupportCard[]
  inventory: Inventory
  creatorIds: Set<string>
  scoring: ScoreService
  active: boolean
  error: string
  conditions: Required<ScoringConditions>
  selectedCardId?: string
}>()
const emit = defineEmits<{ open: [card: SupportCard, limit: number] }>()
const { cards, inventory, creatorIds: creatorCardIds, active } = toRefs(props)
const scoring = props.scoring
const comparisonMode = defineModel<'fixed' | 'owned'>('mode', { required: true })
const scoringLimit = defineModel<number>('limit', { required: true })
type ComparisonSortKey = 'name' | 'total' | 'attachment'
const mobileSortOptions: { key: ComparisonSortKey; label: string }[] = [
  { key: 'total', label: '点数' },
  { key: 'name', label: '名前' },
  { key: 'attachment', label: 'スキルカード名／Pアイテム名' },
]
const query = ref('')
const abilities = ref<string[]>([])
const abilityMode = ref<'any' | 'all'>('any')
const selectedOwnership = ref<string[]>([])
const sortKey = ref<ComparisonSortKey>('total')
const sortDirection = ref<SortDirection>('descending')
const selectedSpRate = ref<string[]>([])
const selectedCreatorFilter = ref<string[]>([])
const selectedFilters = ref<Record<CardFilterKey, string[]>>({
  rarity: [],
  type: [],
  plan: [],
  tag: [],
})
const filterGroups: {
  key: CardFilterKey
  label: string
  options: { key: string; label: string }[]
}[] = [
  { key: 'rarity', label: 'レアリティ', options: cardFilterOptions.rarity },
  { key: 'type', label: 'タイプ', options: cardFilterOptions.type },
  { key: 'plan', label: 'プラン', options: cardFilterOptions.plan },
  { key: 'tag', label: 'サポートイベント', options: cardFilterOptions.tag },
]
const activeFilterLabels = computed(() => {
  const labels = summarizeFilters([
    ...filterGroups.map((group) => ({ ...group, selected: selectedFilters.value[group.key] })),
    { label: 'SP補正', selected: selectedSpRate.value, options: cardFilterOptions.spRate },
    {
      selected: selectedCreatorFilter.value,
      options: [{ key: 'selected', label: '制作者セレクトのみ' }],
    },
    { selected: selectedOwnership.value, options: cardFilterOptions.ownership },
  ])
  if (comparisonMode.value === 'fixed') {
    labels.unshift(`凸数：${scoringLimit.value}凸`)
  }
  if (abilities.value.length) {
    labels.push(
      `アビリティ：${abilities.value.length}件・${abilityMode.value === 'all' ? 'すべて' : 'いずれか'}`,
    )
  }
  return labels
})
const baseTableColumns = [
  { key: 'name', label: 'カード名' },
  { key: 'total', label: '最大点' },
  { key: 'rarity', label: 'レアリティ' },
  { key: 'level', label: 'レベル' },
  { key: 'type', label: 'タイプ' },
  { key: 'plan', label: 'プラン' },
  { key: 'tag', label: 'サポートイベント' },
  { key: 'attachment', label: 'スキルカード名／Pアイテム名' },
] as const
const tableColumns = computed(() =>
  comparisonMode.value === 'owned'
    ? [{ key: 'owned-limit', label: '凸数' }, ...baseTableColumns]
    : baseTableColumns,
)
function setSort(key: ComparisonSortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'ascending' ? 'descending' : 'ascending'
  } else {
    sortKey.value = key
    sortDirection.value = key === 'total' ? 'descending' : 'ascending'
  }
}
function columnSort(key: ComparisonSortKey) {
  return sortKey.value === key ? sortDirection.value : 'none'
}
function headerArrow(key: ComparisonSortKey) {
  const direction = columnSort(key)
  return direction === 'none' ? '↕' : direction === 'ascending' ? '▲' : '▼'
}

function nextSortLabel(key: ComparisonSortKey) {
  if (sortKey.value === key) {
    return sortDirection.value === 'ascending' ? '降順' : '昇順'
  }
  return key === 'total' ? '降順' : '昇順'
}

const limitFor = (id: string) =>
  comparisonMode.value === 'owned'
    ? (inventory.value[id] ?? scoringLimit.value)
    : scoringLimit.value
const unownedComparison = (id: string) =>
  comparisonMode.value === 'owned' && inventory.value[id] === undefined
function requestComparisonScores() {
  scoring.setRequests(
    'comparison',
    active.value
      ? filteredCards.value
          .filter((card) => !unownedComparison(card.id))
          .map((card) => ({ cardId: card.id, limit: limitFor(card.id) }))
      : [],
  )
}
watch(comparisonMode, (mode) => {
  selectedOwnership.value = mode === 'owned' ? ['owned'] : []
})
const scoreFor = (id: string) =>
  unownedComparison(id) ? undefined : scoring.scores.value[`${id}:${limitFor(id)}`]
const filteredCards = computed(() =>
  filterCardList(
    cards.value,
    query.value,
    {
      ...selectedFilters.value,
      ownership: selectedOwnership.value,
      creatorOnly: selectedCreatorFilter.value.length > 0,
      spRate: selectedSpRate.value,
      abilities: abilities.value,
      abilityMode: abilityMode.value,
    },
    inventory.value,
    creatorCardIds.value,
  ),
)
// 点数更新では名前順を再計算せず、安定ソートで同点時の順序を維持する。
// 比較の既存のlocaleCompareと同じく、数字を数値扱いしない日本語順。
const scoreNameCollator = new Intl.Collator('ja')
const cardsByScoreTieOrder = computed(() =>
  [...filteredCards.value].sort((a, b) => scoreNameCollator.compare(a.name, b.name)),
)
const nonScoreOrder = computed(() =>
  sortCards(
    filteredCards.value,
    sortKey.value === 'attachment' ? 'attachment' : 'name',
    sortDirection.value,
  ),
)
const scoreRows = computed(() =>
  cardsByScoreTieOrder.value.map((card) => {
    const score = scoreFor(card.id)
    const error = scoring.errors.value[`${card.id}:${limitFor(card.id)}`]
    return {
      card,
      complete: Boolean(score?.complete),
      total: score?.total ?? -1,
      waiting: !unownedComparison(card.id) && !score && !error && !scoring.errors.value.worker,
    }
  }),
)
const displayedCards = shallowRef<SupportCard[]>([])
watch(
  [scoreRows, sortKey, sortDirection],
  ([rows, key, direction]) => {
    let next: SupportCard[]
    if (key !== 'total') {
      next = nonScoreOrder.value
    } else if (rows.some((row) => row.waiting)) {
      // 計算中は既存の行順を保持し、絞り込みで追加されたカードだけ末尾へ置く。
      const remaining = new Map(rows.map((row) => [row.card.id, row.card]))
      next = []
      for (const previous of displayedCards.value) {
        const card = remaining.get(previous.id)
        if (card) {
          next.push(card)
          remaining.delete(card.id)
        }
      }
      next.push(...remaining.values())
    } else {
      // 探索未完の結果・エラー・未所持も待機から除き、返却が揃った時点で更新する。
      const factor = direction === 'ascending' ? -1 : 1
      next = [...rows]
        .sort((left, right) => {
          if (left.complete !== right.complete) {
            return left.complete ? -1 : 1
          }
          return (right.total - left.total) * factor
        })
        .map((row) => row.card)
    }
    if (
      next.length !== displayedCards.value.length ||
      next.some((card, index) => card !== displayedCards.value[index])
    ) {
      displayedCards.value = next
    }
  },
  { immediate: true },
)
watch([filteredCards, scoringLimit, comparisonMode, active, inventory], requestComparisonScores, {
  immediate: true,
})
onBeforeUnmount(() => scoring.setRequests('comparison', []))
function selectCard(card: SupportCard) {
  emit('open', card, limitFor(card.id))
}
</script>

<template>
  <main>
    <p class="lead">
      登録されているカードの一覧が表示されます。デフォルトで、そのカードにとっての理想的な動きをした場合の最大点順になっています。現在HIFのみ対応です。
    </p>
    <section aria-labelledby="cards">
      <div class="heading cards-heading">
        <h2 id="cards">カード一覧</h2>
        <div
          class="comparison-mode"
          role="group"
          aria-label="比較方法"
          v-if="!error"
        >
          <button
            type="button"
            :aria-pressed="comparisonMode === 'fixed'"
            @click="comparisonMode = 'fixed'"
          >
            一律の凸数で比較
          </button>
          <button
            type="button"
            :aria-pressed="comparisonMode === 'owned'"
            @click="comparisonMode = 'owned'"
          >
            所持状況で比較
          </button>
        </div>
      </div>
      <p
        v-if="error"
        role="alert"
      >
        カードデータを読み込めませんでした。{{ error }}
      </p>
      <template v-else>
        <div class="search">
          <label for="card-search">カード名・スキルカード名・Pアイテム名で検索</label>
          <input
            id="card-search"
            v-model="query"
            type="search"
            placeholder="名前の一部を入力"
          />
        </div>
        <CollapsibleFilters
          v-slot="{ showResults }"
          results-id="comparison-filter-results"
          class="comparison-score-controls"
          controls="comparison-filter-rarity comparison-filter-type comparison-filter-plan comparison-filter-limit comparison-filter-tag comparison-filter-sp-rate comparison-filter-creator comparison-filter-ownership comparison-filter-abilities"
          :summary="activeFilterLabels"
        >
          <div
            v-for="group in filterGroups"
            :key="group.key"
            class="comparison-filter-group"
            :class="{ 'plan-limit-group': group.key === 'plan' }"
          >
            <CardFilter
              :id="`comparison-filter-${group.key}`"
              v-model="selectedFilters[group.key]"
              :label="group.label"
              :options="group.options"
              :badge-type="group.key === 'type' || group.key === 'rarity' ? group.key : undefined"
              :data-filter="group.key"
            />
            <div
              v-if="group.key === 'plan'"
              id="comparison-filter-limit"
              class="score-control comparison-limit-slot"
              :class="{ 'is-hidden': comparisonMode === 'owned' }"
              :inert="comparisonMode === 'owned'"
              :aria-hidden="comparisonMode === 'owned'"
            >
              <span
                id="scoring-limit-label"
                class="limit-label"
                >凸数</span
              >
              <LimitSelector
                v-model="scoringLimit"
                class="limit-selector"
                aria-labelledby="scoring-limit-label"
                suffix
              />
            </div>
          </div>
          <CardFilter
            id="comparison-filter-sp-rate"
            v-model="selectedSpRate"
            label="SPレッスン発生率補正"
            :options="cardFilterOptions.spRate"
            single
            data-filter="sp-rate"
          />
          <CardFilter
            id="comparison-filter-creator"
            v-model="selectedCreatorFilter"
            label="制作者セレクト"
            :options="[{ key: 'selected', label: `セレクトのみ（${creatorCardIds.size}枚）` }]"
            single
            data-filter="creator-selection"
          />
          <CardFilter
            id="comparison-filter-ownership"
            v-model="selectedOwnership"
            label="所持"
            :options="cardFilterOptions.ownership"
            single
            data-filter="ownership"
          />
          <AbilityFilter
            id="comparison-filter-abilities"
            v-model="abilities"
            v-model:mode="abilityMode"
            :cards="cards"
            :result-count="filteredCards.length"
            @show-results="showResults"
          />
        </CollapsibleFilters>
        <p
          v-if="comparisonMode === 'owned'"
          class="note"
        >
          登録した凸数で比較しています。未所持カードは計算せず、所持状況タブで登録できます。
        </p>
        <ActiveConditionsSummary
          :counts="conditions.spLessons"
          :days="conditions.spLessonDays"
          :actions="conditions.actionCounts"
          :exams="conditions.examRatios"
          :operations="conditions.operationSettings"
        />
        <p
          v-if="scoring.errors.value.worker"
          role="alert"
        >
          {{ scoring.errors.value.worker }}
        </p>
        <p
          id="comparison-filter-results"
          class="filter-results-anchor"
          tabindex="-1"
          role="status"
        >
          {{ filteredCards.length }}件 / 全{{ cards.length }}件
        </p>
        <div
          class="comparison-mobile-sort"
          role="group"
          aria-label="カード一覧の並べ替え"
        >
          <span>並べ替え</span>
          <button
            v-for="option in mobileSortOptions"
            :key="option.key"
            type="button"
            :aria-pressed="sortKey === option.key"
            :aria-label="`${option.label}を${nextSortLabel(option.key)}に並べ替え`"
            @click="setSort(option.key)"
          >
            {{ option.label }}
            <span aria-hidden="true">{{ headerArrow(option.key) }}</span>
          </button>
        </div>
        <div class="table-scroll comparison-table-scroll">
          <table
            :class="{ 'has-owned-limit': comparisonMode === 'owned' }"
            role="table"
          >
            <caption class="sr-only">
              サポートカードの基本情報
            </caption>
            <thead role="rowgroup">
              <tr role="row">
                <th
                  v-for="column in tableColumns"
                  :key="column.key"
                  :data-column="column.key"
                  scope="col"
                  role="columnheader"
                  :aria-label="column.label"
                  :aria-sort="
                    column.key === 'name' || column.key === 'total' || column.key === 'attachment'
                      ? columnSort(column.key)
                      : undefined
                  "
                >
                  <button
                    v-if="
                      column.key === 'name' || column.key === 'total' || column.key === 'attachment'
                    "
                    type="button"
                    class="sort-button"
                    :aria-label="`${column.label}を${nextSortLabel(column.key)}に並べ替え`"
                    @click="setSort(column.key)"
                  >
                    {{ column.label }}
                    <span aria-hidden="true">{{ headerArrow(column.key) }}</span>
                  </button>
                  <span v-else>{{ column.label }}</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              <tr
                v-for="card in displayedCards"
                :key="card.id"
                class="comparison-card-row"
                role="row"
              >
                <td
                  v-if="comparisonMode === 'owned'"
                  class="owned-limit-cell"
                  data-column="owned-limit"
                  role="cell"
                >
                  <span class="comparison-mobile-label">所持</span>
                  {{ unownedComparison(card.id) ? '未所持' : `${limitFor(card.id)}凸` }}
                </td>
                <td
                  data-column="name"
                  role="cell"
                >
                  <button
                    :id="`card-${card.id}`"
                    type="button"
                    class="card-link"
                    aria-haspopup="dialog"
                    :aria-controls="selectedCardId === card.id ? 'card-detail-dialog' : undefined"
                    @click="selectCard(card)"
                  >
                    <img
                      v-if="cardThumbnailUrl(card.id)"
                      class="card-thumbnail"
                      :src="cardThumbnailUrl(card.id)"
                      alt=""
                      width="56"
                      height="32"
                      loading="lazy"
                      decoding="async"
                    />
                    <span>{{ card.name }}</span>
                  </button>
                </td>
                <td
                  class="score-cell"
                  data-column="total"
                  role="cell"
                >
                  <span v-if="unownedComparison(card.id)">未所持</span>
                  <template v-else-if="scoreFor(card.id)"
                    >{{ scoreFor(card.id)!.total }}{{ scoreFor(card.id)!.complete ? '' : '以上'
                    }}<small v-if="!scoreFor(card.id)!.complete">探索未完</small></template
                  ><span v-else>{{
                    scoring.errors.value[`${card.id}:${limitFor(card.id)}`]
                      ? '計算エラー'
                      : '計算待ち'
                  }}</span>
                </td>
                <td
                  data-column="rarity"
                  role="cell"
                >
                  <RarityBadge :rarity="card.rarity" />
                </td>
                <td
                  class="card-level"
                  data-column="level"
                  role="cell"
                >
                  {{
                    unownedComparison(card.id)
                      ? '—'
                      : `Lv.${supportCardMaxLevel(card.rarity, limitFor(card.id))}`
                  }}
                  <span class="comparison-mobile-limit">
                    ・{{ unownedComparison(card.id) ? '未所持' : `${limitFor(card.id)}凸` }}・{{
                      planLabels[card.plan]
                    }}
                  </span>
                </td>
                <td
                  data-column="type"
                  role="cell"
                >
                  <StatusBadge :kind="card.type" />
                </td>
                <td
                  data-column="plan"
                  role="cell"
                >
                  {{ planLabels[card.plan] }}
                </td>
                <td
                  data-column="tag"
                  role="cell"
                >
                  {{ tagLabels[card.tag] }}
                </td>
                <td
                  class="attachment-name-cell"
                  data-column="attachment"
                  role="cell"
                >
                  <span class="comparison-mobile-label">{{ tagLabels[card.tag] }}：</span>
                  {{ cardAttachmentName(card) || '—' }}
                </td>
              </tr>
              <tr
                v-if="displayedCards.length === 0"
                role="row"
              >
                <td
                  :colspan="tableColumns.length"
                  role="cell"
                >
                  該当するカードはありません。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </main>
</template>
