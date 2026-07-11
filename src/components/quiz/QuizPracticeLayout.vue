<script setup>
defineProps({
  rangeSummaries: {
    type: Array,
    default: () => [],
  },
  activeRangeId: {
    type: String,
    default: '',
  },
  questionTiles: {
    type: Array,
    default: () => [],
  },
  activeIndex: {
    type: Number,
    default: 0,
  },
  activeRangeTitle: {
    type: String,
    default: '',
  },
  answeredLabel: {
    type: String,
    default: '作答 / 题数',
  },
  tileStatusBySourceQuestionId: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['select-range', 'move-question']);

function tileClass(tile, activeIndex, statusBySourceQuestionId) {
  const status = statusBySourceQuestionId[tile.sourceQuestionId] ?? '';
  return {
    'is-active': tile.index === activeIndex,
    'is-correct': status === 'correct' || status === 'revealed',
    'is-incorrect': status === 'incorrect',
  };
}
</script>

<template>
  <div class="quiz-practice-layout">
    <aside class="question-jump" aria-label="题号跳转">
      <div class="practice-overview-head">
        <strong>题目总览</strong>
        <span>{{ answeredLabel }}</span>
      </div>
      <div class="practice-overview-list">
        <button
          v-for="option in rangeSummaries"
          :key="option.id"
          type="button"
          class="practice-overview-row"
          :class="{ 'is-active': activeRangeId === option.id }"
          @click="emit('select-range', option)"
        >
          <span>{{ option.title }}</span>
          <strong>{{ option.answered }} / {{ option.total }}</strong>
        </button>
      </div>
      <div class="practice-question-panel">
        <div class="practice-question-panel__head">
          <strong>{{ activeRangeTitle }}</strong>
          <span>图例</span>
        </div>
        <div class="question-jump-grid">
          <button
            v-for="tile in questionTiles"
            :key="tile.sourceQuestionId"
            type="button"
            class="question-grid-cell"
            :class="tileClass(tile, activeIndex, tileStatusBySourceQuestionId)"
            @click="emit('move-question', tile.index)"
          >
            <span v-if="tileStatusBySourceQuestionId[tile.sourceQuestionId]">✓</span>
            <span v-else>{{ tile.localNumber }}</span>
          </button>
        </div>
      </div>
    </aside>

    <slot />
  </div>
</template>
