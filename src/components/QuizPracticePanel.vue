<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  addQuizMistake,
  createQuizSession,
  fetchQuizCategories,
  fetchQuizCollections,
  navigateQuizSession,
  revealQuizAnswer,
  selfJudgeQuizAnswer,
  submitQuizAnswer,
} from '../services/quizApiClient.js';
import {
  buildNextQuestionTarget,
  buildSubmitAnswer,
  createQuizInteractionState,
  handleQuizKey,
  resetQuizInteraction,
  selectPendingAnswer,
  updateTextAnswer,
  withQuizResult,
} from '../services/quizInteractionService.js';
import ChoiceQuestionView from './quiz/ChoiceQuestionView.vue';
import ImageRevealQuestionView from './quiz/ImageRevealQuestionView.vue';
import MarkdownResultView from './quiz/MarkdownResultView.vue';
import TextAnswerQuestionView from './quiz/TextAnswerQuestionView.vue';
import TrueFalseQuestionView from './quiz/TrueFalseQuestionView.vue';
import { publicAssetPath } from '../utils/publicPath.js';

const props = defineProps({
  courseCode: {
    type: String,
    required: true,
  },
  canUseQuiz: {
    type: Boolean,
    default: false,
  },
});

const collections = ref([]);
const categories = ref([]);
const activeCollectionSlug = ref('');
const selectedCategorySourceIds = ref([]);
const session = ref(null);
const interaction = ref(createQuizInteractionState({ questionType: '' }));
const message = ref('');
const isLoading = ref(false);

const activeQuestion = computed(() => session.value?.currentQuestion ?? null);
const progressText = computed(() => {
  if (!session.value) {
    return '';
  }
  return `${session.value.currentIndex + 1} / ${session.value.questionOrder.length}`;
});
const pendingSelectedKey = computed(() => interaction.value.pendingAnswer?.selectedKey ?? '');
const pendingTrueFalse = computed(() => interaction.value.pendingAnswer?.value);
const result = computed(() => interaction.value.result);
const resultExplanation = computed(() => {
  if (typeof result.value?.explanation === 'string') {
    return result.value.explanation;
  }
  return result.value?.explanation?.explanation ?? '';
});
const canSubmit = computed(() => Boolean(buildSubmitAnswer(interaction.value)) && !result.value);
const startButtonText = computed(() => (props.canUseQuiz ? '用户开始练习' : '学生开始练习'));

function resetForQuestion(question) {
  interaction.value = resetQuizInteraction(question?.type ?? '');
}

async function loadCollections() {
  const resultData = await fetchQuizCollections(props.courseCode);
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  collections.value = resultData.collections ?? [];
  activeCollectionSlug.value = collections.value[0]?.slug ?? '';
}

async function loadCategories() {
  if (!activeCollectionSlug.value) {
    categories.value = [];
    selectedCategorySourceIds.value = [];
    return;
  }

  const resultData = await fetchQuizCategories(activeCollectionSlug.value);
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  categories.value = resultData.categories ?? [];
  selectedCategorySourceIds.value = categories.value[0]?.sourceId ? [categories.value[0].sourceId] : [];
}

async function beginPractice() {
  if (!activeCollectionSlug.value) {
    message.value = '请选择题库后开始练习。';
    return;
  }

  isLoading.value = true;
  message.value = '';
  const resultData = await createQuizSession({
    collectionSlug: activeCollectionSlug.value,
    categorySourceIds: selectedCategorySourceIds.value,
    shuffle: false,
  });
  isLoading.value = false;
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  session.value = resultData.session;
  resetForQuestion(activeQuestion.value);
}

function chooseOption(value) {
  if (!activeQuestion.value || result.value) {
    return;
  }
  interaction.value = selectPendingAnswer(interaction.value, value);
}

function updateText(event) {
  interaction.value = updateTextAnswer(interaction.value, event.target.value);
}

function updateTextValue(value) {
  interaction.value = updateTextAnswer(interaction.value, value);
}

async function submitAnswer() {
  if (!session.value || !activeQuestion.value || result.value) {
    return;
  }
  const answer = buildSubmitAnswer(interaction.value);
  if (!answer) {
    return;
  }
  const resultData = await submitQuizAnswer(session.value.id, {
    sourceQuestionId: activeQuestion.value.sourceQuestionId,
    answer,
  });
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  interaction.value = withQuizResult(interaction.value, resultData.result);
}

async function revealAnswer() {
  if (!session.value || !activeQuestion.value || result.value) {
    return;
  }
  const resultData = await revealQuizAnswer(session.value.id, {
    sourceQuestionId: activeQuestion.value.sourceQuestionId,
  });
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  interaction.value = withQuizResult(interaction.value, resultData.result);
}

async function keepMistake() {
  if (!activeQuestion.value || !activeCollectionSlug.value) {
    return;
  }
  if (!props.canUseQuiz) {
    message.value = '学生可以继续刷题；登录成为用户后可以保存错题本。';
    return;
  }
  const resultData = await addQuizMistake({
    collectionSlug: activeCollectionSlug.value,
    sourceQuestionId: activeQuestion.value.sourceQuestionId,
    answer: { action: 'manual-add' },
  });
  message.value = resultData.ok ? '已加入错题。' : resultData.message;
}

