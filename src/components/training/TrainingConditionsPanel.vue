<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import StatusBadge from '../common/StatusBadge.vue'
import {
  scoreTypes,
  emptyTypeScores,
  type ScoreType,
  type TypeScores,
} from '../../scoring/scoreMath'
import {
  averageSpLessonGain,
  lessonCountLimit,
  requiredSpLessons,
  spLessonDays,
  spLessonDayLabel,
  parameterLessonBases,
  normalizeConditions,
  hasSpConditions,
  type SpLessonDays,
} from '../../scoring/conditions/conditions'
import { typeLabels } from '../../data/cards'
import { consultationRefreshMultiplier } from '../../scoring/scoringCounts'
import {
  parameterBonusLessonRewards,
  parameterBonusBase,
  parameterBonusLessonBase,
  parameterBonusExamRewards,
} from '../../scoring/scoringConfig'
import {
  normalizeExamRatios,
  examParameterBases,
  type ExamRatios,
  type ExamNumber,
} from '../../scoring/conditions/examConditions'
import {
  configurableActions,
  actionCountLabels,
  actionCountLimit,
  actionScheduleMatcher,
  type ActionCounts,
  type ConfigurableAction,
} from '../../scoring/conditions/actionConditions'
import {
  operationSettingFields,
  operationSettingValue,
  normalizeOperationSettings,
  type OperationSettings,
  type OperationSettingKey,
} from '../../scoring/conditions/operationSettings'

const open = defineModel<boolean>('open', { required: true })
const counts = defineModel<TypeScores>('counts', { required: true })
const days = defineModel<SpLessonDays>('days', { required: true })
const actions = defineModel<ActionCounts>('actions', { required: true })
const exams = defineModel<ExamRatios>('exams', { required: true })
const operations = defineModel<OperationSettings>('operations', { required: true })
const specifiedOperations = computed(() => Object.keys(operations.value).length)
const operationFieldsByGroup = {
  consultation: operationSettingFields.filter((field) => field.group === 'consultation'),
  special_training: operationSettingFields.filter((field) => field.group === 'special_training'),
}
function setOperationSetting(key: OperationSettingKey, requestedValue: number) {
  if (!Number.isFinite(requestedValue)) {
    return
  }
  const field = operationSettingFields.find((field) => field.key === key)!
  const value = Math.max(0, Math.min(field.max, Math.trunc(requestedValue)))
  if (value === operationSettingValue(operations.value, key)) {
    return
  }
  operations.value = normalizeOperationSettings({ ...operations.value, [key]: value }) ?? {}
}
function inputOperationSetting(key: OperationSettingKey, event: Event) {
  const input = event.target as HTMLInputElement
  setOperationSetting(key, input.value === '' ? 0 : input.valueAsNumber)
  input.value = String(operationSettingValue(operations.value, key))
}
function resetOperationGroup(group: string) {
  const next = { ...operations.value }
  for (const field of operationSettingFields.filter((field) => field.group === group))
    delete next[field.key]
  operations.value = next
}
const specifiedExams = computed(() => Object.keys(exams.value).length)
const examBases = computed(() => examParameterBases(exams.value))
function updateExamRatio(exam: ExamNumber, type: ScoreType, requestedValue: number) {
  const value = Math.max(0, Math.min(100, Math.trunc(requestedValue)))
  if ((exams.value[exam]?.[type] ?? 0) === value) {
    return
  }
  exams.value =
    normalizeExamRatios({
      ...exams.value,
      [exam]: { ...(exams.value[exam] ?? emptyTypeScores()), [type]: value },
    }) ?? {}
}
const splitExamPresets = [
  { key: 'vo-da', types: ['vo', 'da'] },
  { key: 'da-vi', types: ['da', 'vi'] },
  { key: 'vo-vi', types: ['vo', 'vi'] },
  { key: 'equal', types: ['vo', 'da', 'vi'] },
] as const
function setAllExamRatios(types: readonly ScoreType[]) {
  exams.value = Object.fromEntries(
    parameterBonusExamRewards.map((entry) => [
      entry.examNumber,
      Object.fromEntries(
        scoreTypes.map((type) => [type, types.includes(type) ? 1 : 0]),
      ) as TypeScores,
    ]),
  )
}
function allExamsFocusedOn(types: readonly ScoreType[]) {
  return parameterBonusExamRewards.every((entry) => {
    const row = exams.value[entry.examNumber]
    const weight = row?.[types[0]!] ?? 0
    return (
      weight > 0 && scoreTypes.every((type) => row?.[type] === (types.includes(type) ? weight : 0))
    )
  })
}
function setExamRatio(exam: ExamNumber, type: ScoreType, event: Event) {
  const input = event.target as HTMLInputElement
  if (!Number.isFinite(input.valueAsNumber) && input.value !== '') {
    return
  }
  const value = input.value === '' ? 0 : Math.max(0, Math.min(100, Math.trunc(input.valueAsNumber)))
  updateExamRatio(exam, type, value)
  input.value = String(value)
}
const ratioNumber = (value: number) =>
  value.toLocaleString('ja-JP', { useGrouping: false, maximumFractionDigits: 4 })
