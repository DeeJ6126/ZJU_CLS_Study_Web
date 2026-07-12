<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ChoiceQuestionView from './components/quiz/ChoiceQuestionView.vue';
import ImageRevealQuestionView from './components/quiz/ImageRevealQuestionView.vue';
import MarkdownResultView from './components/quiz/MarkdownResultView.vue';
import QuizCourseShell from './components/quiz/QuizCourseShell.vue';
import QuizPracticeLayout from './components/quiz/QuizPracticeLayout.vue';
import TextAnswerQuestionView from './components/quiz/TextAnswerQuestionView.vue';
import TrueFalseQuestionView from './components/quiz/TrueFalseQuestionView.vue';
import HomePage from './components/HomePage.vue';
import OverviewPage from './components/OverviewPage.vue';
import CourseDetailPage from './components/CourseDetailPage.vue';
import {
  createQuizSession,
  fetchQuizCategories,
  fetchQuizCollections,
  fetchQuizImageGallery,
  fetchQuizPastExamFeedback,
  fetchQuizPastExamQuestions,
  fetchQuizPastExams,
  fetchQuizReviewTerms,
  navigateQuizSession,
  revealQuizAnswer,
  selfJudgeQuizAnswer,
  submitQuizAnswer,
} from './services/quizApiClient.js';
import {
  buildNextQuestionTarget,
  buildSubmitAnswer,
  createQuizInteractionState,
  handleQuizKey,
  resetQuizInteraction,
  selectPendingAnswer,
  updateTextAnswer,
  withQuizResult,
} from './services/quizInteractionService.js';
import {
  buildPracticeQuestionTiles,
  buildQuizRangeOptions,
} from './services/quizRangeService.js';
import {
  getDemoPageFromHash,
  getDemoPageHref,
} from './services/demoNavigationService.js';
import {
  buildVocabularyFeedback,
  shouldFocusTranslationInput,
} from './services/quizAnswerViewService.js';
import {
  buildBotanyGalleryGroups,
  buildBotanyResultSummary,
  clearBotanyMistakes,
  normalizeBotanyCategorySelection,
  readBotanyMistakes,
  readBotanySelection,
  removeBotanyMistake,
  selectedBotanyImageCount,
  upsertBotanyMistake,
  writeBotanyMistakes,
  writeBotanySelection,
} from './services/botanyQuizService.js';
import {
  buildQuizResultSummary,
  clearMolecularMistakes,
  createVocabularyRecord,
  cycleVocabularyStatus,
  getMolecularDisplayText,
  getMolecularOptionText,
  getMolecularSpeakText,
  readMolecularMistakes,
  readMolecularLanguage,
  readVocabularyRecords,
  removeMolecularMistake,
  speakMolecularText,
  tokenizeVocabularyText,
  upsertMolecularMistake,
  writeMolecularMistakes,
  writeMolecularLanguage,
  writeVocabularyRecords,
} from './services/molecularQuizService.js';
import {
  buildMicrobiologyResultSummary,
  clearMicrobiologyMistakes,
  createMicrobiologyVocabularyRecord,
  cycleMicrobiologyVocabularyStatus,
  normalizeMicrobiologyCategorySelection,
  readMicrobiologyMistakes,
  readMicrobiologySelection,
  readMicrobiologyVocabularyRecords,
  removeMicrobiologyMistake,
  selectedMicrobiologyQuestionCount,
  tokenizeMicrobiologyVocabularyText,
  upsertMicrobiologyMistake,
  writeMicrobiologyMistakes,
  writeMicrobiologySelection,
  writeMicrobiologyVocabularyRecords,
} from './services/microbiologyQuizService.js';
import { canComment, canFavorite, canSubmitResource } from './services/authService.js';
import { quizCourseConfigs } from './data/quizCourseConfigs.js';
import { demoPendingCourses, demoSupportedCourses, demoTopPages } from './data/quizDemo.js';
import { getResourceCourseByCode } from './data/courses/resourceData.js';
import { getCourseDetail } from './data/courses/courseDetails.js';
import { parseResourceHash } from './data/courses/resourcePaths.js';
import { publicAssetPath } from './utils/publicPath.js';

const topPages = demoTopPages;
const supportedCourses = demoSupportedCourses;
const pendingCourses = demoPendingCourses;
const studentViewer = { id: 'student', role: 'guest', verifications: {} };
const activePage = ref('home');
const overviewRoute = ref(parseResourceHash(''));
const activeOverviewCourse = ref(null);
const activeCourseTab = ref('supported');
const quizView = ref('catalog');
const molecularPage = ref('home');
const botanyPage = ref('home');
const microbiologyPage = ref('home');
const activeCourseCode = ref('');
const activeCollectionSlug = ref('');
const collectionsByCourse = ref({});
const categories = ref([]);
const selectedCategorySourceIds = ref([]);
const activePracticeRangeId = ref('');
const answeredQuestionStatus = ref({});
const session = ref(null);
const interaction = ref(createQuizInteractionState({ questionType: '' }));
const molecularLanguage = ref(readMolecularLanguage());
const molecularReviewTerms = ref([]);
const molecularReviewIndex = ref(0);
const molecularReviewShowAnswer = ref(false);
const vocabularyRecords = ref(readVocabularyRecords());
const molecularMistakeRecords = ref(readMolecularMistakes());
const botanyMistakeRecords = ref(readBotanyMistakes());
const microbiologyMistakeRecords = ref(readMicrobiologyMistakes());
const botanyGalleryItems = ref([]);
const botanyGalleryActiveCategory = ref('');
const microbiologyVocabularyRecords = ref(readMicrobiologyVocabularyRecords());
const microbiologyPastExams = ref([]);
const microbiologyPastExamQuestions = ref([]);
const activePastExamId = ref('');
const activePastExamIndex = ref(0);
const microbiologyPastExamAnswers = ref({});
const vocabularyFilter = ref('all');
const vocabularyPickEnabled = ref(false);
const vocabularyFeedback = ref('');
const translationInput = ref(null);
const message = ref('');
const isLoading = ref(false);

const activeCourse = computed(
  () => supportedCourses.find((course) => course.code === activeCourseCode.value) ?? null,
);
const activeCollection = computed(
  () => (collectionsByCourse.value[activeCourseCode.value] ?? [])
    .find((collection) => collection.slug === activeCollectionSlug.value) ?? null,
);
const activeCourseConfig = computed(() => quizCourseConfigs[activeCourseCode.value] ?? null);
const activeQuestion = computed(() => session.value?.currentQuestion ?? null);
const isMolecularCollection = computed(() => activeCollectionSlug.value === 'molecular-biology-review');
const isBotanyCollection = computed(() => activeCollectionSlug.value === 'botany-slice');
const isMicrobiologyCollection = computed(() => activeCollectionSlug.value === 'microbiology-final-review');
const activeQuestionStatus = computed(() => (
  session.value?.answerStatusBySourceQuestionId?.[activeQuestion.value?.sourceQuestionId] ?? null
));
const currentQuestionLocked = computed(() => Boolean(activeQuestionStatus.value));
const displayedPrompt = computed(() => (
  isMolecularCollection.value
    ? getMolecularDisplayText(activeQuestion.value, molecularLanguage.value, 'prompt')
    : activeQuestion.value?.prompt ?? ''
));
const displayedResultExplanation = computed(() => {
  if (!result.value) {
    return '';
  }
  if (isMolecularCollection.value) {
    return getMolecularDisplayText({ explanation: result.value.explanation }, molecularLanguage.value, 'explanation');
  }
  if (typeof result.value.explanation === 'string') {
    return result.value.explanation;
  }
  return result.value.explanation?.explanation ?? '';
});
const questionIndexText = computed(() => {
  if (!session.value) {
    return '';
  }
  return `${session.value.currentIndex + 1} / ${session.value.questionOrder.length}`;
});
const result = computed(() => interaction.value.result);
const pendingSelectedKey = computed(() => interaction.value.pendingAnswer?.selectedKey ?? '');
const pendingTrueFalse = computed(() => interaction.value.pendingAnswer?.value);
const canSubmitAnswer = computed(() => Boolean(buildSubmitAnswer(interaction.value)) && !result.value && !currentQuestionLocked.value);
const userCanSubmit = computed(() => canSubmitResource(studentViewer));
const userCanComment = computed(() => canComment(studentViewer));
const userCanFavorite = computed(() => canFavorite(studentViewer));
const rangeOptions = computed(() => buildQuizRangeOptions(activeCourseCode.value, categories.value));

const activePracticeRange = computed(
  () => rangeOptions.value.find((option) => option.id === activePracticeRangeId.value) ?? rangeOptions.value[0] ?? null,
);

const selectedPracticeRangeOptions = computed(() => {
  const selected = rangeOptions.value.filter((option) => (
    !selectedCategorySourceIds.value.length
    || option.sourceIds.some((sourceId) => selectedCategorySourceIds.value.includes(sourceId))
  ));
  return selected.length ? selected : rangeOptions.value;
});

const practiceRangeSummaries = computed(() => selectedPracticeRangeOptions.value.map((option) => {
  const questions = session.value?.questionIndex.filter((item) => (
    option.sourceIds.includes(item.categorySourceId)
  )) ?? [];
  const answered = questions.filter((item) => getQuestionStatus(item.sourceQuestionId)).length;

  return {
    ...option,
    answered,
    total: questions.length,
  };
}));

const resultSummary = computed(() => buildQuizResultSummary({
  questionIndex: session.value?.questionIndex ?? [],
  categories: categories.value,
  answerStatusBySourceQuestionId: session.value?.answerStatusBySourceQuestionId ?? {},
}));

const currentReviewTerm = computed(() => molecularReviewTerms.value[molecularReviewIndex.value] ?? null);

const filteredVocabularyRecords = computed(() => {
  if (vocabularyFilter.value === 'all') {
    return vocabularyRecords.value;
  }
  return vocabularyRecords.value.filter((record) => record.status === vocabularyFilter.value);
});

const molecularCategoryGroups = computed(() => {
  const order = ['translation', 'true_false', 'multiple_choice', 'short_answer', 'essay'];
  const labels = {
    translation: '中英互译',
    true_false: '判断题',
    multiple_choice: '选择题',
    short_answer: '简答题',
    essay: '论述题',
  };

  return order
    .map((type) => {
      const items = categories.value.filter((category) => category.type === type);
      return {
        id: type,
        title: labels[type] ?? type,
        categories: items,
        questionCount: items.reduce((sum, category) => sum + category.questionCount, 0),
        selectedCount: items.filter((category) => selectedCategorySourceIds.value.includes(category.sourceId)).length,
      };
    })
    .filter((group) => group.categories.length);
});

const selectedQuestionCount = computed(() => categories.value
  .filter((category) => selectedCategorySourceIds.value.includes(category.sourceId))
  .reduce((sum, category) => sum + category.questionCount, 0));

const selectedBotanySliceCount = computed(() => selectedBotanyImageCount(
  selectedCategorySourceIds.value,
  categories.value,
));

const selectedMicrobiologyCount = computed(() => selectedMicrobiologyQuestionCount(
  selectedCategorySourceIds.value,
  categories.value,
));

const botanyResultSummary = computed(() => buildBotanyResultSummary({
  questionOrder: session.value?.questionOrder ?? [],
  answerStatusBySourceQuestionId: session.value?.answerStatusBySourceQuestionId ?? {},
  mistakeRecords: botanyMistakeRecords.value,
}));

const microbiologyResultSummary = computed(() => buildMicrobiologyResultSummary({
  questionOrder: session.value?.questionOrder ?? [],
  answerStatusBySourceQuestionId: session.value?.answerStatusBySourceQuestionId ?? {},
  mistakeRecords: microbiologyMistakeRecords.value,
  selectedCategorySourceIds: selectedCategorySourceIds.value,
}));

const activePastExam = computed(() => (
  microbiologyPastExams.value.find((exam) => exam.examId === activePastExamId.value) ?? null
));

const activePastExamQuestion = computed(() => (
  microbiologyPastExamQuestions.value[activePastExamIndex.value] ?? null
));

