<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { triggerLabels, effectName } from '../../data/effectLabels'
import { cardsById } from '../../data/cardLookup'
import type { TotalScore } from '../../scoring/totalScore'
import StatusBadge from '../common/StatusBadge.vue'
import ScoreCalculation, { type CalculationTerm } from './ScoreCalculation.vue'
import CalculationHeading from './CalculationHeading.vue'
import EffectTooltip from '../common/EffectTooltip.vue'
import { activationEvidenceLabel } from '../../data/activationLabels'
import { scoreTypes } from '../../scoring/scoreMath'
import { parameterBonusBase } from '../../scoring/scoringConfig'
import { spLessonDays, spLessonDayLabel } from '../../scoring/conditions/conditions'
import { typeLabels } from '../../data/cards'
import { configurableActions, actionCountLabels } from '../../scoring/conditions/actionConditions'
import { operationSettingFields } from '../../scoring/conditions/operationSettings'
import ProduceItemTooltip from '../cards/ProduceItemTooltip.vue'
import { itemPartText } from '../../data/produceItemLabels'
import {
  supportAbilityText,
  supportEventText,
  supportEventEntries,
} from '../../data/supportEffectDescriptions'
const props = defineProps<{ score?: TotalScore }>()
const operationNote = computed(() =>
  operationSettingFields
    .filter((field) => props.score?.conditions?.operationSettings?.[field.key] !== undefined)
    .map(
      (field) =>
        `${field.label} ${props.score!.conditions!.operationSettings![field.key]}${field.unit}`,
    )
    .join('・'),
)
const examRatioNote = computed(() =>
  Object.entries(props.score?.conditions?.examRatios ?? {})
    .map(([exam, ratio]) => `試験${exam} Vo ${ratio.vo}：Da ${ratio.da}：Vi ${ratio.vi}`)
    .join('・'),
)
const dailySpNote = computed(() => {
  const days = props.score?.conditions?.spLessonDays
  return spLessonDays
    .filter((day) => days?.[day])
    .map((day) => `${spLessonDayLabel(day)} ${typeLabels[days![day]!]}`)
    .join('・')
})
const formulaOpen = ref(false)
async function toggleFormula(event: Event) {
  const details = event.currentTarget as HTMLDetailsElement
  const wasOpen = formulaOpen.value
  formulaOpen.value = details.open
  if (wasOpen && !details.open) {
    await nextTick()
    const summary = details.querySelector('summary')
    summary?.scrollIntoView({ block: 'nearest' })
    summary?.focus({ preventScroll: true })
  }
}
const scoreCard = computed(() => (props.score ? cardsById.get(props.score.cardId) : undefined))
const subtotal = (entries: { total: number }[]) =>
  entries.reduce((sum, entry) => sum + entry.total, 0)
const eventHasRounding = (entry: TotalScore['fixed'][number]) =>
  (entry.value * (100 + entry.bonusPercent)) / 100 !== entry.appliedValue
const eventBonusDescription = (entry: TotalScore['fixed'][number]) =>
  entry.bonusAbilityIndex === undefined
    ? undefined
    : supportAbilityText(scoreCard.value, entry.bonusAbilityIndex, props.score?.limit ?? 4)