async function selfJudge(isCorrect) {
  if (!session.value || !activeQuestion.value) {
    return;
  }
  const resultData = await selfJudgeQuizAnswer(session.value.id, {
    sourceQuestionId: activeQuestion.value.sourceQuestionId,
    isCorrect,
  });
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  interaction.value = withQuizResult(interaction.value, resultData.result);
}

async function moveQuestion(directionOrIndex) {
  if (!session.value) {
    return;
  }
  const payload = Number.isInteger(directionOrIndex)
    ? { currentIndex: directionOrIndex }
    : { direction: directionOrIndex };
  const resultData = await navigateQuizSession(session.value.id, payload);
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  session.value = resultData.session;
  resetForQuestion(activeQuestion.value);
}

async function moveToNextQuestion() {
  await moveQuestion(buildNextQuestionTarget(session.value, result.value));
}

async function handleKeydown(event) {
  if (!session.value || (event.target?.tagName === 'TEXTAREA' && !(event.key === ' ' && result.value))) {
    return;
  }
  const action = handleQuizKey(interaction.value, event);
  if (action.action === 'select') {
    event.preventDefault();
    interaction.value = action.state;
  } else if (action.action === 'submit') {
    event.preventDefault();
    await submitAnswer();
  } else if (action.action === 'next') {
    event.preventDefault();
    await moveToNextQuestion();
  } else if (action.action === 'previous') {
    event.preventDefault();
    await moveQuestion('previous');
  }
}

function imageUrl(path) {
  return publicAssetPath(`/resource/quiz/${props.courseCode}/${activeCollectionSlug.value}/${path}`);
}

watch(() => props.courseCode, () => {
  session.value = null;
  loadCollections();
}, { immediate: true });

watch(activeCollectionSlug, () => {
  session.value = null;
  loadCategories();
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <section v-if="collections.length" class="quiz-panel" aria-label="刷题器">
    <header class="quiz-panel__head">
      <div>
        <p class="course-detail__kicker">刷题器</p>
        <h2>课程练习</h2>
      </div>
      <span v-if="progressText">{{ progressText }}</span>
    </header>
    <p v-if="!canUseQuiz && !session" class="quiz-panel__student-note">
      学生可直接练习；登录成为用户后可以保存错题本和练习进度。
    </p>

    <div v-if="!session" class="quiz-panel__setup">
      <label>
        题库
        <select v-model="activeCollectionSlug">
          <option v-for="collection in collections" :key="collection.slug" :value="collection.slug">
            {{ collection.title }}
          </option>
        </select>
      </label>
      <label>
        分类
        <select v-model="selectedCategorySourceIds[0]">
          <option v-for="category in categories" :key="category.sourceId" :value="category.sourceId">
            {{ category.parentTitle ? `${category.parentTitle} - ${category.title}` : category.title }}
          </option>
        </select>
      </label>
      <button type="button" class="primary-button" :disabled="isLoading" @click="beginPractice">
        {{ startButtonText }}
      </button>
    </div>

    <div v-else-if="activeQuestion" class="quiz-card">
      <p class="quiz-card__meta">{{ activeQuestion.type }} · {{ activeQuestion.sourceQuestionId }}</p>
      <p class="quiz-card__prompt">{{ activeQuestion.prompt }}</p>

      <ImageRevealQuestionView
        v-if="activeQuestion.type === 'image_reveal'"
        :image-src="imageUrl(activeQuestion.body.imagePath)"
        image-alt="植物切片题图"
        :result="result"
      />

      <ChoiceQuestionView
        v-if="['single_choice', 'multiple_choice'].includes(activeQuestion.type)"
        :options="activeQuestion.body.options"
        :selected-key="pendingSelectedKey"
        :result="result"
        :locked="Boolean(result)"
        @select="chooseOption"
      />

      <TrueFalseQuestionView
        v-else-if="activeQuestion.type === 'true_false'"
        :selected-value="pendingTrueFalse"
        :locked="Boolean(result)"
        @select="chooseOption"
      />

      <TextAnswerQuestionView
        v-else-if="activeQuestion.type === 'translation'"
        :value="interaction.textAnswer"
        placeholder="输入答案后按 Enter 提交"
        :locked="Boolean(result)"
        @input="updateTextValue"
        @submit="submitAnswer"
      />

      <div class="quiz-actions">
        <button type="button" @click="moveQuestion('previous')">上一题</button>
        <button
          v-if="['single_choice', 'multiple_choice', 'true_false', 'translation'].includes(activeQuestion.type)"
          type="button"
          :disabled="!canSubmit"
          @click="submitAnswer"
        >
          选择
        </button>
        <button v-else type="button" @click="revealAnswer">揭晓答案</button>
        <button type="button" :disabled="!result" @click="moveToNextQuestion">下一题</button>
      </div>

      <MarkdownResultView
        v-if="result && activeQuestion.type !== 'image_reveal'"
        :result="result"
        :explanation="resultExplanation"
        correct-label="回答正确"
        incorrect-label="回答错误"
        reference-label="已揭晓答案"
      />
      <div v-if="result" class="quiz-feedback">
        <button v-if="activeQuestion.type === 'image_reveal'" type="button" @click="keepMistake">保存到错题本</button>
        <span v-if="['short_answer', 'essay'].includes(activeQuestion.type)" class="quiz-feedback__judges">
          <button type="button" @click="selfJudge(true)">答对了</button>
          <button type="button" @click="selfJudge(false)">答错了</button>
        </span>
      </div>
    </div>

    <p v-if="message" class="quiz-message">{{ message }}</p>
  </section>
</template>
