<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '../common/StatusBadge.vue'
import { scoreTypes, type TypeScores } from '../../scoring/scoreMath'
import {
  lessonCountLimit,
  requiredSpLessons,
  type SpLessonDays,
} from '../../scoring/conditions/conditions'
import {
  configurableActions,
  actionCountLabels,
  type ActionCounts,
} from '../../scoring/conditions/actionConditions'
import type { ExamRatios } from '../../scoring/conditions/examConditions'
import {
  operationSettingFields,
  type OperationSettings,
} from '../../scoring/conditions/operationSettings'

const props = defineProps<{
  counts: TypeScores
  days: SpLessonDays
  actions: ActionCounts
  exams: ExamRatios
  operations: OperationSettings
}>()
const minimum = computed(() => requiredSpLessons(props.counts, props.days))
const assigned = computed(() => scoreTypes.reduce((sum, type) => sum + minimum.value[type], 0))
const actionEntries = computed(() =>
  configurableActions.filter((key) => props.actions[key] !== undefined),
)
const examEntries = computed(() => Object.entries(props.exams))
const operationGroups = computed(() =>
  [
    { key: 'consultation', label: '相談1回あたり' },
    { key: 'special_training', label: 'カスタマイズ' },
  ]
    .map((group) => ({
      ...group,
      fields: operationSettingFields.filter(
        (field) => field.group === group.key && props.operations[field.key] !== undefined,
      ),
    }))
    .filter((group) => group.fields.length),
)
const active = computed(
  () =>
    assigned.value ||
    actionEntries.value.length ||
    examEntries.value.length ||
    operationGroups.value.length,
)
</script>

<template>
  <div
    v-if="active"
    class="active-conditions-summary"
    role="region"
    aria-label="指定中の育成条件"
  >
    <article
      v-if="assigned"
      class="condition-summary-card"
      aria-labelledby="summary-sp-title"
    >
      <div class="condition-summary-heading">
        <h3 id="summary-sp-title">SPレッスン</h3>
        <span>最低確保</span>
      </div>
      <dl class="summary-sp-types">
        <div
          v-for="type in scoreTypes"
          :key="type"
          :class="{ 'is-zero': !minimum[type] }"
        >
          <dt>
            <StatusBadge
              :kind="type"
              small
            />
          </dt>
          <dd>
            <strong>{{ minimum[type] }}</strong>回以上
          </dd>
        </div>
      </dl>
      <p class="condition-summary-note">
        残り<strong>{{ lessonCountLimit - assigned }}</strong
        >回は自動配分<span v-if="Object.keys(days).length">
          ／ 日別指定{{ Object.keys(days).length }}枠</span
        >
      </p>
    </article>
    <article
      v-if="examEntries.length"
      class="condition-summary-card"
      aria-labelledby="summary-exams-title"
    >
      <div class="condition-summary-heading">
        <h3 id="summary-exams-title">選抜試験の配分</h3>
        <span>比率</span>
      </div>
      <dl class="summary-exam-rows">
        <div
          v-for="[exam, ratio] in examEntries"
          :key="exam"
        >
          <dt>試験{{ exam }}</dt>
          <dd>
            <span
              v-for="type in scoreTypes"
              :key="type"
              :class="{ 'is-zero': !ratio[type] }"
              ><StatusBadge
                :kind="type"
                small
              /><strong>{{ ratio[type] }}</strong></span
            >
          </dd>
        </div>
      </dl>
    </article>
    <article
      v-if="actionEntries.length"
      class="condition-summary-card"
      aria-labelledby="summary-actions-title"
    >
      <div class="condition-summary-heading">
        <h3 id="summary-actions-title">行動回数</h3>
        <span>固定</span>
      </div>
      <dl class="condition-summary-values">
        <div
          v-for="action in actionEntries"
          :key="action"
        >
          <dt>{{ actionCountLabels[action] }}</dt>
          <dd>
            <strong>{{ actions[action] }}</strong>回
          </dd>
        </div>
      </dl>
    </article>
    <article
      v-if="operationGroups.length"
      class="condition-summary-card"
      aria-labelledby="summary-operations-title"
    >
      <div class="condition-summary-heading">
        <h3 id="summary-operations-title">操作数</h3>
        <span>変更分</span>
      </div>
      <div
        v-for="group in operationGroups"
        :key="group.key"
        class="summary-operation-group"
      >
        <h4>{{ group.label }}</h4>
        <dl class="condition-summary-values">
          <div
            v-for="field in group.fields"
            :key="field.key"
          >
            <dt>
              {{
                field.key === 'special_training_customizations'
                  ? '特別指導（1回）'
                  : field.key === 'interval_customizations'
                    ? 'インターバル'
                    : field.label
              }}
            </dt>
            <dd>
              <strong>{{ operations[field.key] }}</strong>{{ field.unit }}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  </div>
</template>

<style scoped>
.active-conditions-summary {
  display: grid;
  align-items: start;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 10px;
  margin: 14px 0;
  color: #26394a;
  font-size: 0.8rem;
}
.condition-summary-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid #c8dedf;
  border-radius: 8px;
  background: linear-gradient(145deg, #f9fdfd, #f0f8f8);
}
.condition-summary-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.condition-summary-heading h3 {
  margin: 0;
  color: #245c55;
  font-size: 0.85rem;
}
.condition-summary-heading > span {
  padding: 1px 6px;
  border-radius: 4px;
  background: #e4f0ee;
  color: #546e70;
  font-size: 0.65rem;
  white-space: nowrap;
}
dl,
dd {
  margin: 0;
}
strong {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.status-badge {
  margin-right: 0;
}
.summary-sp-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.summary-sp-types > div {
  display: flex;
  align-items: center;
  gap: 4px;
}
.summary-sp-types dt {
  display: flex;
}
.summary-sp-types dd {
  white-space: nowrap;
}
.is-zero strong {
  color: #74848e;
  font-weight: 500;
}
.condition-summary-note {
  margin: 8px 0 0;
  color: #60747d;
  font-size: 0.75rem;
}
.condition-summary-note strong {
  padding-inline: 2px;
  font-size: inherit;
  color: #245c55;
}
.summary-exam-rows {
  display: grid;
  gap: 6px;
}
.summary-exam-rows > div {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.summary-exam-rows dt {
  color: #60747d;
}
.summary-exam-rows dd {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.summary-exam-rows dd > span {
  display: flex;
  align-items: center;
  gap: 4px;
}
.condition-summary-values {
  display: grid;
  gap: 6px;
}
.condition-summary-values > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.condition-summary-values dt {
  min-width: 0;
  overflow-wrap: anywhere;
}
.condition-summary-values dd {
  white-space: nowrap;
}
.condition-summary-values dd strong {
  padding-right: 3px;
}
.summary-operation-group + .summary-operation-group {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #dbe8e8;
}
.summary-operation-group h4 {
  margin: 0 0 6px;
  color: #60747d;
  font-size: 0.7rem;
  font-weight: 500;
}
</style>
