<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { abilityCategories, buildAbilityOptions } from '../../data/abilityFilters'
import type { SupportCard } from '../../data/cards'
import abilityOrderYaml from '../../../data/settings/ability-order.yaml?raw'

const props = defineProps<{ cards: SupportCard[]; resultCount: number }>()
const emit = defineEmits<{ showResults: [] }>()
const disclosure = ref<HTMLDetailsElement | null>(null)
const checklist = ref<HTMLElement | null>(null)
const selected = defineModel<string[]>({ required: true })
const mode = defineModel<'any' | 'all'>('mode', { required: true })
const id = useId()
const query = ref('')
const category = ref('all')
const optionState = computed(() => {
  try {
    return { options: buildAbilityOptions(props.cards, abilityOrderYaml), error: '' }
  } catch (cause) {
    return {
      options: buildAbilityOptions(props.cards),
      error: cause instanceof Error ? cause.message : 'アビリティの並び順を読み込めませんでした。',
    }
  }
})
const options = computed(() => optionState.value.options)
const categories = computed(() =>
  abilityCategories.filter(
    (item) => item.key !== 'other' || options.value.some((option) => option.category === 'other'),
  ),
)
const chosen = computed(() => options.value.filter((option) => selected.value.includes(option.key)))
const normalize = (text: string) =>
  text.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/gu, '')
const visible = computed(() =>
  options.value.filter(
    (option) =>
      (category.value === 'all' || category.value === option.category) &&
      normalize(`${option.label}${option.condition}`).includes(normalize(query.value)),
  ),
)
function remove(key: string) {
  selected.value = selected.value.filter((item) => item !== key)
}
watch(
  [query, category],
  () => {
    checklist.value?.scrollTo({ top: 0 })
  },
  { flush: 'post' },
)

function showResults() {
  if (disclosure.value) {
    disclosure.value.open = false
  }
  emit('showResults')
}
</script>

<template>
  <details
    ref="disclosure"
    class="ability-filter"
  >
    <summary>
      サポートアビリティ
      <span>{{
        selected.length
          ? `${selected.length}件選択・${mode === 'all' ? 'すべて持つ' : 'いずれかを持つ'}`
          : '指定なし'
      }}</span>
    </summary>
    <div class="ability-filter-body">
      <p
        v-if="optionState.error"
        class="ability-error"
        role="alert"
      >
        {{ optionState.error }} 標準の順序で表示しています。
      </p>
      <label :for="`${id}-search`">効果一覧を検索</label>
      <input
        :id="`${id}-search`"
        v-model="query"
        type="search"
        placeholder="レッスン、集中、スキルカード獲得時、8枚など"
      />
      <div
        class="ability-categories"
        role="group"
        aria-label="効果の分類"
      >
        <button
          v-for="item in categories"
          :key="item.key"
          type="button"
          :aria-pressed="category === item.key"
          @click="category = item.key"
        >
          {{ item.label }}
        </button>
      </div>
      <fieldset class="ability-mode">
        <legend>複数選択時</legend>
        <label
          ><input
            v-model="mode"
            type="radio"
            :name="`${id}-mode`"
            value="any"
          />いずれかを持つ</label
        >
        <label
          ><input
            v-model="mode"
            type="radio"
            :name="`${id}-mode`"
            value="all"
          />すべて持つ</label
        >
      </fieldset>
      <div
        class="ability-chosen"
        role="group"
        :aria-labelledby="`${id}-chosen-label`"
      >
        <span :id="`${id}-chosen-label`">選択中</span>
        <div
          class="ability-chosen-items"
          role="group"
          aria-label="選択中のアビリティ"
          tabindex="0"
        >
          <span
            v-if="!chosen.length"
            class="ability-hint"
            >選択なし</span
          >
          <button
            v-for="option in chosen"
            :key="option.key"
            type="button"
            :aria-label="`${option.label} ${option.condition}を解除`"
            @click="remove(option.key)"
          >
            {{ option.label }}{{ option.condition ? `（${option.condition}）` : '' }} ×
          </button>
        </div>
        <button
          type="button"
          class="ability-clear"
          :disabled="!chosen.length"
          @click="selected = []"
        >
          選択を解除
        </button>
      </div>
      <p
        class="ability-hint"
        role="status"
      >
        表示する効果：{{ visible.length }} / {{ options.length }}種類
      </p>
      <div
        ref="checklist"
        class="ability-checklist"
        role="group"
        aria-label="サポートアビリティの効果一覧"
        tabindex="0"
      >
        <label
          v-for="option in visible"
          :key="option.key"
          class="ability-option"
        >
          <input
            v-model="selected"
            type="checkbox"
            :value="option.key"
          />
          <span
            >{{ option.label
            }}<small v-if="option.condition">条件：{{ option.condition }}</small></span
          >
          <small class="ability-count">{{ option.count }}枚</small>
        </label>
      </div>
      <p v-if="!visible.length">該当する効果がありません。検索や分類を変更してください。</p>
      <p class="ability-hint">
        枚数は全登録カードの件数です。検索・分類を変更してもチェックは保持します。
      </p>
      <button
        type="button"
        class="ability-show-results"
        @click="showResults"
      >
        該当カード{{ resultCount }}枚を見る
      </button>
    </div>
  </details>