const rejectedChange = ref<{ target: string; message: string; sequence: number } | null>(null)
const highlightedTarget = ref('')
let rejectionSequence = 0
let rejectionTimer: ReturnType<typeof setTimeout> | undefined
function clearRejection() {
  rejectedChange.value = null
  highlightedTarget.value = ''
  clearTimeout(rejectionTimer)
}
function showRejection(target: string, message: string) {
  clearTimeout(rejectionTimer)
  rejectedChange.value = { target, message, sequence: ++rejectionSequence }
  highlightedTarget.value = target
  rejectionTimer = setTimeout(() => {
    highlightedTarget.value = ''
  }, 1800)
  nextTick(() =>
    document.getElementById(`condition-feedback-${target}`)?.scrollIntoView({ block: 'nearest' }),
  )
}
const feedbackId = (target: string) =>
  rejectedChange.value?.target === target ? `condition-feedback-${target}` : undefined
const props = defineProps<{ detailOpen: boolean }>()
const required = computed(() => requiredSpLessons(counts.value, days.value))
const assigned = computed(() => scoreTypes.reduce((sum, type) => sum + required.value[type], 0))
const fixedDaysCount = computed(() => Object.keys(days.value).length)
const specifiedActions = computed(() => Object.keys(actions.value).length)
const forceSp = computed(() =>
  hasSpConditions({ spLessons: counts.value, spLessonDays: days.value }),
)
function validConditions(
  nextCounts = counts.value,
  nextDays = days.value,
  nextActions = actions.value,
  report = true,
  attempt?: { target: string; description: string },
) {
  try {
    normalizeConditions({
      spLessons: nextCounts,
      spLessonDays: nextDays,
      actionCounts: nextActions,
      examRatios: exams.value,
      operationSettings: operations.value,
    })
    if (report) {
      clearRejection()
    }
    return true
  } catch (cause) {
    if (report) {
      const reason = cause instanceof Error ? cause.message : '指定を確認してください。'
      const explanation =
        reason === 'この行動回数は同日の排他・休める日の条件を同時に満たせません。'
          ? 'この回数では育成日程を組めません。同じ日に選べる行動は1つで、休める日にも制限があります。回数を変えるか、自動に戻してください。'
          : reason
      showRejection(attempt?.target ?? 'sp', `${attempt?.description ?? ''}${explanation}`)
    }
    return false
  }
}
function setActionCount(action: ConfigurableAction, value?: number) {
  if (value !== undefined && !Number.isFinite(value)) {
    return
  }
  const next = { ...actions.value }
  if (value === undefined) {
    delete next[action]
  } else {
    next[action] = Math.max(0, Math.min(actionCountLimit(action, forceSp.value), Math.trunc(value)))
  }
  if (
    validConditions(counts.value, days.value, next, true, {
      target: `action-${action}`,
      description: `${actionCountLabels[action]}を${value === undefined ? '自動' : `${next[action]}回`}に変更できません。`,
    })
  ) {
    actions.value = next
  }
}
function inputActionCount(action: ConfigurableAction, event: Event) {
  const input = event.target as HTMLInputElement
  setActionCount(action, input.value === '' ? undefined : input.valueAsNumber)
  input.value = actions.value[action] === undefined ? '' : String(actions.value[action])
}
const dayOptions = ['', ...scoreTypes] as const
const remainingBasis = computed(() => parameterLessonBases(required.value, days.value).vo)
const menu = ref<HTMLElement | null>(null)
const opener = ref<HTMLButtonElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const relocating = ref(false)
let relocationFrame = 0
function closeMenu() {
  open.value = false
  nextTick(() => opener.value?.focus({ preventScroll: true }))
}
function maxFor(type: ScoreType) {
  return lessonCountLimit - assigned.value + required.value[type]
}
// 日別にタイプを指定すると全8枠SPになる。行動指定との両立判定は全ボタンで共通。
// 試験比率・操作数・メニュー開閉は、この日程の可否を変えない。
const allowsFixedSpDays = computed(() => actionScheduleMatcher(actions.value, true)(1, false, {}))
function canAssignDay(day: number, type: ScoreType) {
  const minimum = requiredSpLessons(counts.value, { ...days.value, [day]: type })
  return (
    scoreTypes.reduce((sum, key) => sum + minimum[key], 0) <= lessonCountLimit &&
    allowsFixedSpDays.value
  )
}
function setDay(day: number, type: ScoreType | '') {
  if (type && !canAssignDay(day, type)) {
    return
  }
  const next = { ...days.value }
  if (type) {
    next[day] = type
  } else {
    delete next[day]
  }
  if (!validConditions(counts.value, next)) {
    return
  }
  days.value = next
}
function resetConditions() {
  counts.value = emptyTypeScores()
  days.value = {}
  actions.value = {}
  exams.value = {}
  operations.value = {}
  clearRejection()
}
function setCount(type: ScoreType, value: number) {
  if (!Number.isFinite(value)) {
    return
  }
  const next = { ...counts.value, [type]: Math.max(0, Math.min(maxFor(type), Math.trunc(value))) }
  if (
    validConditions(next, days.value, actions.value, true, {
      target: `sp-${type}`,
      description: `${typeLabels[type]}のSPレッスンを${next[type]}回に変更できません。`,
    })
  ) {
    counts.value = next
  }
}
function inputCount(type: ScoreType, event: Event) {
  const input = event.target as HTMLInputElement
  setCount(type, input.value === '' ? 0 : input.valueAsNumber)
  input.value = String(counts.value[type])
}
watch(
  open,
  async (isOpen) => {
    await nextTick()
    if (isOpen && open.value) {
      closeButton.value?.focus({ preventScroll: true })
    }
  },
  { flush: 'post' },
)
// Moving a popover into or out of a modal can remove it from the top layer.
// Restore it after Teleport without replaying the slide or stealing focus.
watch(
  () => props.detailOpen,
  async () => {
    relocating.value = true
    cancelAnimationFrame(relocationFrame)
    await nextTick()
    if (!menu.value?.matches(':popover-open')) {
      menu.value?.showPopover()
    }
    relocationFrame = requestAnimationFrame(() => {
      relocationFrame = requestAnimationFrame(() => (relocating.value = false))
    })
  },
)
watch(menu, (element) => element?.showPopover(), { flush: 'post' })
onBeforeUnmount(() => {
  clearTimeout(rejectionTimer)
  cancelAnimationFrame(relocationFrame)
})
</script>