function abilityInfo(cardId: string, index: number, fallback: Record<string, unknown>) {
  const card = cardsById.get(cardId)
  const effect = card?.effects.support_ability[index] ?? fallback
  const original = supportAbilityText(card, index, props.score?.limit ?? 4)
  return {
    abilityIndex: index,
    heading: original ?? `サポートアビリティ 効果 ${index + 1}`,
    classification: effectName(effect, 'support_ability'),
    timing: triggerLabels[String(effect.trigger)] ?? String(effect.trigger),
  }
}
function repetitionCalculation(
  heading: string | undefined,
  entry: { value: number; count: number; total: number },
  details?: string[],
) {
  const perType = entry.value * entry.count
  return {
    heading,
    terms: [
      { label: '1回の上昇量', value: entry.value },
      { label: '発動回数', value: entry.count, unit: '回', operator: '×', details },
      {
        label: '得点',
        value: perType,
        unit: perType === entry.total ? '点' : undefined,
        operator: '＝',
        result: true,
      },
    ] satisfies CalculationTerm[],
    total: perType === entry.total ? undefined : entry.total,
  }
}
const sections = computed(() => {
  const score = props.score
  if (!score) {
    return []
  }
  const initial = score.fixed.filter((entry) => entry.category === 'support_ability')
  const visibleEvents = supportEventEntries(scoreCard.value)
  const events = score.fixed
    .filter((entry) => entry.category === 'support_event')
    .map((entry) => ({
      ...entry,
      displayIndex: visibleEvents.findIndex((event) => event.index === entry.effectIndex),
      heading: supportEventText(scoreCard.value, entry.effectIndex, score.limit),
      classification: effectName(
        scoreCard.value?.effects.support_event[entry.effectIndex] ?? { value_type: 'status_add' },
        'support_event',
      ),
    }))
  return [
    {
      title: 'Pアイテム',
      total: subtotal(score.items),
      calculations: score.items.map((entry) => {
        const effect = scoreCard.value?.effects.produce_item?.[entry.itemIndex]
        const triggerText = effect ? itemPartText(effect.trigger, 'trigger') : undefined
        return repetitionCalculation(undefined, entry, [
          ...(triggerText ? [`発動トリガー：${triggerText}`] : []),
          ...(entry.activations?.map((activation) =>
            activationEvidenceLabel(activation, entry.trigger, triggerText),
          ) ?? []),
        ])
      }),
    },
    {
      title: 'サポートイベント',
      total: subtotal(events),
      eventEntries: events,
    },
    {
      title: 'サポートアビリティ',
      total: subtotal(initial) + subtotal(score.parameter) + subtotal(score.abilities),
      calculations: [
        ...initial.map((entry) => ({
          terms: [
            { label: '初期上昇量', value: entry.value },
            {
              label: '得点',
              value: entry.appliedValue,
              unit: entry.total === entry.appliedValue ? '点' : undefined,
              operator: '＝',
              result: true,
            },
          ],
          ...abilityInfo(score.cardId, entry.effectIndex, {
            trigger: 'produce_start',
            value_type: 'status_add',
          }),
          total: entry.total === entry.appliedValue ? undefined : entry.total,
        })),
        ...score.parameter.map((entry) => ({
          terms: [
            {
              label: '基準値',
              value: entry.base,
              parameterBonusBase:
                entry.base === parameterBonusBase ||
                entry.spLessons !== undefined ||
                entry.examBasis !== undefined,
              spLessons: entry.spLessons,
              lessonBasis: entry.lessonBasis,
              examBasis: entry.examBasis,
            },
            {
              label: 'パラボ',
              value: entry.percent,
              unit: '%',
              operator: '×',
            },
            {
              label: '得点',
              value: entry.appliedValue,
              unit: entry.total === entry.appliedValue ? '点' : undefined,
              operator: '＝',
              result: true,
            },
          ],
          ...abilityInfo(score.cardId, entry.abilityIndex, {
            trigger: 'equip',
            value_type: 'param_bonus',
          }),
          note:
            entry.rawValue !== entry.appliedValue ? '得点は端数切り捨て後の値です。' : undefined,
          total: entry.total === entry.appliedValue ? undefined : entry.total,
        })),
        ...score.abilities.map((entry) => ({
          ...repetitionCalculation(
            undefined,
            entry,
            entry.activations?.map((activation) =>
              activationEvidenceLabel(activation, entry.trigger),
            ),
          ),
          ...abilityInfo(score.cardId, entry.abilityIndex, {
            trigger: entry.trigger,
            value_type: 'status_add',
          }),
        })),
      ].sort((a, b) => a.abilityIndex - b.abilityIndex),
    },
  ]
})
</script>
<template>
  <section
    class="maximum-score"
    aria-label="得点計算"
  >
    <div class="maximum-score-summary">
      <h3>{{ score?.complete ? '最大点' : '得点計算' }}</h3>
      <template v-if="score">
        <p class="maximum-score-total">
          <strong
            :key="`${score.cardId}:${score.limit}:${score.total}`"
            class="score-value-reveal"
            >{{ score.total }}</strong>点{{ score.complete ? '' : '以上（探索途中の下限値）' }}
        </p>
        <div class="score-types">
          <span
            v-for="type in scoreTypes"
            :key="type"
            ><StatusBadge
              :kind="type"
              small
            />{{ score.byType[type] }}点</span
          >
        </div>
      </template>
    </div>
    <p
      v-if="!score"
      role="status"
    >
      計算待ちです。
    </p>
    <template v-else>
      <p
        v-if="score.lessonCounts"
        class="note score-condition-note"
      >
        SPレッスン：Vo {{ score.lessonCounts.vo }}回・Da {{ score.lessonCounts.da }}回・Vi
        {{ score.lessonCounts.vi }}回（未指定分の最適化後）
      </p>
      <p
        v-if="dailySpNote"
        class="note score-day-conditions"
      >
        日別SP指定：{{ dailySpNote }}
      </p>
      <p
        v-if="examRatioNote"
        class="note score-exam-conditions"
      >
        選抜試験の配分比率：{{ examRatioNote }}
      </p>
      <p
        v-if="score.actionCounts"
        class="note score-action-conditions"
      >
        行動回数：{{
          configurableActions
            .map(
              (key) =>
                `${actionCountLabels[key]} ${score!.actionCounts![key]}回${score!.conditions?.actionCounts?.[key] === undefined ? '（自動）' : ''}`,
            )
            .join('・')
        }}
      </p>
      <p
        v-if="operationNote"
        class="note score-operation-conditions"
      >
        操作数指定：{{ operationNote }}
      </p>
      <p
        v-if="score.pending"
        class="note"
      >
        未評価の効果が{{ score.pending }}件残っています。
      </p>
      <details
        class="score-formula"
        :open="formulaOpen"
        @toggle="toggleFormula"
      >
        <summary>{{ formulaOpen ? '計算式を閉じる' : '計算式を見る' }}</summary>
        <div class="score-formula-content">
          <div
            class="score-equation"
            role="group"
            aria-label="得点の合計式"
          >
            <span
              v-for="(section, index) in sections"
              :key="section.title"
              class="score-equation-part"
            >
              <span
                v-if="index > 0"
                class="score-equation-operator"
                >＋</span
              >
              <span class="score-equation-term">
                <span class="score-equation-label">{{ section.title }}</span>
                <strong class="score-equation-value">{{ section.total }}<small>点</small></strong>
              </span>
            </span>
            <span class="score-equation-part">
              <span class="score-equation-operator">＝</span>
              <span class="score-equation-term score-equation-total">
                <span class="score-equation-label">合計</span>
                <strong class="score-equation-value">{{ score.total }}<small>点</small></strong>
              </span>
            </span>
          </div>
          <section
            v-for="section in sections"
            :key="section.title"
            class="score-breakdown-section"
            :data-score-group="section.title"
          >
            <h4>
              <ProduceItemTooltip
                v-if="section.title === 'Pアイテム' && scoreCard?.produce_item_name"
                :card="scoreCard"
              />
              <template v-else>{{ section.title }}</template>：{{ section.total }}点
            </h4>
            <ul
              v-if="section.eventEntries?.length"
              class="event-calculations"
            >
              <li
                v-for="entry in section.eventEntries"
                :key="`${score?.cardId}:${formulaOpen}:${entry.effectIndex}`"
              >
                <CalculationHeading
                  v-if="entry.heading"
                  :heading="entry.heading"
                  :effect-index="entry.displayIndex >= 0 ? entry.displayIndex : undefined"
                  :classification="entry.classification"
                  timing="このカードのサポートイベント発生時"
                />
                <div class="event-equation">
                  <span class="event-equation-term">
                    <span class="event-equation-label">元の値</span>
                    <strong class="event-equation-value">{{ entry.value }}</strong>
                  </span>
                  <span
                    v-if="entry.bonusPercent"
                    class="event-equation-part"
                  >
                    <span class="event-equation-operator">＋</span>
                    <span class="event-equation-term event-equation-bonus">
                      <div class="event-equation-label">
                        <EffectTooltip
                          :label="`${entry.bonusAbilityIndex !== undefined ? `効果 ${entry.bonusAbilityIndex + 1}・` : ''}${entry.bonusPercent}%増加`"
                        >
                          <template #label>
                            <span
                              v-if="entry.bonusAbilityIndex !== undefined"
                              class="ability-number-badge"
                              :aria-label="`効果 ${entry.bonusAbilityIndex + 1}`"
                              >{{ entry.bonusAbilityIndex + 1 }}</span
                            >
                            {{ entry.bonusPercent }}%増加
                          </template>
                          <p class="event-tooltip-description">
                            <span
                              v-if="entry.bonusAbilityIndex !== undefined"
                              class="ability-number-badge"
                              :aria-label="`効果 ${entry.bonusAbilityIndex + 1}`"
                              >{{ entry.bonusAbilityIndex + 1 }}</span>：{{
                              eventBonusDescription(entry) ??
                              `サポートイベントのパラメータ上昇量増加${entry.bonusPercent}%`
                            }}
                            <span
                              v-if="eventBonusDescription(entry)"
                              class="event-tooltip-classification"
                              >計算上の分類：サポートイベントのパラメータ上昇量増加</span
                            >
                          </p>
                        </EffectTooltip>
                      </div>
                      <strong class="event-equation-value">{{
                        entry.appliedValue - entry.value
                      }}</strong>
                    </span>
                  </span>
                  <span class="event-equation-part">
                    <span class="event-equation-operator">＝</span>
                    <span class="event-equation-term event-equation-result">
                      <span class="event-equation-label">補正後</span>
                      <strong class="event-equation-value"
                        >{{ entry.appliedValue
                        }}<small v-if="entry.total === entry.appliedValue">点</small></strong
                      >
                    </span>
                  </span>
                </div>
                <p
                  v-if="eventHasRounding(entry)"
                  class="event-calculation-source"
                >
                  増加分は端数切り捨て後の値です。
                </p>
                <p
                  v-if="entry.total !== entry.appliedValue"
                  class="event-calculation-total"
                >
                  合計 {{ entry.total }}点
                </p>
              </li>
            </ul>
            <ul
              v-else-if="section.calculations?.length"
              class="score-calculations"
            >
              <li
                v-for="(calculation, index) in section.calculations"
                :key="`${score?.cardId}:${formulaOpen}:${index}`"
              >
                <ScoreCalculation v-bind="calculation" />
              </li>
            </ul>
            <p v-else>加算なし</p>
          </section>
          <p class="note">
            他のサポートカードによる追加の獲得・強化などは含めていません。サポートイベントは有利なタイミングで各1回発生する前提です。
          </p>
        </div>
      </details>
    </template>
  </section>
</template>