const activePastExamAnswer = computed(() => (
  microbiologyPastExamAnswers.value[activePastExamQuestion.value?.number] ?? null
));

const activePastExamChoiceResult = computed(() => {
  if (!activePastExamAnswer.value) {
    return null;
  }
  return {
    isCorrect: activePastExamAnswer.value.isCorrect,
    correctDisplay: activePastExamAnswer.value.correctKey ?? '',
  };
});

const microbiologyFilteredVocabularyRecords = computed(() => {
  if (vocabularyFilter.value === 'all') {
    return microbiologyVocabularyRecords.value;
  }
  return microbiologyVocabularyRecords.value.filter((record) => record.status === vocabularyFilter.value);
});

const botanyGalleryGroups = computed(() => buildBotanyGalleryGroups(botanyGalleryItems.value));

const activeBotanyGalleryGroup = computed(() => (
  botanyGalleryGroups.value.find((group) => group.id === botanyGalleryActiveCategory.value)
  ?? botanyGalleryGroups.value[0]
  ?? null
));

const answeredCount = computed(() => Object.values(session.value?.answerStatusBySourceQuestionId ?? {})
  .filter((status) => typeof status.isCorrect === 'boolean').length);

const questionTileStatusBySourceId = computed(() => {
  const statuses = {};
  for (const sourceQuestionId of session.value?.questionOrder ?? []) {
    statuses[sourceQuestionId] = getQuestionStatus(sourceQuestionId) || answeredQuestionStatus.value[sourceQuestionId] || '';
  }
  return statuses;
});

const activePracticeQuestionIndexes = computed(() => {
  if (!session.value || !activePracticeRange.value) {
    return [];
  }

  return buildPracticeQuestionTiles({
    questionOrder: session.value.questionOrder,
    questionIndex: session.value.questionIndex ?? [],
    sourceIds: activePracticeRange.value.sourceIds,
  });
});

function routeFromHash() {
  return getDemoPageFromHash(window.location.hash, topPages);
}

function setPage(pageId) {
  resetPageState(pageId);
  activePage.value = pageId;
  window.location.hash = getDemoPageHref(pageId);
}

function resetPageState(pageId) {
  if (pageId !== 'quiz') {
    return;
  }

  quizView.value = 'catalog';
  molecularPage.value = 'home';
  botanyPage.value = 'home';
  microbiologyPage.value = 'home';
  session.value = null;
  activeCourseCode.value = '';
  activeCollectionSlug.value = '';
  categories.value = [];
  selectedCategorySourceIds.value = [];
  activePracticeRangeId.value = '';
  answeredQuestionStatus.value = {};
  resetForQuestion(null);
  message.value = '';
}

function showCourseTab(tabId) {
  activeCourseTab.value = tabId;
  quizView.value = 'catalog';
  session.value = null;
  message.value = '';
}

async function loadCollectionsForCourse(courseCode) {
  if (collectionsByCourse.value[courseCode]) {
    return collectionsByCourse.value[courseCode];
  }

  const resultData = await fetchQuizCollections(courseCode);
  if (!resultData.ok) {
    message.value = resultData.message;
    return [];
  }

  collectionsByCourse.value = {
    ...collectionsByCourse.value,
    [courseCode]: resultData.collections ?? [],
  };
  return collectionsByCourse.value[courseCode];
}

async function selectCourse(courseCode) {
  activeCourseCode.value = courseCode;
  session.value = null;
  interaction.value = resetQuizInteraction('');
  message.value = '';
  isLoading.value = true;

  const collections = await loadCollectionsForCourse(courseCode);
  activeCollectionSlug.value = collections[0]?.slug ?? '';
  if (courseCode === 'BIO2023M') {
    quizView.value = 'molecular';
  } else if (courseCode === 'BIO2019F') {
    quizView.value = 'botany';
  } else if (courseCode === 'BIO2110F') {
    quizView.value = 'microbiology';
  } else {
    quizView.value = 'range';
  }
  molecularPage.value = 'home';
  botanyPage.value = 'home';
  microbiologyPage.value = 'home';
  isLoading.value = false;
}

async function loadCategories() {
  categories.value = [];
  selectedCategorySourceIds.value = [];

  if (!activeCollectionSlug.value) {
    return;
  }

  const resultData = await fetchQuizCategories(activeCollectionSlug.value);
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }

  categories.value = resultData.categories ?? [];
  if (isBotanyCollection.value) {
    selectedCategorySourceIds.value = normalizeBotanyCategorySelection(readBotanySelection(), categories.value);
  } else if (isMicrobiologyCollection.value) {
    selectedCategorySourceIds.value = normalizeMicrobiologyCategorySelection(readMicrobiologySelection(), categories.value);
  } else {
    selectedCategorySourceIds.value = [];
  }
  activePracticeRangeId.value = '';
}

function isRangeSelected(option) {
  return option.sourceIds.every((sourceId) => selectedCategorySourceIds.value.includes(sourceId));
}

function toggleRangeOption(option) {
  const selected = new Set(selectedCategorySourceIds.value);
  if (isRangeSelected(option)) {
    option.sourceIds.forEach((sourceId) => selected.delete(sourceId));
  } else {
    option.sourceIds.forEach((sourceId) => selected.add(sourceId));
  }
  selectedCategorySourceIds.value = [...selected];
}

function toggleCategorySourceId(sourceId) {
  const selected = new Set(selectedCategorySourceIds.value);
  if (selected.has(sourceId)) {
    selected.delete(sourceId);
  } else {
    selected.add(sourceId);
  }
  selectedCategorySourceIds.value = [...selected];
  if (isBotanyCollection.value) {
    selectedCategorySourceIds.value = writeBotanySelection(
      normalizeBotanyCategorySelection(selectedCategorySourceIds.value, categories.value),
    );
  } else if (isMicrobiologyCollection.value) {
    selectedCategorySourceIds.value = writeMicrobiologySelection(
      normalizeMicrobiologyCategorySelection(selectedCategorySourceIds.value, categories.value),
    );
  }
}

function resultFromStoredStatus(status) {
  if (!status) {
    return null;
  }
  return {
    alreadyAnswered: Boolean(status.answer),
    gradingMode: status.gradingMode,
    isCorrect: status.isCorrect,
    correctDisplay: status.correctDisplay,
    explanation: status.explanation,
    answer: status.answer,
    revealedAnswer: status.revealedAnswer,
  };
}

function answerFromStatus(status) {
  if (!status?.answer) {
    return {};
  }
  if (status.answer.selectedKey) {
    return { pendingAnswer: { selectedKey: status.answer.selectedKey } };
  }
  if (typeof status.answer.value === 'boolean') {
    return { pendingAnswer: { value: status.answer.value } };
  }
  if (typeof status.answer.text === 'string') {
    return { textAnswer: status.answer.text };
  }
  return {};
}

function resetForQuestion(question) {
  const status = question
    ? session.value?.answerStatusBySourceQuestionId?.[question.sourceQuestionId]
    : null;
  if (status) {
    interaction.value = createQuizInteractionState({
      questionType: question?.type ?? '',
      ...answerFromStatus(status),
      result: resultFromStoredStatus(status),
    });
    return;
  }

  interaction.value = resetQuizInteraction(question?.type ?? '');
}

function mergeQuestionStatus(sourceQuestionId, status) {
  if (!session.value || !sourceQuestionId) {
    return;
  }

  session.value = {
    ...session.value,
    answerStatusBySourceQuestionId: {
      ...(session.value.answerStatusBySourceQuestionId ?? {}),
      [sourceQuestionId]: status,
    },
  };
}

function getQuestionStatus(sourceQuestionId) {
  const status = session.value?.answerStatusBySourceQuestionId?.[sourceQuestionId];
  if (!status) {
    return '';
  }
  if (status.isCorrect === true) {
    return 'correct';
  }
  if (status.isCorrect === false) {
    return 'incorrect';
  }
  return 'revealed';
}

function setMolecularLanguage(language) {
  molecularLanguage.value = writeMolecularLanguage(language);
}

function focusTranslationInputIfNeeded(question = activeQuestion.value) {
  if (!shouldFocusTranslationInput(question, activeQuestionStatus.value)) {
    return;
  }

  nextTick(() => {
    translationInput.value?.focus();
  });
}

async function beginPractice() {
  if (!activeCollectionSlug.value) {
    message.value = '请选择课程和题目范围。';
    return;
  }

  isLoading.value = true;
  message.value = '';
  const resultData = await createQuizSession({
    collectionSlug: activeCollectionSlug.value,
    categorySourceIds: selectedCategorySourceIds.value,
  });
  isLoading.value = false;

  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }

  session.value = resultData.session;
  if (isMolecularCollection.value) {
    molecularPage.value = 'practice';
  } else if (isBotanyCollection.value) {
    botanyPage.value = 'practice';
  } else if (isMicrobiologyCollection.value) {
    microbiologyPage.value = 'practice';
  } else {
    quizView.value = 'practice';
  }
  answeredQuestionStatus.value = {};
  activePracticeRangeId.value = rangeOptions.value
    .find((option) => option.sourceIds.some((sourceId) => selectedCategorySourceIds.value.includes(sourceId)))
    ?.id ?? rangeOptions.value[0]?.id ?? '';
  resetForQuestion(activeQuestion.value);
  focusTranslationInputIfNeeded(activeQuestion.value);
}

async function beginBotanyPractice() {
  selectedCategorySourceIds.value = writeBotanySelection(
    normalizeBotanyCategorySelection(selectedCategorySourceIds.value, categories.value),
  );
  await beginPractice();
}

async function beginMicrobiologyPractice() {
  selectedCategorySourceIds.value = writeMicrobiologySelection(
    normalizeMicrobiologyCategorySelection(selectedCategorySourceIds.value, categories.value),
  );
  await beginPractice();
}

async function beginMistakePractice() {
  if (!activeCollectionSlug.value || !molecularMistakeRecords.value.length) {
    message.value = '错题本里还没有可练习的题目。';
    return;
  }

  isLoading.value = true;
  message.value = '';
  const resultData = await createQuizSession({
    collectionSlug: activeCollectionSlug.value,
    sourceQuestionIds: molecularMistakeRecords.value.map((record) => record.sourceQuestionId),
    mode: 'mistakes',
  });
  isLoading.value = false;

  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }

  session.value = resultData.session;
  molecularPage.value = 'practice';
  activePracticeRangeId.value = rangeOptions.value[0]?.id ?? '';
  answeredQuestionStatus.value = {};
  resetForQuestion(activeQuestion.value);
  focusTranslationInputIfNeeded(activeQuestion.value);
}

async function beginBotanyMistakePractice() {
  if (!activeCollectionSlug.value || !botanyMistakeRecords.value.length) {
    message.value = '错题本里还没有可练习的切片。';
    return;
  }

  isLoading.value = true;
  message.value = '';
  const resultData = await createQuizSession({
    collectionSlug: activeCollectionSlug.value,
    sourceQuestionIds: botanyMistakeRecords.value.map((record) => record.sourceQuestionId),
    mode: 'mistakes',
  });
  isLoading.value = false;

  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }

  session.value = resultData.session;
  selectedCategorySourceIds.value = Array.from(new Set(botanyMistakeRecords.value
    .map((record) => record.categorySourceId)
    .filter(Boolean)));
  botanyPage.value = 'practice';
  activePracticeRangeId.value = rangeOptions.value
    .find((option) => option.sourceIds.some((sourceId) => selectedCategorySourceIds.value.includes(sourceId)))
    ?.id ?? rangeOptions.value[0]?.id ?? '';
  answeredQuestionStatus.value = {};
  resetForQuestion(activeQuestion.value);
}