<template>
  <div
    ref="menu"
    popover="manual"
    class="conditions-menu"
    :class="{ 'is-open': open, 'is-relocating': relocating }"
  >
    <button
      ref="opener"
      type="button"
      class="conditions-open-tab"
      aria-controls="training-conditions"
      :aria-expanded="open"
      @click="open ? closeMenu() : (open = true)"
    >
      <svg
        class="conditions-tab-arrow"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M3 4.5 6 7.5 9 4.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="conditions-tab-label">育成条件</span>
      <span
        v-if="assigned || specifiedActions || specifiedExams || specifiedOperations"
        class="conditions-active-dot"
        aria-label="条件指定中"
      ></span>
    </button>
    <aside
      id="training-conditions"
      :inert="!open"
      :aria-hidden="!open"
      class="training-conditions"
      aria-labelledby="training-conditions-title"
    >
      <div class="training-conditions-header">
        <h2 id="training-conditions-title">育成条件</h2>
        <button
          ref="closeButton"
          type="button"
          class="conditions-close"
          aria-label="育成条件を閉じる"
          @click="closeMenu"
        >
          ×
        </button>
      </div>
      <div class="training-conditions-content">
        <section
          class="training-condition-section"
          aria-labelledby="sp-lessons-title"
        >
          <h3 id="sp-lessons-title">SPレッスン</h3>
          <p class="conditions-help">
            指定分を確保し、残りはカード毎に最も有利なタイプへ配分します。
          </p>
          <div class="lesson-count-rows">
            <div
              v-for="type in scoreTypes"
              :key="type"
              class="lesson-count-row"
              :class="{ 'is-rejected': highlightedTarget === `sp-${type}` }"
            >
              <label :for="`sp-count-${type}`"><StatusBadge :kind="type" /></label>
              <div class="lesson-count-control">
                <button
                  type="button"
                  :aria-label="`${typeLabels[type]}を1回減らす`"
                  :disabled="counts[type] === 0"
                  @click="setCount(type, counts[type] - 1)"
                >
                  −
                </button>
                <input
                  :id="`sp-count-${type}`"
                  :value="counts[type]"
                  type="number"
                  min="0"
                  :max="maxFor(type)"
                  step="1"
                  inputmode="numeric"
                  :aria-label="`${typeLabels[type]}のSPレッスン指定回数`"
                  :aria-describedby="feedbackId(`sp-${type}`)"
                  @change="inputCount(type, $event)"
                />
                <button
                  type="button"
                  :aria-label="`${typeLabels[type]}を1回増やす`"
                  :disabled="counts[type] >= maxFor(type)"
                  @click="setCount(type, counts[type] + 1)"
                >
                  ＋
                </button>
              </div>
              <span>回</span>
              <p
                v-if="rejectedChange?.target === `sp-${type}`"
                :id="feedbackId(`sp-${type}`)"
                :key="rejectedChange.sequence"
                class="conditions-error condition-feedback"
                role="alert"
                aria-atomic="true"
              >
                {{ rejectedChange.message }}
              </p>
            </div>
          </div>
          <p
            v-if="rejectedChange?.target === 'sp'"
            id="condition-feedback-sp"
            class="conditions-error condition-feedback"
            role="alert"
          >
            {{ rejectedChange.message }}
          </p>
          <div
            class="lesson-count-summary"
            aria-live="polite"
          >
            <strong>確保 {{ assigned }} / {{ lessonCountLimit }}回</strong>
            <span v-if="assigned">残り{{ lessonCountLimit - assigned }}回は自動</span>
            <span v-else>SP未指定：カードごとに最適化</span>
          </div>
          <p
            v-if="!fixedDaysCount && assigned"
            class="conditions-help"
          >
            基準値に使う上昇値：1回平均{{ averageSpLessonGain }}
          </p>
          <p
            v-else-if="fixedDaysCount"
            class="conditions-help"
          >
            パラボ：指定日は日ごとの上昇値<span v-if="remainingBasis.remainingCount"
              >、自動日は残り{{ remainingBasis.remainingCount }}日の平均{{
                remainingBasis.average.toLocaleString('ja-JP', { maximumFractionDigits: 4 })
              }}</span
            ><span v-else>（全日指定済み）</span>
          </p>
          <p
            v-else
            class="conditions-help"
          >
            <template v-if="specifiedExams"
              >SP未指定のレッスン上昇値：{{
                parameterBonusLessonBase
              }}。試験分は下の配分設定を使います。</template
            >
            <template v-else>SP未指定のパラボ基準値：{{ parameterBonusBase }}</template>
          </p>
          <details class="conditions-advanced">
            <summary>
              日別に詳しく指定<span v-if="fixedDaysCount">（{{ fixedDaysCount }}枠）</span>
            </summary>
            <div class="conditions-advanced-content">
              <p class="conditions-help">
                選んだ日はそのタイプのSPに固定します。指定中は全8枠をSPとし、自動の日のタイプはカードごとに最適化します。
              </p>
              <div class="lesson-day-rows">
                <div
                  v-for="day in spLessonDays"
                  :key="day"
                  class="lesson-day-row"
                >
                  <div
                    :id="`sp-day-label-${day}`"
                    class="lesson-day-label"
                  >
                    {{ spLessonDayLabel(day)
                    }}<small
                      >SP上昇{{
                        parameterBonusLessonRewards.find((entry) => entry.day === day)!.sp
                      }}</small
                    >
                  </div>
                  <div
                    :id="`sp-day-${day}`"
                    class="limit-selector lesson-day-selector"
                    role="group"
                    :aria-labelledby="`sp-day-label-${day}`"
                    :style="{ '--selected-limit': dayOptions.indexOf(days[day] ?? '') }"
                  >
                    <button
                      v-for="type in dayOptions"
                      :key="type"
                      type="button"
                      :data-lesson-type="type"
                      :aria-label="`${spLessonDayLabel(day)}：${type ? `${typeLabels[type]} SP` : '自動'}`"
                      :aria-pressed="(days[day] ?? '') === type"
                      :disabled="!!type && !canAssignDay(day, type)"
                      @click="setDay(day, type)"
                    >
                      <StatusBadge
                        v-if="type"
                        :kind="type"
                        small
                      />
                      <template v-else>自動</template>
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="conditions-reset"
                :disabled="!fixedDaysCount"
                @click="days = {}"
              >
                日別指定だけ解除
              </button>
            </div>
          </details>
        </section>
        <section
          class="training-condition-section"
          aria-labelledby="exam-ratios-title"
        >
          <h3 id="exam-ratios-title">選抜試験の配分割合</h3>
          <p class="conditions-help">
            Vo：Da：Viの比率を指定します（1：1：1で均等）。未指定の場合は最適化された理想配分を使います。固定上昇分は変わりません。
          </p>
          <div
            class="exam-ratio-presets"
            role="group"
            aria-label="全選抜試験の一括配分"
          >
            <button
              v-for="type in scoreTypes"
              :key="type"
              type="button"
              :data-exam-focus="type"
              :aria-label="`全選抜試験を${typeLabels[type]}へ極振り`"
              :aria-pressed="allExamsFocusedOn([type])"
              @click="setAllExamRatios([type])"
            >
              <StatusBadge
                :kind="type"
                small
              />極振り
            </button>
            <button
              v-for="preset in splitExamPresets"
              :key="preset.key"
              type="button"
              :data-exam-preset="preset.key"
              :class="{ 'exam-ratio-balanced': preset.types.length === 3 }"
              :aria-label="`全選抜試験を${preset.types.map((type) => typeLabels[type]).join('・')}に均等配分`"
              :aria-pressed="allExamsFocusedOn(preset.types)"
              @click="setAllExamRatios(preset.types)"
            >
              <StatusBadge
                v-for="type in preset.types"
                :key="type"
                :kind="type"
                small
              />
              {{ preset.types.length === 3 ? '3分割' : '2極' }}
            </button>
          </div>
          <div class="exam-ratio-rows">
            <div
              v-for="entry in parameterBonusExamRewards"
              :key="entry.examNumber"
              class="exam-ratio-row"
              role="group"
              :aria-labelledby="`exam-ratio-title-${entry.examNumber}`"
            >
              <h4 :id="`exam-ratio-title-${entry.examNumber}`">
                選抜試験{{ entry.examNumber }}<small>配分上昇値 {{ entry.allocatable }}</small>
              </h4>
              <div class="exam-ratio-inputs">
                <div
                  class="exam-ratio-type"
                  v-for="type in scoreTypes"
                  :key="type"
                >
                  <label :for="`exam-ratio-${entry.examNumber}-${type}`">
                    <StatusBadge
                      :kind="type"
                      small
                    />
                    <input
                      :id="`exam-ratio-${entry.examNumber}-${type}`"
                      :value="exams[entry.examNumber]?.[type] ?? 0"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      inputmode="numeric"
                      :aria-label="`選抜試験${entry.examNumber}の${typeLabels[type]}配分比率`"
                      @input="setExamRatio(entry.examNumber, type, $event)"
                      @change="setExamRatio(entry.examNumber, type, $event)"
                    />
                  </label>
                  <div class="exam-ratio-stepper">
                    <button
                      :id="`exam-step-${entry.examNumber}-${type}-decrease`"
                      type="button"
                      :aria-label="`選抜試験${entry.examNumber}の${typeLabels[type]}配分比率を1減らす`"
                      :disabled="!exams[entry.examNumber]?.[type]"
                      @click="
                        updateExamRatio(
                          entry.examNumber,
                          type,
                          (exams[entry.examNumber]?.[type] ?? 0) - 1,
                        )
                      "
                    >
                      −
                    </button>
                    <button
                      :id="`exam-step-${entry.examNumber}-${type}-increase`"
                      type="button"
                      :aria-label="`選抜試験${entry.examNumber}の${typeLabels[type]}配分比率を1増やす`"
                      :disabled="exams[entry.examNumber]?.[type] === 100"
                      @click="
                        updateExamRatio(
                          entry.examNumber,
                          type,
                          (exams[entry.examNumber]?.[type] ?? 0) + 1,
                        )
                      "
                    >
                      ＋
                    </button>
                  </div>
                </div>
              </div>
              <p
                class="conditions-help exam-ratio-result"
                v-if="exams[entry.examNumber]"
              >
                配分：{{
                  scoreTypes
                    .map(
                      (type) =>
                        `${typeLabels[type]} ${ratioNumber(examBases[type].rows.find((row) => row.examNumber === entry.examNumber)!.allocated)}`,
                    )
                    .join('・')
                }}
              </p>
              <p
                class="conditions-help exam-ratio-result"
                v-else
              >
                未指定：カードごとの理想配分
              </p>
            </div>
          </div>
          <button
            type="button"
            class="conditions-reset"
            :disabled="!specifiedExams"
            @click="exams = {}"
          >
            試験の配分指定だけ解除
          </button>
        </section>
        <section
          class="training-condition-section"
          aria-labelledby="action-counts-title"
        >
          <h3 id="action-counts-title">その他の行動回数</h3>
          <p class="conditions-help">
            指定した回数ちょうどで計算します。「自動」はカードごとに最適化し、0回も指定できます。
          </p>
          <div class="lesson-count-rows">
            <template
              v-for="action in configurableActions"
              :key="action"
            >
              <div
                class="action-count-row"
                :class="{ 'is-rejected': highlightedTarget === `action-${action}` }"
              >
                <label :for="`action-count-${action}`"
                  >{{ actionCountLabels[action]
                  }}<small :id="`action-count-max-${action}`"
                    >最大{{ actionCountLimit(action, forceSp) }}回</small
                  ></label
                >
                <div class="lesson-count-control">
                  <button
                    type="button"
                    :aria-label="`${actionCountLabels[action]}を1回減らす`"
                    :disabled="actions[action] === undefined || actions[action] === 0"
                    @click="setActionCount(action, actions[action]! - 1)"
                  >
                    −
                  </button>
                  <input
                    :id="`action-count-${action}`"
                    :value="actions[action] ?? ''"
                    type="number"
                    min="0"
                    :max="actionCountLimit(action, forceSp)"
                    step="1"
                    inputmode="numeric"
                    placeholder="自動"
                    :aria-label="`${actionCountLabels[action]}の指定回数`"
                    :aria-describedby="
                      [`action-count-max-${action}`, feedbackId(`action-${action}`)]
                        .filter(Boolean)
                        .join(' ')
                    "
                    @change="inputActionCount(action, $event)"
                  />
                  <button
                    type="button"
                    :aria-label="`${actionCountLabels[action]}を1回増やす`"
                    :disabled="actions[action] === actionCountLimit(action, forceSp)"
                    @click="
                      setActionCount(
                        action,
                        actions[action] === undefined
                          ? action === 'consultation'
                            ? 1
                            : 0
                          : actions[action]! + 1,
                      )
                    "
                  >
                    ＋
                  </button>
                </div>
                <button
                  type="button"
                  class="action-count-auto"
                  :aria-label="`${actionCountLabels[action]}を自動にする`"
                  :aria-pressed="actions[action] === undefined"
                  @click="setActionCount(action)"
                >
                  自動
                </button>
                <p
                  v-if="rejectedChange?.target === `action-${action}`"
                  :id="feedbackId(`action-${action}`)"
                  :key="rejectedChange.sequence"
                  class="conditions-error condition-feedback"
                  role="alert"
                  aria-atomic="true"
                >
                  {{ rejectedChange.message }}
                </p>
              </div>
              <div
                v-if="action === 'consultation' || action === 'special_training'"
                class="action-subsettings"
              >
                <p class="conditions-help">
                  {{
                    action === 'consultation'
                      ? `相談1回あたり（リフレッシュ時は各操作数が${consultationRefreshMultiplier}倍）`
                      : '特別指導1回あたり'
                  }}
                </p>
                <div
                  v-for="field in operationFieldsByGroup[action]"
                  :key="field.key"
                  class="operation-setting-row"
                >
                  <label :for="`operation-${field.key}`"
                    >{{ field.label }}<small>最大{{ field.max }}{{ field.unit }}</small></label
                  >
                  <div class="lesson-count-control">
                    <button
                      type="button"
                      :aria-label="`${field.label}を1${field.unit}減らす`"
                      :disabled="operationSettingValue(operations, field.key) === 0"
                      @click="
                        setOperationSetting(
                          field.key,
                          operationSettingValue(operations, field.key) - 1,
                        )
                      "
                    >
                      −
                    </button>
                    <input
                      :id="`operation-${field.key}`"
                      :value="operationSettingValue(operations, field.key)"
                      type="number"
                      min="0"
                      :max="field.max"
                      step="1"
                      inputmode="numeric"
                      :aria-label="`${field.label}の操作数`"
                      @input="inputOperationSetting(field.key, $event)"
                      @change="inputOperationSetting(field.key, $event)"
                    />
                    <button
                      type="button"
                      :aria-label="`${field.label}を1${field.unit}増やす`"
                      :disabled="operationSettingValue(operations, field.key) === field.max"
                      @click="
                        setOperationSetting(
                          field.key,
                          operationSettingValue(operations, field.key) + 1,
                        )
                      "
                    >
                      ＋
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  class="operation-group-reset"
                  :disabled="
                    !operationSettingFields.some(
                      (field) => field.group === action && operations[field.key] !== undefined,
                    )
                  "
                  @click="resetOperationGroup(action)"
                >
                  標準に戻す
                </button>
              </div>
            </template>
          </div>
        </section>
      </div>
      <button
        type="button"
        class="conditions-reset conditions-reset-footer"
        :disabled="assigned === 0 && !specifiedActions && !specifiedExams && !specifiedOperations"
        @click="resetConditions"
      >
        指定を解除
      </button>
    </aside>
  </div>
</template>
