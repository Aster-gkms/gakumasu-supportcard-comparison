<script setup lang="ts">
import EffectTooltip from '../common/EffectTooltip.vue'
import { computed } from 'vue'
import type { ExamParameterBasis } from '../../scoring/conditions/examConditions'
import {
  averageSpLessonGain,
  type SpLessonParameterBasis,
} from '../../scoring/conditions/conditions'
import {
  parameterBonusBase,
  parameterBonusLessonRewards,
  parameterBonusExamRewards,
  parameterBonusLessonBase,
  parameterBonusExamBase,
} from '../../scoring/scoringConfig'
const props = withDefaults(
  defineProps<{
    base?: number
    spLessons?: number
    lessonBasis?: SpLessonParameterBasis
    examBasis?: ExamParameterBasis
  }>(),
  {
    base: parameterBonusBase,
  },
)
const lessonBase = computed(
  () =>
    props.lessonBasis?.gain ??
    (props.spLessons === undefined
      ? parameterBonusLessonBase
      : props.spLessons * averageSpLessonGain),
)
const numberText = (value: number) =>
  value.toLocaleString('ja-JP', { useGrouping: false, maximumFractionDigits: 4 })
function groupLessonDays(entries: readonly { day: number; gain: number }[]) {
  const groups = new Map<number, number[]>()
  for (const entry of entries)
    groups.set(entry.gain, [...(groups.get(entry.gain) ?? []), entry.day])
  return [...groups].map(([gain, days]) => {
    const selection = days.filter((day) => day <= 20)
    const finals = days.filter((day) => day > 20)
    const label = [
      selection.length ? `選抜${selection.join('・')}日目` : '',
      finals.length ? `本戦${finals.map((day) => day - 20).join('・')}日目` : '',
    ]
      .filter(Boolean)
      .join('・')
    return { gain, count: days.length, label }
  })
}
const fixedLessonRows = computed(() => groupLessonDays(props.lessonBasis?.fixed ?? []))
const idealLessonRows = computed(() =>
  groupLessonDays(parameterBonusLessonRewards.map((entry) => ({ day: entry.day, gain: entry.sp }))),
)
</script>

<template>
  <EffectTooltip label="基準値">
    <div class="parameter-bonus-basis">
      <p class="parameter-bonus-basis-title">基準値の内訳（合計 {{ numberText(base) }}）</p>
      <p class="parameter-bonus-basis-note">
        {{
          lessonBasis
            ? '指定日は日ごとの上昇値、自動の日は全タイプの未指定日を合わせた平均値を使います。'
            : spLessons === undefined
              ? 'レッスン上昇値を対象タイプへ寄せた前提です。'
              : 'SPレッスンは全体の平均値を使います。'
        }}
      </p>
      <p class="parameter-bonus-basis-note">
        {{
          examBasis
            ? '試験の配分上昇値は指定比率で計算し、未指定の試験は対象タイプへ寄せます。'
            : '試験の配分上昇値は対象タイプへ寄せた前提です。'
        }}
      </p>
      <h5>SPレッスン：{{ numberText(lessonBase) }}</h5>
      <template v-if="lessonBasis">
        <table v-if="lessonBasis.fixed.length">
          <thead>
            <tr>
              <th>指定日</th>
              <th>上昇量</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in fixedLessonRows"
              :key="entry.gain"
            >
              <th>{{ entry.label }}</th>
              <td>
                {{ entry.gain }}<template v-if="entry.count > 1"> × {{ entry.count }}回</template>
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-else
          class="parameter-bonus-basis-note"
        >
          このタイプの指定日からの加算：0
        </p>
        <template v-if="lessonBasis.remainingCount">
          <p class="parameter-bonus-basis-note">
            未指定日の合計{{ lessonBasis.remainingTotal }} ÷ {{ lessonBasis.remainingCount }}日 ＝
            平均{{ numberText(lessonBasis.average) }}
          </p>
          <p class="parameter-bonus-basis-note">
            自動{{ lessonBasis.automaticCount }}回 × 平均{{ numberText(lessonBasis.average) }} ＝
            {{ numberText(lessonBasis.automaticGain) }}
          </p>
        </template>
        <p
          v-else
          class="parameter-bonus-basis-note"
        >
          全日指定済み（自動配分なし）
        </p>
        <p class="parameter-bonus-basis-note">
          平均値・基準値は丸めずに計算し、パラボの得点で切り捨てます。表示の小数は最大4桁です。
        </p>
      </template>
      <p
        v-else-if="spLessons !== undefined"
        class="parameter-bonus-basis-note"
      >
        {{ spLessons }}回 × 平均{{ averageSpLessonGain }} ＝ {{ lessonBase }}
      </p>
      <table v-else>
        <thead>
          <tr>
            <th>日程</th>
            <th>上昇量</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in idealLessonRows"
            :key="entry.gain"
          >
            <th>{{ entry.label }}</th>
            <td>
              {{ entry.gain }}<template v-if="entry.count > 1"> × {{ entry.count }}回</template>
            </td>
          </tr>
        </tbody>
      </table>
      <h5>選抜試験：{{ numberText(examBasis?.total ?? parameterBonusExamBase) }}</h5>
      <table>
        <thead>
          <tr>
            <th>試験</th>
            <th>固定上昇値</th>
            <th>配分上昇値</th>
            <th>小計</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in examBasis?.rows ??
            parameterBonusExamRewards.map((entry) => ({ ...entry, allocated: entry.allocatable }))"
            :key="entry.day"
          >
            <th>選抜試験{{ entry.examNumber }}</th>
            <td>{{ entry.fixedPerType }}</td>
            <td>{{ numberText(entry.allocated) }}</td>
            <td>{{ numberText(entry.fixedPerType + entry.allocated) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </EffectTooltip>
</template>