async function beginMicrobiologyMistakePractice() {
  if (!activeCollectionSlug.value || !microbiologyMistakeRecords.value.length) {
    message.value = '错题本里还没有可练习的题目。';
    return;
  }

  isLoading.value = true;
  message.value = '';
  const resultData = await createQuizSession({
    collectionSlug: activeCollectionSlug.value,
    sourceQuestionIds: microbiologyMistakeRecords.value.map((record) => record.sourceQuestionId),
    mode: 'mistakes',
  });
  isLoading.value = false;

  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }

  session.value = resultData.session;
  selectedCategorySourceIds.value = Array.from(new Set(microbiologyMistakeRecords.value
    .map((record) => record.categorySourceId)
    .filter(Boolean)));
  microbiologyPage.value = 'practice';
  activePracticeRangeId.value = rangeOptions.value
    .find((option) => option.sourceIds.some((sourceId) => selectedCategorySourceIds.value.includes(sourceId)))
    ?.id ?? rangeOptions.value[0]?.id ?? '';
  answeredQuestionStatus.value = {};
  resetForQuestion(activeQuestion.value);
}

function backToCourseCatalog() {
  quizView.value = 'catalog';
  session.value = null;
  message.value = '';
}

function backToRangeSelection() {
  if (isMolecularCollection.value) {
    molecularPage.value = 'categories';
  } else if (isBotanyCollection.value) {
    botanyPage.value = 'categories';
  } else if (isMicrobiologyCollection.value) {
    microbiologyPage.value = 'categories';
  } else {
    quizView.value = 'range';
  }
  session.value = null;
  resetForQuestion(null);
  message.value = '';
}

function exitPractice() {
  if (isMolecularCollection.value) {
    molecularPage.value = 'home';
    session.value = null;
    answeredQuestionStatus.value = {};
    resetForQuestion(null);
    message.value = '';
    return;
  }

  if (isBotanyCollection.value) {
    botanyPage.value = 'home';
    session.value = null;
    answeredQuestionStatus.value = {};
    resetForQuestion(null);
    message.value = '';
    return;
  }

  if (isMicrobiologyCollection.value) {
    microbiologyPage.value = 'home';
    session.value = null;
    answeredQuestionStatus.value = {};
    resetForQuestion(null);
    message.value = '';
    return;
  }

  quizView.value = 'catalog';
  molecularPage.value = 'home';
  microbiologyPage.value = 'home';
  session.value = null;
  activeCourseCode.value = '';
  activeCollectionSlug.value = '';
  categories.value = [];
  selectedCategorySourceIds.value = [];
  activePracticeRangeId.value = '';
  answeredQuestionStatus.value = {};
  resetForQuestion(null);
  message.value = '';
}

function setAnsweredStatus(sourceQuestionId, status) {
  answeredQuestionStatus.value = {
    ...answeredQuestionStatus.value,
    [sourceQuestionId]: status,
  };
}

function selectPracticeRange(option) {
  activePracticeRangeId.value = option.id;
  const firstQuestion = buildPracticeQuestionTiles({
    questionOrder: session.value?.questionOrder ?? [],
    questionIndex: session.value?.questionIndex ?? [],
    sourceIds: option.sourceIds,
  })[0];
  if (firstQuestion) {
    moveQuestion(firstQuestion.index);
  }
}

function chooseOption(value) {
  if (!activeQuestion.value || result.value || currentQuestionLocked.value) {
    return;
  }
  interaction.value = selectPendingAnswer(interaction.value, value);
}

function updateText(event) {
  if (currentQuestionLocked.value) {
    return;
  }
  interaction.value = updateTextAnswer(interaction.value, event.target.value);
}

function updateTextValue(value) {
  if (currentQuestionLocked.value) {
    return;
  }
  interaction.value = updateTextAnswer(interaction.value, value);
}