</template>

<style scoped>
.ability-filter {
  flex-basis: 100%;
  width: 100%;
  min-width: 0;
  border: 1px solid #c6d8d8;
  border-radius: 8px;
  background: #fff;
}
summary {
  padding: 9px 12px;
  cursor: pointer;
  color: #235c60;
  font-weight: 700;
}
summary span {
  margin-left: 8px;
  font-size: 0.8rem;
  font-weight: 400;
}
.ability-filter-body {
  padding: 0 12px 12px;
  display: grid;
  gap: 8px;
}
.ability-filter-body > input {
  width: 100%;
  min-width: 0;
  padding: 8px;
  border: 1px solid #a9bfc0;
  border-radius: 6px;
  font: inherit;
}
.ability-categories,
.ability-chosen {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.ability-chosen {
  min-height: 32px;
  flex-wrap: nowrap;
  min-width: 0;
}
.ability-chosen > span,
.ability-clear {
  flex-shrink: 0;
  white-space: nowrap;
}
.ability-chosen-items {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 3.5rem;
  align-items: center;
  gap: 6px;
  padding: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-padding-inline: 4px;
}
.ability-chosen-items > * {
  flex-shrink: 0;
  white-space: nowrap;
}
.ability-chosen button {
  scroll-margin-block: 4px;
}
.ability-clear:disabled {
  opacity: 0.5;
  cursor: default;
}
button {
  padding: 6px 10px;
  border: 1px solid #b9cccc;
  border-radius: 6px;
  background: #f5f9f9;
  color: #235c60;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  overflow-wrap: anywhere;
}
button[aria-pressed='true'] {
  background: #dceeed;
  border-color: #327579;
  font-weight: 700;
}
.ability-mode {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 0.85rem;
}
.ability-mode legend {
  margin-bottom: 4px;
}
.ability-mode label {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ability-hint {
  margin: 0;
  font-size: 0.75rem;
  color: #52696c;
}
.ability-error {
  margin: 0;
  color: #9c3030;
  overflow-wrap: anywhere;
}
.ability-checklist {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  max-height: min(360px, 40dvh);
  overflow-y: auto;
  scrollbar-gutter: stable;
  border: 1px solid #c6d8d8;
  border-radius: 6px;
  padding: 4px;
  scroll-padding-block: 4px;
  align-content: start;
}
.ability-show-results {
  justify-self: start;
  min-height: 44px;
  background: #dceeed;
  border-color: #327579;
  font-weight: 700;
}
.ability-option {
  display: flex;
  align-items: start;
  gap: 8px;
  padding: 9px;
  background: #f3f7f7;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  min-width: 0;
}
.ability-option:has(input:checked) {
  background: #e1efee;
}
.ability-option input {
  margin: 5px 0 0;
  flex-shrink: 0;
  scroll-margin-block: 4px;
}
.ability-option > span {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.ability-option small {
  display: block;
  color: #52696c;
}
.ability-count {
  white-space: nowrap;
}
input {
  accent-color: #287579;
}
:is(button, input, summary, .ability-checklist, .ability-chosen-items):focus-visible {
  outline: 2px solid #287579;
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .ability-checklist {
    grid-template-columns: minmax(0, 1fr);
  }
  summary span {
    display: block;
    margin-left: 0;
  }
}
</style>
