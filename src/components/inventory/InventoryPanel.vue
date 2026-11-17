<script setup lang="ts">
import { cardFilterOptions, filterCardList } from '../../data/cardFilters'
import { computed, ref } from 'vue'
import { type SupportCard } from '../../data/cards'
import { cardThumbnailUrl } from '../../data/cardThumbnails'
import {
  parseInventory,
  serializeInventory,
  type Inventory,
  type InventoryLimit,
  type InventoryChanges,
  type ImportMode,
} from '../../inventory/inventory'
import OwnershipSelector from './OwnershipSelector.vue'
import CardFilter from '../list/CardFilter.vue'
import StatusBadge from '../common/StatusBadge.vue'
import RarityBadge from '../common/RarityBadge.vue'

const props = defineProps<{
  cards: SupportCard[]
  inventory: Inventory
  creatorIds: Set<string>
  error: string
  canUndo: boolean
}>()
const emit = defineEmits<{
  change: [ids: string[], limit: InventoryLimit]
  import: [entries: InventoryChanges, mode: ImportMode]
  undo: []
  open: [card: SupportCard]
}>()
const query = ref('')
const rarities = ref<string[]>([])
const types = ref<string[]>([])
const creator = ref<string[]>([])
const ownership = ref<string[]>([])
const limits = ref<string[]>([])
const bulkLimit = ref<InventoryLimit>(4)
const importError = ref('')
const preview = ref<ReturnType<typeof parseInventory> | null>(null)
const importMode = ref<ImportMode>('merge')
const fileInput = ref<HTMLInputElement | null>(null)
let readGeneration = 0
const ownedCount = computed(() => Object.keys(props.inventory).length)
const filtered = computed(() =>
  filterCardList(
    props.cards,
    query.value,
    {
      rarity: rarities.value,
      type: types.value,
      ownership: ownership.value,
      creatorOnly: creator.value.length > 0,
      limits: limits.value,
    },
    props.inventory,
    props.creatorIds,
  ),
)
function bulkUpdate() {
  emit(
    'change',
    filtered.value.map((card) => card.id),
    bulkLimit.value,
  )
}
function changeCard(id: string, limit: InventoryLimit) {
  emit('change', [id], limit)
}
function download() {
  const url = URL.createObjectURL(
    new Blob([serializeInventory(props.cards, props.inventory)], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  const now = new Date()
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value) => String(value).padStart(2, '0'))
    .join('-')
  anchor.download = `GSCC-${date}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function readFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  const generation = ++readGeneration
  importMode.value = 'merge'
  importError.value = ''
  preview.value = null
  try {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('ファイルが大きすぎます。2MB以下のJSONを選択してください。')
    }
    const parsed = parseInventory(await file.text(), props.cards)
    if (generation === readGeneration) {
      preview.value = parsed
    }
  } catch (cause) {
    if (generation === readGeneration) {
      importError.value =
        cause instanceof Error ? cause.message : 'ファイルを読み込めませんでした。'
    }
  }
}
function applyImport() {
  if (!preview.value) {
    return
  }
  emit('import', preview.value.entries, importMode.value)
  preview.value = null
}
</script>

<template>
  <main class="inventory-workspace">
    <div class="heading inventory-heading">
      <h2>所持状況</h2>
      <span>所持 {{ ownedCount }} / {{ cards.length }}枚</span>
      <div class="inventory-file-actions">
        <button
          id="inventory-export"
          type="button"
          @click="download"
        >
          <svg
            class="inventory-file-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
          </svg>
          エクスポート
        </button>
        <button
          id="inventory-import"
          type="button"
          @click="fileInput?.click()"
        >
          <svg
            class="inventory-file-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 15V3M7 8l5-5 5 5M4 16v4h16v-4" />
          </svg>
          インポート
        </button>
      </div>
    </div>
    <p class="note">
      利用者に応じた凸状況を設定できます。変更はこのブラウザに自動保存されます。別の端末へは、ファイルのエクスポート・インポートで移行できます。
    </p>
    <input
      ref="fileInput"
      id="inventory-file"
      class="sr-only"
      type="file"
      accept=".json,application/json"
      aria-label="所持状況のJSONファイル"
      @change="readFile"
    />
    <p
      v-if="error"
      class="inventory-error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="importError"
      class="inventory-error"
      role="alert"
    >
      {{ importError }}
    </p>
    <section
      v-if="preview"
      class="inventory-import-preview"
      aria-labelledby="inventory-import-title"
    >
      <h3 id="inventory-import-title">取り込み内容の確認</h3>
      <p>
        {{ Object.keys(preview.entries).length }}枚分（所持
        {{ Object.values(preview.entries).filter((value) => value !== null).length }}枚）
      </p>
      <p
        v-if="preview.renamed"
        class="note"
      >
        名前が現在と異なる{{ preview.renamed }}枚は、IDで照合して取り込みます。
      </p>
      <label
        ><input
          v-model="importMode"
          type="radio"
          value="merge"
          name="inventory-import-mode"
        />ファイルにあるカードだけ更新</label
      >
      <label
        ><input
          v-model="importMode"
          type="radio"
          value="replace"
          name="inventory-import-mode"
        />全体を置き換える（ファイルにないカードは未所持）</label
      >
      <div class="inventory-file-actions">
        <button
          id="inventory-apply-import"
          type="button"
          @click="applyImport"
        >
          反映する</button
        ><button
          type="button"
          @click="preview = null"
        >
          キャンセル
        </button>
      </div>
    </section>
    <div class="search">
      <label for="inventory-search">カード名・スキルカード名・Pアイテム名で検索</label
      ><input
        id="inventory-search"
        v-model="query"
        type="search"
        placeholder="名前の一部を入力"
      />
    </div>
    <div class="score-controls inventory-filters">
      <CardFilter
        v-model="rarities"
        label="レアリティ"
        :options="cardFilterOptions.rarity"
        badge-type="rarity"
      />
      <CardFilter
        v-model="types"
        label="タイプ"
        :options="cardFilterOptions.type"
        badge-type="type"
      />
      <CardFilter
        v-model="creator"
        label="制作者セレクト"
        :options="cardFilterOptions.creator"
        single
      />
      <CardFilter
        v-model="ownership"
        label="所持"
        :options="cardFilterOptions.ownership"
        single
      />
      <CardFilter
        v-model="limits"
        label="凸数"
        :options="cardFilterOptions.limits"
      />
    </div>
    <div class="inventory-bulk">
      <span>表示中の{{ filtered.length }}枚を</span
      ><OwnershipSelector
        label="一括変更する所持状況"
        :value="bulkLimit"
        @change="bulkLimit = $event"
      />
      <div class="inventory-bulk-actions">
        <button
          id="inventory-bulk-apply"
          type="button"
          :disabled="!filtered.length"
          @click="bulkUpdate"
        >
          一括変更
        </button>
        <button
          id="inventory-undo"
          type="button"
          :disabled="!canUndo"
          @click="emit('undo')"
        >
          直前の変更を元に戻す
        </button>
      </div>
    </div>
    <p class="note">一括変更は検索・絞り込み後のカードだけが対象です。</p>
    <div class="inventory-grid">
      <article
        v-for="card in filtered"
        :key="card.id"
        class="inventory-card"
        :data-card-id="card.id"
        :class="{ 'is-owned': inventory[card.id] !== undefined }"
      >
        <button
          :id="`inventory-card-${card.id}`"
          type="button"
          class="inventory-card-name"
          @click="emit('open', card)"
        >
          <img
            v-if="cardThumbnailUrl(card.id)"
            :src="cardThumbnailUrl(card.id)"
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span class="inventory-card-summary">
            <span class="inventory-card-title">{{ card.name }}</span>
            <span class="inventory-card-badges">
              <RarityBadge :rarity="card.rarity" />
              <StatusBadge
                :kind="card.type"
                small
              />
            </span>
          </span>
        </button>
        <div class="inventory-card-controls">
          <OwnershipSelector
            :label="`${card.name}の所持状況`"
            :value="inventory[card.id] ?? null"
            @change="changeCard(card.id, $event)"
          />
        </div>
      </article>
    </div>
    <p
      v-if="!filtered.length"
      role="status"
    >
      該当するカードはありません。
    </p>
  </main>
</template>