async function submitAnswer() {
  if (!session.value || !activeQuestion.value || result.value || currentQuestionLocked.value) {
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
  mergeQuestionStatus(activeQuestion.value.sourceQuestionId, {
    sourceQuestionId: activeQuestion.value.sourceQuestionId,
    answer,
    isCorrect: resultData.result.isCorrect,
    gradingMode: resultData.result.gradingMode,
    correctDisplay: resultData.result.correctDisplay,
    explanation: resultData.result.explanation,
  });
  setAnsweredStatus(activeQuestion.value.sourceQuestionId, resultData.result.isCorrect ? 'correct' : 'incorrect');
  if (isMolecularCollection.value && resultData.result.isCorrect === false) {
    molecularMistakeRecords.value = writeMolecularMistakes(upsertMolecularMistake(molecularMistakeRecords.value, {
      question: activeQuestion.value,
      answer,
      correctDisplay: resultData.result.correctDisplay,
    }));
  }
  if (isMicrobiologyCollection.value && resultData.result.isCorrect === false) {
    microbiologyMistakeRecords.value = writeMicrobiologyMistakes(upsertMicrobiologyMistake(microbiologyMistakeRecords.value, {
      question: activeQuestion.value,
      answer,
      correctDisplay: resultData.result.correctDisplay,
    }));
  }
}

async function submitUnknownAnswer() {
  if (!activeQuestion.value || result.value || currentQuestionLocked.value) {
    return;
  }
  interaction.value = selectPendingAnswer(interaction.value, 'UNKNOWN');
  await submitAnswer();
}

async function revealAnswer() {
  if (!session.value || !activeQuestion.value || result.value || currentQuestionLocked.value) {
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
  mergeQuestionStatus(activeQuestion.value.sourceQuestionId, {
    sourceQuestionId: activeQuestion.value.sourceQuestionId,
    revealed: true,
    gradingMode: resultData.result.gradingMode,
    correctDisplay: resultData.result.correctDisplay,
    revealedAnswer: resultData.result.answer,
    explanation: resultData.result.explanation,
  });
  setAnsweredStatus(activeQuestion.value.sourceQuestionId, 'revealed');
}

async function selfJudgeAnswer(isCorrect) {
  if (!session.value || !activeQuestion.value || !result.value || activeQuestionStatus.value?.answer) {
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
  mergeQuestionStatus(activeQuestion.value.sourceQuestionId, {
    sourceQuestionId: activeQuestion.value.sourceQuestionId,
    answer: { selfJudgedCorrect: Boolean(isCorrect) },
    isCorrect: resultData.result.isCorrect,
    gradingMode: resultData.result.gradingMode,
    correctDisplay: resultData.result.correctDisplay,
    explanation: resultData.result.explanation,
  });
  setAnsweredStatus(activeQuestion.value.sourceQuestionId, isCorrect ? 'correct' : 'incorrect');
  if (isMolecularCollection.value && !isCorrect) {
    molecularMistakeRecords.value = writeMolecularMistakes(upsertMolecularMistake(molecularMistakeRecords.value, {
      question: activeQuestion.value,
      answer: { selfJudgedCorrect: false },
      correctDisplay: resultData.result.correctDisplay,
    }));
  }
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
  const currentRef = session.value.questionIndex?.find((item) => item.index === session.value.currentIndex);
  const matchingRange = rangeOptions.value.find((option) => option.sourceIds.includes(currentRef?.categorySourceId));
  if (matchingRange) {
    activePracticeRangeId.value = matchingRange.id;
  }
  resetForQuestion(activeQuestion.value);
  focusTranslationInputIfNeeded(activeQuestion.value);
}

async function moveToNextQuestion() {
  if (session.value?.currentIndex === session.value?.questionOrder.length - 1 && result.value) {
    if (isMolecularCollection.value) {
      molecularPage.value = 'results';
    } else if (isBotanyCollection.value) {
      botanyPage.value = 'results';
    } else if (isMicrobiologyCollection.value) {
      microbiologyPage.value = 'results';
    } else {
      quizView.value = 'results';
    }
    return;
  }
  await moveQuestion(buildNextQuestionTarget(session.value, result.value));
}

async function startReviewMode() {
  if (!isMolecularCollection.value) {
    return;
  }

  isLoading.value = true;
  message.value = '';
  const resultData = await fetchQuizReviewTerms(activeCollectionSlug.value, selectedCategorySourceIds.value);
  isLoading.value = false;
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }

  molecularReviewTerms.value = resultData.terms ?? [];
  molecularReviewIndex.value = 0;
  molecularReviewShowAnswer.value = false;
  if (isMolecularCollection.value) {
    molecularPage.value = molecularReviewTerms.value.length ? 'review' : 'categories';
  } else {
    quizView.value = molecularReviewTerms.value.length ? 'review' : 'range';
  }
  if (!molecularReviewTerms.value.length) {
    message.value = '当前范围没有可复习的中英互译闪卡。';
  }
}

function navigateMolecularPage(pageId) {
  if (pageId === 'practice' && !session.value) {
    molecularPage.value = 'categories';
    return;
  }
  molecularPage.value = pageId;
}

function navigateBotanyPage(pageId) {
  if (pageId === 'practice' && !session.value) {
    botanyPage.value = 'categories';
    return;
  }
  botanyPage.value = pageId;
  if (pageId === 'gallery') {
    loadBotanyGallery();
  }
}

function navigateMicrobiologyPage(pageId) {
  if (pageId === 'practice' && !session.value) {
    microbiologyPage.value = 'categories';
    return;
  }
  microbiologyPage.value = pageId;
  if (pageId === 'pastExams') {
    loadMicrobiologyPastExams();
  }
}

async function loadBotanyGallery() {
  if (!isBotanyCollection.value || botanyGalleryItems.value.length) {
    return;
  }

  const resultData = await fetchQuizImageGallery(activeCollectionSlug.value);
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  botanyGalleryItems.value = resultData.items ?? [];
  botanyGalleryActiveCategory.value = buildBotanyGalleryGroups(botanyGalleryItems.value)[0]?.id ?? '';
}

async function loadMicrobiologyPastExams() {
  if (!isMicrobiologyCollection.value || microbiologyPastExams.value.length) {
    return;
  }

  const resultData = await fetchQuizPastExams(activeCollectionSlug.value);
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  microbiologyPastExams.value = resultData.exams ?? [];
}

async function openMicrobiologyPastExam(examId) {
  activePastExamId.value = examId;
  activePastExamIndex.value = 0;
  microbiologyPastExamAnswers.value = {};
  const resultData = await fetchQuizPastExamQuestions(activeCollectionSlug.value, examId);
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  microbiologyPastExamQuestions.value = resultData.questions ?? [];
}

async function submitPastExamAnswer(selectedKey) {
  if (!activePastExam.value || !activePastExamQuestion.value || activePastExamAnswer.value || vocabularyPickEnabled.value) {
    return;
  }

  const resultData = await fetchQuizPastExamFeedback(activeCollectionSlug.value, activePastExam.value.examId, {
    questionNumber: activePastExamQuestion.value.number,
    selectedKey,
  });
  if (!resultData.ok) {
    message.value = resultData.message;
    return;
  }
  microbiologyPastExamAnswers.value = {
    ...microbiologyPastExamAnswers.value,
    [activePastExamQuestion.value.number]: resultData.result,
  };
}

function movePastExamQuestion(direction) {
  if (!microbiologyPastExamQuestions.value.length) {
    return;
  }
  const maxIndex = microbiologyPastExamQuestions.value.length - 1;
  activePastExamIndex.value = Math.min(Math.max(activePastExamIndex.value + direction, 0), maxIndex);
}

function selectAllBotanyCategories() {
  selectedCategorySourceIds.value = writeBotanySelection(categories.value.map((category) => category.sourceId));
}

function clearBotanyCategories() {
  selectedCategorySourceIds.value = writeBotanySelection([]);
}

function selectAllMicrobiologyCategories() {
  selectedCategorySourceIds.value = writeMicrobiologySelection(categories.value.map((category) => category.sourceId));
}

function clearMicrobiologyCategories() {
  selectedCategorySourceIds.value = writeMicrobiologySelection([]);
}

function isBotanyMistake(sourceQuestionId) {
  return botanyMistakeRecords.value.some((record) => record.sourceQuestionId === sourceQuestionId);
}

function addActiveBotanyMistake() {
  if (!activeQuestion.value || !result.value?.revealedAnswer) {
    return;
  }
  botanyMistakeRecords.value = writeBotanyMistakes(upsertBotanyMistake(botanyMistakeRecords.value, {
    question: activeQuestion.value,
    revealedAnswer: result.value.revealedAnswer,
  }));
}

function removeBotanyMistakeRecord(sourceQuestionId) {
  botanyMistakeRecords.value = writeBotanyMistakes(removeBotanyMistake(botanyMistakeRecords.value, sourceQuestionId));
}

function clearBotanyMistakeRecords() {
  botanyMistakeRecords.value = writeBotanyMistakes(clearBotanyMistakes());
}

function removeMicrobiologyMistakeRecord(sourceQuestionId) {
  microbiologyMistakeRecords.value = writeMicrobiologyMistakes(removeMicrobiologyMistake(
    microbiologyMistakeRecords.value,
    sourceQuestionId,
  ));
}

function clearMicrobiologyMistakeRecords() {
  microbiologyMistakeRecords.value = writeMicrobiologyMistakes(clearMicrobiologyMistakes());
}

function selectAllInMolecularGroup(group) {
  const selected = new Set(selectedCategorySourceIds.value);
  const allSelected = group.categories.every((category) => selected.has(category.sourceId));
  for (const category of group.categories) {
    if (allSelected) {
      selected.delete(category.sourceId);
    } else {
      selected.add(category.sourceId);
    }
  }
  selectedCategorySourceIds.value = [...selected];
}

function clearMolecularGroup(group) {
  const groupIds = new Set(group.categories.map((category) => category.sourceId));
  selectedCategorySourceIds.value = selectedCategorySourceIds.value.filter((sourceId) => !groupIds.has(sourceId));
}

function moveReviewCard(direction) {
  if (!molecularReviewTerms.value.length) {
    return;
  }
  const maxIndex = molecularReviewTerms.value.length - 1;
  molecularReviewIndex.value = Math.min(Math.max(molecularReviewIndex.value + direction, 0), maxIndex);
  molecularReviewShowAnswer.value = false;
}

function speakActiveReviewTerm() {
  const term = currentReviewTerm.value;
  if (term) {
    speakMolecularText(getMolecularSpeakText(term));
  }
}

function addVocabularyTerm(term) {
  if (!activeQuestion.value) {
    return;
  }
  vocabularyFeedback.value = buildVocabularyFeedback(term, vocabularyRecords.value);
  vocabularyRecords.value = writeVocabularyRecords([
    createVocabularyRecord(term, {
      questionId: activeQuestion.value.sourceQuestionId,
      contextText: displayedPrompt.value,
      sourceType: activeQuestion.value.type,
      questionNumber: session.value?.currentIndex + 1,
      chapterTitle: activePracticeRange.value?.title ?? '',
    }),
    ...vocabularyRecords.value,
  ]);

  window.setTimeout(() => {
    if (vocabularyFeedback.value.includes(String(term).trim())) {
      vocabularyFeedback.value = '';
    }
  }, 1400);
}

function addMicrobiologyVocabularyTerm(term, contextText = displayedPrompt.value) {
  const cleanTerm = String(term ?? '').trim();
  if (!cleanTerm) {
    return;
  }

  const exists = microbiologyVocabularyRecords.value.some((record) => (
    record.normalizedTerm === cleanTerm.toLowerCase()
    && record.contextText.trim().toLowerCase() === String(contextText ?? '').trim().toLowerCase()
  ));
  vocabularyFeedback.value = exists ? `已在生词本：${cleanTerm}` : `已加入：${cleanTerm}`;
  microbiologyVocabularyRecords.value = writeMicrobiologyVocabularyRecords([
    createMicrobiologyVocabularyRecord(cleanTerm, {
      questionId: activeQuestion.value?.sourceQuestionId ?? '',
      examId: activePastExam.value?.examId ?? '',
      contextText,
      sourceType: activePastExam.value ? 'past-exam' : 'practice',
      questionNumber: activePastExamQuestion.value?.number ?? session.value?.currentIndex + 1,
      chapterId: activeQuestion.value?.body?.chapterId ?? activePastExamQuestion.value?.match?.sourceChapterId ?? 0,
      chapterTitle: activePracticeRange.value?.title ?? activePastExam.value?.title ?? '',
    }),
    ...microbiologyVocabularyRecords.value,
  ]);

  window.setTimeout(() => {
    if (vocabularyFeedback.value.includes(cleanTerm)) {
      vocabularyFeedback.value = '';
    }
  }, 1400);
}

function cycleVocabulary(record) {
  vocabularyRecords.value = writeVocabularyRecords(vocabularyRecords.value.map((item) => (
    item.normalizedTerm === record.normalizedTerm
      ? { ...item, status: cycleVocabularyStatus(item.status), updatedAt: new Date().toISOString() }
      : item
  )));
}

function cycleMicrobiologyVocabulary(record) {
  microbiologyVocabularyRecords.value = writeMicrobiologyVocabularyRecords(microbiologyVocabularyRecords.value.map((item) => (
    item.id === record.id
      ? { ...item, status: cycleMicrobiologyVocabularyStatus(item.status), updatedAt: new Date().toISOString() }
      : item
  )));
}

function clearVocabulary() {
  vocabularyRecords.value = writeVocabularyRecords([]);
}

function clearMicrobiologyVocabulary() {
  microbiologyVocabularyRecords.value = writeMicrobiologyVocabularyRecords([]);
}

function removeMolecularMistakeRecord(sourceQuestionId) {
  molecularMistakeRecords.value = writeMolecularMistakes(removeMolecularMistake(
    molecularMistakeRecords.value,
    sourceQuestionId,
  ));
}

function clearMolecularMistakeRecords() {
  molecularMistakeRecords.value = writeMolecularMistakes(clearMolecularMistakes());
}

function exportVocabulary() {
  const blob = new Blob([JSON.stringify(vocabularyRecords.value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'molecular-vocabulary.json';
  link.click();
  URL.revokeObjectURL(url);
}

function importVocabulary(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      vocabularyRecords.value = writeVocabularyRecords([
        ...JSON.parse(String(reader.result ?? '[]')),
        ...vocabularyRecords.value,
      ]);
    } catch {
      message.value = '生词本导入失败，请检查 JSON 文件。';
    }
    event.target.value = '';
  });
  reader.readAsText(file);
}

function handleGlobalKeydown(event) {
  if (activePage.value !== 'quiz') {
    return;
  }

  if (quizView.value === 'review' || (quizView.value === 'molecular' && molecularPage.value === 'review')) {
    if (event.key === 'Enter') {
      event.preventDefault();
      molecularReviewShowAnswer.value = true;
    } else if (event.key === ' ') {
      event.preventDefault();
      speakActiveReviewTerm();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveReviewCard(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveReviewCard(1);
    }
    return;
  }

  if (quizView.value !== 'practice' && !(quizView.value === 'molecular' && molecularPage.value === 'practice')) {
    return;
  }

  const tagName = event.target?.tagName?.toLowerCase();
  const isInputTarget = ['input', 'textarea', 'select'].includes(tagName);
  if (isInputTarget && !(activeQuestion.value?.type === 'translation' && event.key === 'Enter')) {
    return;
  }

  const keyResult = handleQuizKey(interaction.value, event);
  if (keyResult.action === 'none') {
    return;
  }
  event.preventDefault();

  if (keyResult.action === 'select') {
    interaction.value = keyResult.state;
  } else if (keyResult.action === 'submit') {
    submitAnswer();
  } else if (keyResult.action === 'next') {
    moveToNextQuestion();
  } else if (keyResult.action === 'previous') {
    moveQuestion('previous');
  } else if (keyResult.action === 'speak') {
    speakMolecularText(getMolecularSpeakText({
      answerTerm: result.value?.correctDisplay ?? interaction.value.textAnswer,
      prompt: activeQuestion.value?.prompt,
    }));
  }
}

function activeOptionText(option) {
  return isMolecularCollection.value
    ? getMolecularOptionText(option, molecularLanguage.value)
    : (option?.textCn || option?.text || '');
}

function imageUrl(path) {
  return publicAssetPath(`/resource/quiz/${activeCourseCode.value}/${activeCollectionSlug.value}/${path}`);
}

async function syncPageFromHash() {
  const nextPage = routeFromHash();
  resetPageState(nextPage);
  activePage.value = nextPage;

  if (nextPage !== 'overview') {
    activeOverviewCourse.value = null;
    return;
  }

  const nextRoute = parseResourceHash(window.location.hash);
  overviewRoute.value = nextRoute;
  if (!nextRoute.courseCode) {
    activeOverviewCourse.value = null;
    return;
  }

  const requestedCourseCode = nextRoute.courseCode;
  const course = await getResourceCourseByCode(requestedCourseCode);
  if (overviewRoute.value.courseCode === requestedCourseCode) {
    activeOverviewCourse.value = getCourseDetail(course);
  }
}

function backToOverview() {
  setPage('overview');
}

watch(activeCollectionSlug, loadCategories);

onMounted(() => {
  syncPageFromHash();
  window.addEventListener('hashchange', syncPageFromHash);
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncPageFromHash);
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="demo-shell">
    <header class="demo-head">
      <a class="demo-brand" :href="getDemoPageHref('home')" @click.prevent="setPage('home')">
        <span>生科智学</span>
        <strong>Life Science Study</strong>
      </a>
      <nav class="demo-topnav" aria-label="主导航">
        <a
          v-for="page in topPages"
          :key="page.id"
          :href="getDemoPageHref(page.id)"
          :class="{ 'is-active': activePage === page.id }"
          @click.prevent="setPage(page.id)"
        >
          {{ page.label }}
        </a>
      </nav>
      <span class="demo-user-chip">学生</span>
    </header>

    <main class="demo-main">
      <HomePage v-if="activePage === 'home'" />

      <template v-else-if="activePage === 'overview'">
        <CourseDetailPage
          v-if="activeOverviewCourse"
          :course="activeOverviewCourse"
          :active-tab-id="overviewRoute.tabId"
          :active-item-id="overviewRoute.itemId"
          :user="studentViewer"
          :can-submit="userCanSubmit"
          :can-comment="userCanComment"
          :can-favorite="userCanFavorite"
          :favorite-keys="[]"
          :comments-by-key="{}"
          @back="backToOverview"
        />
        <OverviewPage v-else />
      </template>

      <section v-else-if="activePage === 'activities'" class="demo-placeholder" aria-labelledby="activities-title">
        <p>活动</p>
        <h1 id="activities-title">学院活动与学生会内容将在这里持续更新。</h1>
      </section>

      <section v-else-if="activePage === 'about'" class="demo-placeholder" aria-labelledby="about-title">
        <p>关于</p>
        <h1 id="about-title">生科智学会先把刷题和资源入口做稳。</h1>
      </section>

      <section v-else class="quiz-demo" aria-label="刷题">
        <template v-if="quizView === 'catalog'">
          <aside class="quiz-left-nav" aria-label="刷题侧栏">
            <button class="is-active" type="button">首页</button>
          </aside>

          <div class="quiz-main">
            <div class="quiz-market">
            <nav class="quiz-market-tabs" aria-label="课程状态">
              <button
                type="button"
                :class="{ 'is-active': activeCourseTab === 'supported' }"
                @click="showCourseTab('supported')"
              >
                支持课程
              </button>
              <button
                type="button"
                :class="{ 'is-active': activeCourseTab === 'pending' }"
                @click="showCourseTab('pending')"
              >
                待做课程
              </button>
            </nav>

            <section v-if="activeCourseTab === 'supported'" class="quiz-course-grid" aria-label="支持课程">
              <article
                v-for="course in supportedCourses"
                :key="course.code"
                class="quiz-course-card"
                :class="`is-${course.tone}`"
              >
                <span>{{ course.code }}</span>
                <h2>{{ course.name }}</h2>
                <p>{{ course.rangeHint }}</p>
                <button type="button" @click="selectCourse(course.code)">选择课程</button>
              </article>
            </section>

            <section v-else-if="activeCourseTab === 'pending'" class="quiz-course-grid" aria-label="待做课程">
              <article class="quiz-course-card is-pending">
                <span>待做课程</span>
                <h2>{{ pendingCourses[0] }}</h2>
                <p>题库迁移后加入支持课程。</p>
                <button type="button" disabled>暂未开放</button>
              </article>
            </section>
            </div>
          </div>
        </template>

        <div v-else-if="quizView === 'range'" class="quiz-range-shell">
          <aside class="practice-menu" aria-label="练习导航">
            <button type="button">概览</button>
            <button type="button">题目列表</button>
          </aside>
          <div class="quiz-range-page">
            <section v-if="activeCourse" class="range-panel" aria-label="范围选择">
              <div class="range-panel__head">
                <div>
                  <span>范围选择</span>
                  <h2>{{ activeCourse.name }}</h2>
                </div>
                <p>{{ activeCollection?.title || '正在读取题库' }}</p>
              </div>

              <div class="range-card-grid">
                <button
                  v-for="option in rangeOptions"
                  :key="option.id"
                  type="button"
                  class="range-card"
                  :class="{ 'is-selected': isRangeSelected(option) }"
                  @click="toggleRangeOption(option)"
                >
                  <strong>{{ option.title }}</strong>
                  <em v-if="option.subtitle">{{ option.subtitle }}</em>
                  <span>{{ option.countLabel }}</span>
                </button>
              </div>

              <div class="range-panel__actions">
                <button type="button" class="secondary-button" @click="backToCourseCatalog">返回课程</button>
                <button
                  v-if="isMolecularCollection"
                  type="button"
                  class="secondary-button"
                  :disabled="isLoading"
                  @click="startReviewMode"
                >
                  闪卡复习
                </button>
                <button
                  v-if="isMolecularCollection"
                  type="button"
                  class="secondary-button"
                  @click="quizView = 'vocabulary'"
                >
                  生词本
                </button>
                <button type="button" :disabled="isLoading" @click="beginPractice">进入练习</button>
              </div>
            </section>
          </div>
        </div>

        <QuizPracticeLayout
          v-else-if="quizView === 'practice'"
          :range-summaries="practiceRangeSummaries"
          :active-range-id="activePracticeRange?.id || ''"
          :question-tiles="activePracticeQuestionIndexes"
          :active-index="session?.currentIndex || 0"
          :active-range-title="activePracticeRange?.title || ''"
          :tile-status-by-source-question-id="questionTileStatusBySourceId"
          @select-range="selectPracticeRange"
          @move-question="moveQuestion"
        >

            <article v-if="activeQuestion" class="practice-question">
              <header class="practice-question__head">
                <button type="button" @click="backToRangeSelection">返回选题</button>
                <button type="button" class="danger-button" @click="exitPractice">退出练习</button>
                <span
                  v-if="isMolecularCollection && activeQuestion.type !== 'translation'"
                  class="language-toggle"
                  aria-label="内容语言"
                >
                  <button type="button" :class="{ 'is-active': molecularLanguage === 'zh' }" @click="setMolecularLanguage('zh')">
                    中
                  </button>
                  <button type="button" :class="{ 'is-active': molecularLanguage === 'en' }" @click="setMolecularLanguage('en')">
                    EN
                  </button>
                </span>
                <span>{{ questionIndexText }}</span>
              </header>

              <h1 v-if="!vocabularyPickEnabled || !isMolecularCollection || activeQuestion.type === 'translation'">
                {{ displayedPrompt }}
              </h1>
              <h1 v-else class="vocabulary-pick-line">
                <button
                  v-for="(token, tokenIndex) in tokenizeVocabularyText(displayedPrompt)"
                  :key="`${token}-${tokenIndex}`"
                  type="button"
                  @click="addVocabularyTerm(token)"
                >
                  {{ token }}
                </button>
              </h1>
              <label v-if="isMolecularCollection && activeQuestion.type !== 'translation'" class="vocabulary-picker-toggle">
                <input v-model="vocabularyPickEnabled" type="checkbox" />
                <span>取词</span>
              </label>
              <p v-if="vocabularyFeedback" class="vocabulary-feedback">{{ vocabularyFeedback }}</p>

              <img
                v-if="activeQuestion.type === 'image_reveal'"
                class="practice-question__image"
                :src="imageUrl(activeQuestion.body.imagePath)"
                alt="题目图片"
              />

              <ChoiceQuestionView
                v-if="['single_choice', 'multiple_choice'].includes(activeQuestion.type)"
                :options="activeQuestion.body.options"
                :selected-key="pendingSelectedKey"
                :result="result"
                :locked="Boolean(result) || currentQuestionLocked"
                :vocabulary-enabled="vocabularyPickEnabled"
                :option-text-resolver="activeOptionText"
                @select="chooseOption"
              />

              <TrueFalseQuestionView
                v-else-if="activeQuestion.type === 'true_false'"
                :selected-value="pendingTrueFalse"
                :locked="Boolean(result) || currentQuestionLocked"
                @select="chooseOption"
              />

              <TextAnswerQuestionView
                v-else-if="activeQuestion.type === 'translation'"
                ref="translationInput"
                :value="interaction.textAnswer"
                placeholder="输入答案"
                :locked="Boolean(result) || currentQuestionLocked"
                @input="updateTextValue"
                @submit="submitAnswer"
              />

              <textarea
                v-else-if="['short_answer', 'essay'].includes(activeQuestion.type)"
                class="practice-textarea"
                :value="interaction.textAnswer"
                placeholder="可以在这里打草稿，揭晓后自评"
                :disabled="currentQuestionLocked"
                @input="updateText"
              ></textarea>

              <div class="practice-actions">
                <button type="button" @click="moveQuestion('previous')">上一题</button>
                <button
                  v-if="['single_choice', 'multiple_choice', 'true_false', 'translation'].includes(activeQuestion.type)"
                  type="button"
                  :disabled="!canSubmitAnswer"
                  @click="submitAnswer"
                >
                  提交
                </button>
                <button v-else type="button" :disabled="Boolean(result)" @click="revealAnswer">查看答案</button>
                <button
                  v-if="['short_answer', 'essay'].includes(activeQuestion.type) && result && !activeQuestionStatus?.answer"
                  type="button"
                  @click="selfJudgeAnswer(true)"
                >
                  答对
                </button>
                <button
                  v-if="['short_answer', 'essay'].includes(activeQuestion.type) && result && !activeQuestionStatus?.answer"
                  type="button"
                  @click="selfJudgeAnswer(false)"
                >
                  答错
                </button>
                <button type="button" @click="moveToNextQuestion">下一题</button>
              </div>

              <MarkdownResultView
                v-if="result"
                :result="result"
                :explanation="displayedResultExplanation"
              />
            </article>
        </QuizPracticeLayout>

        <div v-else-if="quizView === 'review'" class="practice-layout practice-layout--review">
          <article v-if="currentReviewTerm" class="practice-question review-card">
            <header class="practice-question__head">
              <button type="button" @click="quizView = 'range'">返回选题</button>
              <button type="button" @click="speakActiveReviewTerm">发音</button>
              <span>{{ molecularReviewIndex + 1 }} / {{ molecularReviewTerms.length }}</span>
            </header>
            <p class="practice-question__meta">{{ currentReviewTerm.categoryTitle }}</p>
            <h1>{{ currentReviewTerm.promptCn || currentReviewTerm.chineseMeaning }}</h1>
            <div v-if="molecularReviewShowAnswer" class="practice-result">
              <strong>{{ currentReviewTerm.answerTerm }}</strong>
              <p v-if="currentReviewTerm.answerFullTerm">{{ currentReviewTerm.answerFullTerm }}</p>
            </div>
            <div class="practice-actions">
              <button type="button" @click="moveReviewCard(-1)">上一张</button>
              <button type="button" @click="molecularReviewShowAnswer = true">显示答案</button>
              <button type="button" @click="moveReviewCard(1)">下一张</button>
            </div>
          </article>
        </div>

        <div v-else-if="quizView === 'vocabulary'" class="quiz-range-page">
          <section class="range-panel vocabulary-panel" aria-label="生词本">
            <div class="range-panel__head">
              <div>
                <span>分子生物学</span>
                <h2>生词本</h2>
              </div>
              <p>{{ vocabularyRecords.length }} 个词</p>
            </div>
            <div class="practice-actions">
              <button type="button" @click="quizView = session ? 'practice' : 'range'">返回</button>
              <button type="button" @click="vocabularyFilter = 'all'">全部</button>
              <button type="button" @click="vocabularyFilter = 'new'">新词</button>
              <button type="button" @click="vocabularyFilter = 'learning'">学习中</button>
              <button type="button" @click="vocabularyFilter = 'mastered'">已掌握</button>
              <button type="button" @click="exportVocabulary">导出</button>
              <label class="secondary-button">
                导入
                <input type="file" accept="application/json" hidden @change="importVocabulary" />
              </label>
              <button type="button" class="danger-button" @click="clearVocabulary">清空</button>
            </div>
            <div class="vocabulary-list">
              <button
                v-for="record in filteredVocabularyRecords"
                :key="record.normalizedTerm"
                type="button"
                class="vocabulary-item"
                @click="cycleVocabulary(record)"
              >
                <strong>{{ record.term }}</strong>
                <span>{{ record.status }}</span>
              </button>
            </div>
          </section>
        </div>

        <div v-else-if="quizView === 'results'" class="quiz-range-page">
          <section class="range-panel results-panel" aria-label="本轮结果">
            <div class="range-panel__head">
              <div>
                <span>本轮结果</span>
                <h2>{{ activeCourse?.name }}</h2>
              </div>
              <p>{{ resultSummary.answered }} / {{ resultSummary.total }}</p>
            </div>
            <div class="result-stats">
              <strong>正确 {{ resultSummary.correct }}</strong>
              <strong>错误 {{ resultSummary.incorrect }}</strong>
              <strong>未答 {{ resultSummary.unanswered }}</strong>
              <strong>自评正确 {{ resultSummary.selfJudgedCorrect }}</strong>
              <strong>自评错误 {{ resultSummary.selfJudgedIncorrect }}</strong>
            </div>
            <div class="practice-overview-list">
              <div v-for="(bucket, label) in resultSummary.byType" :key="label" class="practice-overview-row">
                <span>{{ label }}</span>
                <strong>{{ bucket.correct }} / {{ bucket.answered || bucket.total }}</strong>
              </div>
            </div>
            <div class="practice-actions">
              <button type="button" @click="quizView = 'practice'">返回练习</button>
              <button type="button" @click="beginPractice">重新开始</button>
              <button type="button" class="secondary-button" @click="backToRangeSelection">重新选题</button>
            </div>
          </section>
        </div>

        <QuizCourseShell
          v-else-if="quizView === 'microbiology'"
          :page="microbiologyPage"
          :title="activeCourse?.name || '微生物学'"
          :navigation-items="activeCourseConfig.navigationItems"
          :aria-label="activeCourseConfig.ariaLabel"
          @navigate="navigateMicrobiologyPage"
          @back="backToCourseCatalog"
        >
          <section v-if="microbiologyPage === 'home'" class="microbiology-page-stack" aria-label="微生物学首页">
            <div class="microbiology-hero">
              <span>{{ activeCourse?.code }}</span>
              <h2>微生物学期末复习刷题器</h2>
              <p>按期末复习范围做章节选择题，也可以进入旧项目整理出的期中真题卷。</p>
              <div class="practice-actions">
                <button type="button" @click="microbiologyPage = 'categories'">开始选章</button>
                <button v-if="session" type="button" class="secondary-button" @click="microbiologyPage = 'practice'">继续练习</button>
                <button type="button" class="secondary-button" @click="navigateMicrobiologyPage('pastExams')">进入真题</button>
                <button type="button" class="secondary-button" @click="microbiologyPage = 'mistakes'">查看错题本</button>
              </div>
            </div>
            <div class="result-stats">
              <strong>章节题 {{ activeCollection?.questionCount || 0 }}</strong>
              <strong>期末章节 {{ categories.length }}</strong>
              <strong>错题 {{ microbiologyMistakeRecords.length }}</strong>
              <strong>生词 {{ microbiologyVocabularyRecords.length }}</strong>
            </div>
            <div class="microbiology-feature-grid">
              <button type="button" class="range-card" @click="microbiologyPage = 'categories'">
                <strong>章节练习</strong>
                <em>期末范围</em>
                <span>稳定顺序练习</span>
              </button>
              <button type="button" class="range-card" @click="navigateMicrobiologyPage('pastExams')">
                <strong>期中真题</strong>
                <em>整卷模式</em>
                <span>{{ microbiologyPastExams.length || '加载后显示' }} 套</span>
              </button>
              <button type="button" class="range-card" @click="microbiologyPage = 'vocabulary'">
                <strong>生词本</strong>
                <em>本地保存</em>
                <span>{{ microbiologyVocabularyRecords.length }} 个词</span>
              </button>
            </div>
          </section>

          <section v-else-if="microbiologyPage === 'categories'" class="microbiology-page-stack" aria-label="章节选择">
            <div class="range-panel__head">
              <div>
                <span>章节</span>
                <h2>{{ activeCourse?.name }}</h2>
              </div>
              <div class="microbiology-category-summary">
                <p>已选 {{ selectedCategorySourceIds.length }} 章，{{ selectedMicrobiologyCount }} 题</p>
                <div class="range-panel__actions">
                  <button type="button" class="secondary-button" @click="microbiologyPage = 'home'">返回首页</button>
                  <button type="button" :disabled="isLoading || !selectedMicrobiologyCount" @click="beginMicrobiologyPractice">开始练习</button>
                </div>
              </div>
            </div>
            <div class="practice-actions microbiology-toolbar">
              <button type="button" class="secondary-button" @click="selectAllMicrobiologyCategories">全选期末范围章节</button>
              <button type="button" class="secondary-button" @click="clearMicrobiologyCategories">清空</button>
            </div>
            <div class="range-card-grid">
              <button
                v-for="category in categories"
                :key="category.sourceId"
                type="button"
                class="range-card"
                :class="{ 'is-selected': selectedCategorySourceIds.includes(category.sourceId) }"
                @click="toggleCategorySourceId(category.sourceId)"
              >
                <strong>Chapter {{ category.sourceId }}</strong>
                <em>{{ category.title }}</em>
                <span>{{ category.questionCount }} 题</span>
              </button>
            </div>
          </section>

          <section v-else-if="microbiologyPage === 'pastExams'" class="microbiology-page-stack" aria-label="真题">
            <div class="range-panel__head">
              <div>
                <span>真题</span>
                <h2>{{ activePastExam?.title || '期中真题卷练习' }}</h2>
              </div>
              <p v-if="activePastExamQuestion">{{ activePastExamIndex + 1 }} / {{ microbiologyPastExamQuestions.length }}</p>
            </div>
            <div v-if="!activePastExamQuestion" class="microbiology-feature-grid">
              <article v-for="exam in microbiologyPastExams" :key="exam.examId" class="microbiology-record-card">
                <span>{{ exam.title }}</span>
                <h3>{{ exam.sourcePdf }}</h3>
                <p>{{ exam.questionCount }} 题，已有答案 {{ exam.answeredCount }} 题，已有解析 {{ exam.explanationCount }} 题。</p>
                <p>精确命中 {{ exam.exactMatches }}，高置信匹配 {{ exam.highMatches }}，需复核 {{ exam.reviewMatches }}。</p>
                <button type="button" @click="openMicrobiologyPastExam(exam.examId)">进入试卷</button>
              </article>
            </div>
            <article v-else class="practice-question">
              <header class="practice-question__head">
                <button type="button" @click="activePastExamId = ''; microbiologyPastExamQuestions = []">返回真题列表</button>
                <button type="button" class="secondary-button" @click="vocabularyPickEnabled = !vocabularyPickEnabled">
                  {{ vocabularyPickEnabled ? '退出取词' : '取词模式' }}
                </button>
                <span>第 {{ activePastExamQuestion.number }} 题</span>
              </header>
              <p class="practice-question__meta">{{ activePastExam.sourcePdf }}</p>
              <h1>{{ activePastExamQuestion.prompt }}</h1>
              <div v-if="vocabularyPickEnabled" class="vocabulary-token-row">
                <button
                  v-for="term in tokenizeMicrobiologyVocabularyText(activePastExamQuestion.prompt)"
                  :key="term"
                  type="button"
                  class="secondary-button"
                  @click="addMicrobiologyVocabularyTerm(term, activePastExamQuestion.prompt)"
                >
                  {{ term }}
                </button>
              </div>
              <p v-if="vocabularyFeedback" class="vocabulary-confirm">{{ vocabularyFeedback }}</p>
              <ChoiceQuestionView
                :options="activePastExamQuestion.options"
                :selected-key="activePastExamAnswer?.selectedKey || ''"
                :result="activePastExamChoiceResult"
                :locked="Boolean(activePastExamAnswer)"
                :vocabulary-enabled="vocabularyPickEnabled"
                @select="submitPastExamAnswer"
              />
              <div class="practice-result">
                <template v-if="activePastExamAnswer">
                  <strong>{{ activePastExamAnswer.isCorrect ? '回答正确' : '回答错误' }}</strong>
                  <p>正确答案：{{ activePastExamAnswer.correctKey || '暂无标准答案' }}。你选择的是 {{ activePastExamAnswer.selectedKey }}。</p>
                  <p v-if="activePastExamAnswer.explanation?.explanation">{{ activePastExamAnswer.explanation.explanation }}</p>
                </template>
                <template v-else>
                  <strong>等待作答</strong>
                  <p>点击选项后显示答案和解析。</p>
                </template>
              </div>
              <div class="practice-actions">
                <button type="button" :disabled="activePastExamIndex === 0" @click="movePastExamQuestion(-1)">上一题</button>
                <button type="button" :disabled="activePastExamIndex === microbiologyPastExamQuestions.length - 1" @click="movePastExamQuestion(1)">下一题</button>
                <button type="button" class="secondary-button" :disabled="Boolean(activePastExamAnswer)" @click="submitPastExamAnswer('UNKNOWN')">不知道</button>
                <button type="button" class="secondary-button" @click="microbiologyPage = 'vocabulary'">生词本</button>
              </div>
            </article>
          </section>

          <QuizPracticeLayout
            v-else-if="microbiologyPage === 'practice'"
            :range-summaries="practiceRangeSummaries"
            :active-range-id="activePracticeRange?.id || ''"
            :question-tiles="activePracticeQuestionIndexes"
            :active-index="session?.currentIndex || 0"
            :active-range-title="activePracticeRange?.title || ''"
            :tile-status-by-source-question-id="questionTileStatusBySourceId"
            @select-range="selectPracticeRange"
            @move-question="moveQuestion"
          >

            <article v-if="activeQuestion" class="practice-question">
              <header class="practice-question__head">
                <button type="button" @click="backToRangeSelection">返回章节</button>
                <button type="button" class="danger-button" @click="exitPractice">退出练习</button>
                <button type="button" class="secondary-button" @click="vocabularyPickEnabled = !vocabularyPickEnabled">
                  {{ vocabularyPickEnabled ? '退出取词' : '取词模式' }}
                </button>
                <span>{{ questionIndexText }}</span>
              </header>
              <p class="practice-question__meta">Chapter {{ activeQuestion.body.chapterId }} · 第 {{ activeQuestion.body.number }} 题</p>
              <h1>{{ activeQuestion.prompt }}</h1>
              <div v-if="vocabularyPickEnabled" class="vocabulary-token-row">
                <button
                  v-for="term in tokenizeMicrobiologyVocabularyText(activeQuestion.prompt)"
                  :key="term"
                  type="button"
                  class="secondary-button"
                  @click="addMicrobiologyVocabularyTerm(term, activeQuestion.prompt)"
                >
                  {{ term }}
                </button>
              </div>
              <p v-if="vocabularyFeedback" class="vocabulary-confirm">{{ vocabularyFeedback }}</p>
              <ChoiceQuestionView
                :options="activeQuestion.body.options"
                :selected-key="pendingSelectedKey"
                :result="result"
                :locked="Boolean(result) || currentQuestionLocked"
                :vocabulary-enabled="vocabularyPickEnabled"
                @select="chooseOption"
              />
              <div v-if="result" class="practice-result">
                <strong>{{ result.isCorrect ? '回答正确' : '回答错误' }}</strong>
                <p>正确答案：{{ result.correctDisplay }}。</p>
                <p v-if="result.explanation?.explanation">{{ result.explanation.explanation }}</p>
              </div>
              <div class="practice-actions">
                <button type="button" :disabled="session.currentIndex === 0" @click="moveQuestion('previous')">上一题</button>
                <button type="button" :disabled="!canSubmitAnswer" @click="submitAnswer">提交</button>
                <button type="button" class="secondary-button" :disabled="Boolean(result) || currentQuestionLocked" @click="submitUnknownAnswer">不知道</button>
                <button type="button" @click="moveToNextQuestion">{{ session.currentIndex === session.questionOrder.length - 1 && result ? '查看结果' : '下一题' }}</button>
                <button type="button" class="secondary-button" @click="beginMicrobiologyPractice">重新开始</button>
              </div>
            </article>
          </QuizPracticeLayout>

          <section v-else-if="microbiologyPage === 'mistakes'" class="microbiology-page-stack" aria-label="错题本">
            <div class="range-panel__head">
              <div>
                <span>错题本</span>
                <h2>本地错题</h2>
              </div>
              <div class="microbiology-category-summary">
                <p>{{ microbiologyMistakeRecords.length }} 题</p>
                <div class="range-panel__actions">
                  <button type="button" :disabled="!microbiologyMistakeRecords.length || isLoading" @click="beginMicrobiologyMistakePractice">开始重练错题</button>
                  <button type="button" class="secondary-button" :disabled="!microbiologyMistakeRecords.length" @click="clearMicrobiologyMistakeRecords">清空</button>
                </div>
              </div>
            </div>
            <p v-if="!microbiologyMistakeRecords.length" class="microbiology-empty">错题本还是空的。答错或点击“不知道”后会自动加入。</p>
            <div v-else class="microbiology-record-list">
              <article v-for="record in microbiologyMistakeRecords" :key="record.sourceQuestionId" class="microbiology-record-card">
                <span>Chapter {{ record.categorySourceId }} · 错 {{ record.wrongCount }} 次</span>
                <h3>{{ record.prompt }}</h3>
                <p>上次选择：{{ record.lastAnswer?.selectedKey }}；正确答案：{{ record.correctDisplay }}</p>
                <button type="button" class="secondary-button" @click="removeMicrobiologyMistakeRecord(record.sourceQuestionId)">移除</button>
              </article>
            </div>
          </section>

          <section v-else-if="microbiologyPage === 'vocabulary'" class="microbiology-page-stack vocabulary-panel" aria-label="生词本">
            <div class="range-panel__head">
              <div>
                <span>生词本</span>
                <h2>微生物学本地生词</h2>
              </div>
              <p>{{ microbiologyVocabularyRecords.length }} 个词</p>
            </div>
            <div class="practice-actions">
              <button type="button" @click="vocabularyFilter = 'all'">全部</button>
              <button type="button" @click="vocabularyFilter = 'new'">未掌握</button>
              <button type="button" @click="vocabularyFilter = 'learning'">复习中</button>
              <button type="button" @click="vocabularyFilter = 'mastered'">已掌握</button>
              <button type="button" class="danger-button" @click="clearMicrobiologyVocabulary">清空</button>
            </div>
            <p v-if="!microbiologyVocabularyRecords.length" class="microbiology-empty">生词本还是空的。练习或真题里开启取词模式即可加入。</p>
            <div v-else class="vocabulary-list">
              <button
                v-for="record in microbiologyFilteredVocabularyRecords"
                :key="record.id"
                type="button"
                class="vocabulary-item"
                @click="cycleMicrobiologyVocabulary(record)"
              >
                <strong>{{ record.term }}</strong>
                <span>{{ record.status }}</span>
              </button>
            </div>
          </section>

          <section v-else-if="microbiologyPage === 'results'" class="microbiology-page-stack results-panel" aria-label="本轮结果">
            <div class="microbiology-hero">
              <span>Session summary</span>
              <h2>{{ session?.mode === 'mistakes' ? '错题本练习结果' : '本轮练习结果' }}</h2>
              <p>{{ microbiologyResultSummary.answered }} / {{ microbiologyResultSummary.total }} 已作答，正确率 {{ microbiologyResultSummary.accuracy }}%。</p>
              <div class="practice-actions">
                <button type="button" @click="beginMicrobiologyPractice">再练一次</button>
                <button type="button" class="secondary-button" @click="backToRangeSelection">返回章节</button>
                <button type="button" class="secondary-button" @click="microbiologyPage = 'mistakes'">打开错题本</button>
              </div>
            </div>
            <div class="result-stats">
              <strong>总题数 {{ microbiologyResultSummary.total }}</strong>
              <strong>已答 {{ microbiologyResultSummary.answered }}</strong>
              <strong>正确 {{ microbiologyResultSummary.correct }}</strong>
              <strong>错误 {{ microbiologyResultSummary.incorrect }}</strong>
              <strong>不知道 {{ microbiologyResultSummary.unknown }}</strong>
              <strong>未答 {{ microbiologyResultSummary.unanswered }}</strong>
            </div>
          </section>
        </QuizCourseShell>

        <QuizCourseShell
          v-else-if="quizView === 'molecular'"
          :page="molecularPage"
          :title="activeCourse?.name || '分子生物学'"
          :navigation-items="activeCourseConfig.navigationItems"
          :aria-label="activeCourseConfig.ariaLabel"
          @navigate="navigateMolecularPage"
          @back="backToCourseCatalog"
        >
          <section v-if="molecularPage === 'home'" class="molecular-page-stack" aria-label="分子生物学首页">
            <div class="molecular-hero">
              <span>{{ activeCourse?.code }}</span>
              <h2>ZJU 分子生物学刷题器</h2>
              <p>{{ activeCollection?.title || '题库正在读取' }}</p>
              <div class="practice-actions">
                <button type="button" @click="molecularPage = 'categories'">开始练习</button>
                <button v-if="session" type="button" class="secondary-button" @click="molecularPage = 'practice'">继续练习</button>
                <button type="button" class="secondary-button" @click="molecularPage = 'mistakes'">进入错题本</button>
              </div>
            </div>
            <div class="molecular-stat-grid">
              <div class="result-stats">
                <strong>总题数 {{ activeCollection?.questionCount || 0 }}</strong>
                <strong>题型数 {{ molecularCategoryGroups.length }}</strong>
                <strong>子分类 {{ categories.length }}</strong>
                <strong>错题 {{ molecularMistakeRecords.length }}</strong>
              </div>
            </div>
            <div class="molecular-feature-grid">
              <button
                v-for="group in molecularCategoryGroups"
                :key="group.id"
                type="button"
                class="range-card"
                @click="molecularPage = 'categories'"
              >
                <strong>{{ group.title }}</strong>
                <em>{{ group.categories.length }} 个小类</em>
                <span>{{ group.questionCount }} 题</span>
              </button>
            </div>
          </section>

          <section v-else-if="molecularPage === 'categories'" class="molecular-page-stack" aria-label="题型选择">
            <div class="range-panel__head">
              <div>
                <span>题型选择</span>
                <h2>{{ activeCourse?.name }}</h2>
              </div>
              <div class="molecular-category-summary">
                <p>已选 {{ selectedCategorySourceIds.length }} 类，{{ selectedQuestionCount }} 题</p>
                <div class="range-panel__actions">
                  <button type="button" class="secondary-button" @click="molecularPage = 'home'">返回首页</button>
                  <button type="button" :disabled="isLoading || !selectedQuestionCount" @click="beginPractice">进入练习</button>
                </div>
              </div>
            </div>
            <div class="molecular-category-stack">
              <section v-for="group in molecularCategoryGroups" :key="group.id" class="molecular-category-group">
                <div class="molecular-category-group__head">
                  <div>
                    <h3>{{ group.title }}</h3>
                    <p>{{ group.selectedCount }} / {{ group.categories.length }} 类，{{ group.questionCount }} 题</p>
                  </div>
                  <div class="practice-actions">
                    <button type="button" class="secondary-button" @click="selectAllInMolecularGroup(group)">全选 / 取消</button>
                    <button type="button" class="secondary-button" @click="clearMolecularGroup(group)">清空</button>
                    <button
                      v-if="group.id === 'translation'"
                      type="button"
                      class="secondary-button"
                      :disabled="!group.selectedCount || isLoading"
                      @click="startReviewMode"
                    >
                      复习
                    </button>
                  </div>
                </div>
                <div class="range-card-grid">
                  <button
                    v-for="category in group.categories"
                    :key="category.sourceId"
                    type="button"
                    class="range-card"
                    :class="{ 'is-selected': selectedCategorySourceIds.includes(category.sourceId) }"
                    @click="toggleCategorySourceId(category.sourceId)"
                  >
                    <strong>{{ category.title }}</strong>
                    <em v-if="category.parentTitle">{{ category.parentTitle }}</em>
                    <span>{{ category.questionCount }} 题</span>
                  </button>
                </div>
              </section>
            </div>
          </section>

          <QuizPracticeLayout
            v-else-if="molecularPage === 'practice'"
            :range-summaries="practiceRangeSummaries"
            :active-range-id="activePracticeRange?.id || ''"
            :question-tiles="activePracticeQuestionIndexes"
            :active-index="session?.currentIndex || 0"
            :active-range-title="activePracticeRange?.title || ''"
            :tile-status-by-source-question-id="questionTileStatusBySourceId"
            @select-range="selectPracticeRange"
            @move-question="moveQuestion"
          >

            <article v-if="activeQuestion" class="practice-question">
              <header class="practice-question__head">
                <button type="button" @click="backToRangeSelection">返回题型选择</button>
                <button type="button" class="danger-button" @click="exitPractice">退出练习</button>
                <span
                  v-if="activeQuestion.type !== 'translation'"
                  class="language-toggle"
                  aria-label="内容语言"
                >
                  <button type="button" :class="{ 'is-active': molecularLanguage === 'zh' }" @click="setMolecularLanguage('zh')">中</button>
                  <button type="button" :class="{ 'is-active': molecularLanguage === 'en' }" @click="setMolecularLanguage('en')">EN</button>
                </span>
                <span>{{ questionIndexText }}</span>
              </header>

              <h1 v-if="!vocabularyPickEnabled || activeQuestion.type === 'translation'">
                {{ displayedPrompt }}
              </h1>
              <h1 v-else class="vocabulary-pick-line">
                <button
                  v-for="(token, tokenIndex) in tokenizeVocabularyText(displayedPrompt)"
                  :key="`${token}-${tokenIndex}`"
                  type="button"
                  @click="addVocabularyTerm(token)"
                >
                  {{ token }}
                </button>
              </h1>
              <label v-if="activeQuestion.type !== 'translation'" class="vocabulary-picker-toggle">
                <input v-model="vocabularyPickEnabled" type="checkbox" />
                <span>取词</span>
              </label>
              <p v-if="vocabularyFeedback" class="vocabulary-feedback">{{ vocabularyFeedback }}</p>

              <ChoiceQuestionView
                v-if="['single_choice', 'multiple_choice'].includes(activeQuestion.type)"
                :options="activeQuestion.body.options"
                :selected-key="pendingSelectedKey"
                :result="result"
                :locked="Boolean(result) || currentQuestionLocked"
                :vocabulary-enabled="vocabularyPickEnabled"
                :option-text-resolver="activeOptionText"
                @select="chooseOption"
              />

              <TrueFalseQuestionView
                v-else-if="activeQuestion.type === 'true_false'"
                :selected-value="pendingTrueFalse"
                :locked="Boolean(result) || currentQuestionLocked"
                @select="chooseOption"
              />

              <TextAnswerQuestionView
                v-else-if="activeQuestion.type === 'translation'"
                ref="translationInput"
                :value="interaction.textAnswer"
                placeholder="输入答案"
                :locked="Boolean(result) || currentQuestionLocked"
                @input="updateTextValue"
                @submit="submitAnswer"
              />

              <textarea
                v-else-if="['short_answer', 'essay'].includes(activeQuestion.type)"
                class="practice-textarea"
                :value="interaction.textAnswer"
                placeholder="可以在这里打草稿，揭晓后自评"
                :disabled="currentQuestionLocked"
                @input="updateText"
              ></textarea>

              <div class="practice-actions">
                <button type="button" @click="moveQuestion('previous')">上一题</button>
                <button
                  v-if="['single_choice', 'multiple_choice', 'true_false', 'translation'].includes(activeQuestion.type)"
                  type="button"
                  :disabled="!canSubmitAnswer"
                  @click="submitAnswer"
                >
                  提交
                </button>
                <button v-else type="button" :disabled="Boolean(result)" @click="revealAnswer">查看答案</button>
                <button
                  v-if="['short_answer', 'essay'].includes(activeQuestion.type) && result && !activeQuestionStatus?.answer"
                  type="button"
                  @click="selfJudgeAnswer(true)"
                >
                  答对
                </button>
                <button
                  v-if="['short_answer', 'essay'].includes(activeQuestion.type) && result && !activeQuestionStatus?.answer"
                  type="button"
                  @click="selfJudgeAnswer(false)"
                >
                  答错
                </button>
                <button type="button" @click="moveToNextQuestion">下一题</button>
              </div>

              <MarkdownResultView
                v-if="result"
                :result="result"
                :explanation="displayedResultExplanation"
              />
            </article>
          </QuizPracticeLayout>

          <section v-else-if="molecularPage === 'mistakes'" class="molecular-page-stack" aria-label="错题本">
            <div class="range-panel__head">
              <div>
                <span>错题本</span>
                <h2>本地错题</h2>
              </div>
              <p>{{ molecularMistakeRecords.length }} 题</p>
            </div>
            <div class="practice-actions">
              <button type="button" :disabled="!molecularMistakeRecords.length || isLoading" @click="beginMistakePractice">开始错题练习</button>
              <button type="button" class="danger-button" :disabled="!molecularMistakeRecords.length" @click="clearMolecularMistakeRecords">清空</button>
            </div>
            <p v-if="!molecularMistakeRecords.length" class="molecular-empty">还没有错题。答错或自评错误后会自动加入这里。</p>
            <div v-else class="molecular-record-list">
              <article v-for="record in molecularMistakeRecords" :key="record.sourceQuestionId" class="molecular-record-card">
                <span>{{ record.categoryTitle || record.questionType }}</span>
                <h3>{{ record.prompt }}</h3>
                <p>错误次数 {{ record.wrongCount }}</p>
                <p v-if="record.correctDisplay">参考：{{ record.correctDisplay }}</p>
                <button type="button" class="secondary-button" @click="removeMolecularMistakeRecord(record.sourceQuestionId)">移除</button>
              </article>
            </div>
          </section>

          <section v-else-if="molecularPage === 'review'" class="molecular-page-stack practice-layout--review" aria-label="复习">
            <article v-if="currentReviewTerm" class="practice-question review-card">
              <header class="practice-question__head">
                <button type="button" @click="molecularPage = 'categories'">返回题型选择</button>
                <button type="button" @click="speakActiveReviewTerm">发音</button>
                <span>{{ molecularReviewIndex + 1 }} / {{ molecularReviewTerms.length }}</span>
              </header>
              <p class="practice-question__meta">{{ currentReviewTerm.categoryTitle }}</p>
              <h1>{{ currentReviewTerm.promptCn || currentReviewTerm.chineseMeaning }}</h1>
              <div v-if="molecularReviewShowAnswer" class="practice-result">
                <strong>{{ currentReviewTerm.answerTerm }}</strong>
                <p v-if="currentReviewTerm.answerFullTerm">{{ currentReviewTerm.answerFullTerm }}</p>
              </div>
              <div class="practice-actions">
                <button type="button" @click="moveReviewCard(-1)">上一张</button>
                <button type="button" @click="molecularReviewShowAnswer = true">显示答案</button>
                <button type="button" @click="moveReviewCard(1)">下一张</button>
              </div>
            </article>
            <p v-else class="molecular-empty">先在题型选择里选择中英互译分类，再进入复习。</p>
          </section>

          <section v-else-if="molecularPage === 'vocabulary'" class="molecular-page-stack vocabulary-panel" aria-label="生词本">
            <div class="range-panel__head">
              <div>
                <span>分子生物学</span>
                <h2>生词本</h2>
              </div>
              <p>{{ vocabularyRecords.length }} 个词</p>
            </div>
            <div class="practice-actions">
              <button type="button" @click="vocabularyFilter = 'all'">全部</button>
              <button type="button" @click="vocabularyFilter = 'new'">新词</button>
              <button type="button" @click="vocabularyFilter = 'learning'">学习中</button>
              <button type="button" @click="vocabularyFilter = 'mastered'">已掌握</button>
              <button type="button" @click="exportVocabulary">导出</button>
              <label class="secondary-button">
                导入
                <input type="file" accept="application/json" hidden @change="importVocabulary" />
              </label>
              <button type="button" class="danger-button" @click="clearVocabulary">清空</button>
            </div>
            <div class="vocabulary-list">
              <button
                v-for="record in filteredVocabularyRecords"
                :key="record.normalizedTerm"
                type="button"
                class="vocabulary-item"
                @click="cycleVocabulary(record)"
              >
                <strong>{{ record.term }}</strong>
                <span>{{ record.status }}</span>
              </button>
            </div>
          </section>

          <section v-else-if="molecularPage === 'results'" class="molecular-page-stack results-panel" aria-label="本轮结果">
            <div class="range-panel__head">
              <div>
                <span>本轮结果</span>
                <h2>{{ activeCourse?.name }}</h2>
              </div>
              <p>{{ resultSummary.answered }} / {{ resultSummary.total }}</p>
            </div>
            <div class="result-stats">
              <strong>正确 {{ resultSummary.correct }}</strong>
              <strong>错误 {{ resultSummary.incorrect }}</strong>
              <strong>未答 {{ resultSummary.unanswered }}</strong>
              <strong>自评正确 {{ resultSummary.selfJudgedCorrect }}</strong>
              <strong>自评错误 {{ resultSummary.selfJudgedIncorrect }}</strong>
            </div>
            <div class="practice-overview-list">
              <div v-for="(bucket, label) in resultSummary.byType" :key="label" class="practice-overview-row">
                <span>{{ label }}</span>
                <strong>{{ bucket.correct }} / {{ bucket.answered || bucket.total }}</strong>
              </div>
            </div>
            <div class="practice-actions">
              <button type="button" @click="molecularPage = 'practice'">返回练习</button>
              <button type="button" @click="beginPractice">再练一次</button>
              <button type="button" class="secondary-button" @click="molecularPage = 'categories'">返回题型选择</button>
              <button type="button" class="secondary-button" @click="molecularPage = 'mistakes'">查看错题本</button>
            </div>
          </section>
        </QuizCourseShell>

        <QuizCourseShell
          v-else-if="quizView === 'botany'"
          :page="botanyPage"
          :title="activeCourse?.name || '植物学切片识别'"
          :navigation-items="activeCourseConfig.navigationItems"
          :aria-label="activeCourseConfig.ariaLabel"
          @navigate="navigateBotanyPage"
          @back="backToCourseCatalog"
        >
          <section v-if="botanyPage === 'home'" class="botany-page-stack" aria-label="植物学首页">
            <div class="botany-hero">
              <span>{{ activeCourse?.code }}</span>
              <h2>植物学切片识别练习</h2>
              <p>通过观察植物器官显微镜切片图训练识别能力。</p>
              <div class="practice-actions">
                <button type="button" @click="botanyPage = 'categories'">开始选类</button>
                <button v-if="session" type="button" class="secondary-button" @click="botanyPage = 'practice'">继续练习</button>
                <button type="button" class="secondary-button" @click="botanyPage = 'mistakes'">查看错题本</button>
              </div>
            </div>
            <div class="result-stats">
              <strong>切片图 {{ activeCollection?.questionCount || 0 }}</strong>
              <strong>器官分类 {{ categories.length }}</strong>
              <strong>错题 {{ botanyMistakeRecords.length }}</strong>
              <strong>模式 看图揭晓</strong>
            </div>
            <div class="botany-feature-grid">
              <button
                v-for="category in categories"
                :key="category.sourceId"
                type="button"
                class="range-card"
                @click="botanyPage = 'categories'"
              >
                <strong>{{ category.title }}</strong>
                <em>切片识别</em>
                <span>{{ category.questionCount }} 张</span>
              </button>
            </div>
          </section>

          <section v-else-if="botanyPage === 'categories'" class="botany-page-stack" aria-label="分类选择">
            <div class="range-panel__head">
              <div>
                <span>分类</span>
                <h2>{{ activeCourse?.name }}</h2>
              </div>
              <div class="botany-category-summary">
                <p>已选 {{ selectedCategorySourceIds.length }} 类，{{ selectedBotanySliceCount }} 张</p>
                <div class="range-panel__actions">
                  <button type="button" class="secondary-button" @click="botanyPage = 'home'">返回首页</button>
                  <button type="button" :disabled="isLoading || !selectedBotanySliceCount" @click="beginBotanyPractice">开始练习</button>
                </div>
              </div>
            </div>

            <div class="practice-actions botany-toolbar">
              <button type="button" class="secondary-button" @click="selectAllBotanyCategories">全选</button>
              <button type="button" class="secondary-button" @click="clearBotanyCategories">清空</button>
            </div>

            <div class="range-card-grid">
              <button
                v-for="category in categories"
                :key="category.sourceId"
                type="button"
                class="range-card"
                :class="{ 'is-selected': selectedCategorySourceIds.includes(category.sourceId) }"
                @click="toggleCategorySourceId(category.sourceId)"
              >
                <strong>{{ category.title }}</strong>
                <em>植物学切片</em>
                <span>{{ category.questionCount }} 张</span>
              </button>
            </div>
          </section>

          <QuizPracticeLayout
            v-else-if="botanyPage === 'practice'"
            answered-label="揭晓 / 题数"
            :range-summaries="practiceRangeSummaries"
            :active-range-id="activePracticeRange?.id || ''"
            :question-tiles="activePracticeQuestionIndexes"
            :active-index="session?.currentIndex || 0"
            :active-range-title="activePracticeRange?.title || ''"
            :tile-status-by-source-question-id="questionTileStatusBySourceId"
            @select-range="selectPracticeRange"
            @move-question="moveQuestion"
          >

            <article v-if="activeQuestion" class="practice-question botany-question">
              <header class="practice-question__head">
                <button type="button" @click="backToRangeSelection">返回分类</button>
                <button type="button" class="danger-button" @click="exitPractice">退出练习</button>
                <span>{{ questionIndexText }}</span>
              </header>
              <p class="practice-question__meta">先观察切片图，再揭晓答案。</p>
              <ImageRevealQuestionView
                v-if="activeQuestion.type === 'image_reveal'"
                :image-src="imageUrl(activeQuestion.body.imagePath)"
                image-alt="植物学显微镜切片图"
                :result="result"
              />
              <div v-if="result" class="mistake-decision-panel">
                <p>{{ isBotanyMistake(activeQuestion.sourceQuestionId) ? '这道题已在错题本中。' : '如果觉得需要复习，可以加入错题本。' }}</p>
                <div class="practice-actions">
                  <button
                    v-if="isBotanyMistake(activeQuestion.sourceQuestionId)"
                    type="button"
                    class="secondary-button"
                    @click="removeBotanyMistakeRecord(activeQuestion.sourceQuestionId)"
                  >
                    从错题本移除
                  </button>
                  <button v-else type="button" class="secondary-button" @click="addActiveBotanyMistake">加入错题本</button>
                </div>
              </div>
              <div class="practice-actions">
                <button type="button" :disabled="session.currentIndex === 0" @click="moveQuestion('previous')">上一题</button>
                <button v-if="!result" type="button" @click="revealAnswer">揭晓答案</button>
                <button type="button" @click="moveToNextQuestion">
                  {{ session.currentIndex === session.questionOrder.length - 1 && result ? '查看结果' : '下一题' }}
                </button>
                <button type="button" class="secondary-button" @click="beginBotanyPractice">重新开始</button>
                <button type="button" class="secondary-button" @click="botanyPage = 'mistakes'">错题本</button>
              </div>
            </article>
          </QuizPracticeLayout>

          <section v-else-if="botanyPage === 'gallery'" class="botany-page-stack" aria-label="切片图库">
            <div class="range-panel__head">
              <div>
                <span>图库</span>
                <h2>切片图库</h2>
              </div>
              <p>{{ botanyGalleryItems.length }} 张切片</p>
            </div>
            <div class="practice-overview-list botany-gallery-tabs">
              <button
                v-for="group in botanyGalleryGroups"
                :key="group.id"
                type="button"
                class="practice-overview-row"
                :class="{ 'is-active': activeBotanyGalleryGroup?.id === group.id }"
                @click="botanyGalleryActiveCategory = group.id"
              >
                <span>{{ group.title }}</span>
                <strong>{{ group.items.length }} 张</strong>
              </button>
            </div>
            <div class="botany-gallery-grid">
              <article
                v-for="item in activeBotanyGalleryGroup?.items || []"
                :key="item.sourceQuestionId"
                class="botany-gallery-card"
              >
                <img :src="imageUrl(item.imagePath)" :alt="item.sourceName" loading="lazy" />
                <strong>{{ item.answer }}</strong>
                <span>{{ item.sourceName }}</span>
              </article>
            </div>
          </section>

          <section v-else-if="botanyPage === 'mistakes'" class="botany-page-stack" aria-label="错题本">
            <div class="range-panel__head">
              <div>
                <span>错题本</span>
                <h2>本地错题</h2>
              </div>
              <div class="botany-category-summary">
                <p>{{ botanyMistakeRecords.length }} 题</p>
                <div class="range-panel__actions">
                  <button type="button" :disabled="!botanyMistakeRecords.length || isLoading" @click="beginBotanyMistakePractice">开始重练错题</button>
                  <button type="button" class="secondary-button" :disabled="!botanyMistakeRecords.length" @click="clearBotanyMistakeRecords">清空</button>
                </div>
              </div>
            </div>
            <p v-if="!botanyMistakeRecords.length" class="botany-empty">错题本还是空的。练习时揭晓答案后可以手动加入。</p>
            <div v-else class="botany-gallery-grid">
              <article v-for="record in botanyMistakeRecords" :key="record.sourceQuestionId" class="botany-gallery-card">
                <img :src="imageUrl(record.imagePath)" :alt="record.sourceName" loading="lazy" />
                <strong>{{ record.answer }}</strong>
                <span>标记了 {{ record.addedCount }} 次</span>
                <button type="button" class="secondary-button" @click="removeBotanyMistakeRecord(record.sourceQuestionId)">从错题本移除</button>
              </article>
            </div>
          </section>

          <section v-else-if="botanyPage === 'results'" class="botany-page-stack results-panel" aria-label="本轮结果">
            <div class="botany-hero">
              <span>Session summary</span>
              <h2>{{ session?.mode === 'mistakes' ? '错题本练习结果' : '本轮练习结果' }}</h2>
              <p>{{ session?.mode === 'mistakes' ? '错题是否移除由你在答题时手动决定。' : '揭晓后手动加入错题本的切片图已记录，可继续重练。' }}</p>
              <div class="practice-actions">
                <button type="button" @click="beginBotanyPractice">再来一次</button>
                <button type="button" class="secondary-button" @click="backToRangeSelection">返回分类</button>
                <button type="button" class="secondary-button" @click="botanyPage = 'mistakes'">打开错题本</button>
              </div>
            </div>
            <div class="result-stats">
              <strong>总切片数 {{ botanyResultSummary.total }}</strong>
              <strong>已揭晓 {{ botanyResultSummary.revealed }}</strong>
              <strong>未揭晓 {{ botanyResultSummary.remaining }}</strong>
              <strong>错题本 {{ botanyResultSummary.mistakes }}</strong>
            </div>
            <div class="practice-overview-list">
              <div v-for="option in selectedPracticeRangeOptions" :key="option.id" class="practice-overview-row">
                <span>{{ option.title }}</span>
                <strong>{{ option.questionCount }} 张</strong>
              </div>
            </div>
          </section>
        </QuizCourseShell>

          <p v-if="message" class="demo-message">{{ message }}</p>
      </section>
    </main>
  </div>
</template>
