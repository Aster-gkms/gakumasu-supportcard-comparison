<script lang="ts">
import type { SpLessonParameterBasis } from '../../scoring/conditions/conditions'
import type { ExamParameterBasis } from '../../scoring/conditions/examConditions'
export interface CalculationTerm {
  label: string
  value: number
  unit?: string
  operator?: string
  result?: boolean
  details?: string[]
  parameterBonusBase?: boolean
  spLessons?: number
  lessonBasis?: SpLessonParameterBasis
  examBasis?: ExamParameterBasis
}
</script>

<script setup lang="ts">
import EffectTooltip from '../common/EffectTooltip.vue'
import CalculationHeading from './CalculationHeading.vue'
import ParameterBonusBaseTooltip from './ParameterBonusBaseTooltip.vue'
defineProps<{
  heading?: string
  abilityIndex?: number
  terms: CalculationTerm[]
  note?: string
  total?: number
  classification?: string
  timing?: string
}>()
</script>

<template>
  <div class="score-calculation">
    <CalculationHeading
      v-if="heading"
      :heading="heading"
      :effect-index="abilityIndex"
      :classification="classification"
      :timing="timing"
    />
    <div class="calculation-body">
      <div class="calculation-equation">
        <span
          v-for="(term, index) in terms"
          :key="index"
          class="calculation-part"
        >
          <span
            v-if="term.operator"
            class="calculation-operator"
            >{{ term.operator }}</span
          >
          <span
            class="calculation-term"
            :class="{
              'calculation-result': term.result,
              'calculation-factor': term.operator === '×',
            }"
          >
            <div class="calculation-label">
              <ParameterBonusBaseTooltip
                v-if="term.parameterBonusBase"
                :base="term.value"
                :sp-lessons="term.spLessons"
                :lesson-basis="term.lessonBasis"
                :exam-basis="term.examBasis"
              />
              <EffectTooltip
                v-else-if="term.details?.length"
                :label="term.label"
              >
                <div class="activation-evidence">
                  <p class="activation-evidence-heading">
                    発動回数の内訳（合計 {{ term.value }}回）
                  </p>
                  <ul class="activation-evidence-list">
                    <li
                      v-for="(detail, detailIndex) in term.details"
                      :key="detailIndex"
                    >
                      {{ detail }}
                    </li>
                  </ul>
                </div>
              </EffectTooltip>
              <template v-else>{{ term.label }}</template>
            </div>
            <strong class="calculation-value"
              >{{
                term.lessonBasis || term.examBasis
                  ? term.value.toLocaleString('ja-JP', {
                      useGrouping: false,
                      maximumFractionDigits: 4,
                    })
                  : term.value
              }}<small v-if="term.unit">{{ term.unit }}</small></strong
            >
          </span>
        </span>
      </div>
    </div>
    <p
      v-if="note"
      class="calculation-source"
    >
      {{ note }}
    </p>
    <p
      v-if="total !== undefined"
      class="calculation-total"
    >
      合計 {{ total }}点
    </p>
  </div>
</template>
