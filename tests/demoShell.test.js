import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('demo shell exposes the requested top-level pages and sparse home search', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const data = await readFile(new URL('../src/data/quizDemo.js', import.meta.url), 'utf8');

  for (const label of ['首页', '概览', '刷题', '关于']) {
    assert.match(data, new RegExp(`label: '${label}'`));
  }

  assert.match(app, /class="demo-search"/);
  assert.match(app, /placeholder="搜索课程、题库或关键词"/);
  assert.match(app, /getDemoPageHref/);
  assert.match(app, /getDemoPageFromHash/);
  assert.match(app, /MarkdownResultView/);
  assert.match(app, /:href="getDemoPageHref\(page\.id\)"/);
  assert.match(app, /resetPageState\(pageId\)/);
});

test('quiz page is a course entry and molecular biology opens a seven-page subapp', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const data = await readFile(new URL('../src/data/quizDemo.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/demo.css', import.meta.url), 'utf8');
  const practiceLayout = await readFile(new URL('../src/components/quiz/QuizPracticeLayout.vue', import.meta.url), 'utf8');

  assert.match(app, /activeCourseTab/);
  assert.match(app, /支持课程/);
  assert.match(app, /待做课程/);
  assert.match(data, /动物学及实验（甲）/);
  assert.match(app, /v-if="activeCourseTab === 'supported'"/);
  assert.match(app, /v-else-if="activeCourseTab === 'pending'"/);
  assert.match(app, /class="quiz-course-grid"/);
  assert.match(css, /\.quiz-course-grid\s*\{[\s\S]*?repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(app, /class="quiz-right-rail"/);

  assert.match(app, /quizView === 'catalog'/);
  assert.match(app, /quizView === 'molecular'/);
  assert.match(app, /QuizCourseShell/);
  assert.match(app, /QuizPracticeLayout/);
  for (const label of ['首页', '题型选择', '练习', '错题本', '复习', '生词本', '结果']) {
    assert.match(app, new RegExp(label));
  }
  assert.doesNotMatch(app, /先选择本次练习范围/);
  assert.doesNotMatch(app, /不同课程可以按章节、真题、题型或切片类别组织/);
  assert.doesNotMatch(app, /<button type="button" class="is-active">概览<\/button>/);
  assert.doesNotMatch(app, /<button type="button" class="is-active">题目列表<\/button>/);
  assert.match(practiceLayout, /class="question-jump-grid"/);
  assert.match(app, /practiceRangeSummaries/);
  assert.doesNotMatch(app, /questionIndexBySourceId/);
  assert.match(app, /buildPracticeQuestionTiles/);
  assert.match(practiceLayout, /localNumber/);
  assert.match(practiceLayout, /题目总览/);
  assert.match(practiceLayout, /作答 \/ 题数/);
  assert.match(practiceLayout, /class="practice-overview-list"/);
  assert.match(practiceLayout, /class="practice-question-panel"/);
  assert.match(practiceLayout, /class="question-grid-cell"/);
  assert.match(css, /\.quiz-course-app/);
  assert.match(css, /\.quiz-course-nav/);
  assert.match(app, /moveToNextQuestion/);
  assert.doesNotMatch(app, /@click="moveQuestion\('next'\)"/);
  assert.match(app, /退出练习/);
  assert.match(app, /activeQuestion/);
  assert.match(app, /buildQuizRangeOptions/);
  assert.doesNotMatch(app, /getQuestionCategorySourceId/);
  assert.match(app, /range-card-grid/);
  assert.match(app, /questionTileStatusBySourceId/);
  assert.match(app, /answeredQuestionStatus/);
  assert.match(css, /\.question-grid-cell\s*\{[\s\S]*?inline-size:\s*48px/);
  assert.match(css, /\.question-grid-cell\s*\{[\s\S]*?block-size:\s*48px/);
  assert.match(css, /\.question-grid-cell\.is-correct/);
  assert.match(css, /\.question-grid-cell\.is-incorrect/);
  assert.doesNotMatch(app, /limit:\s*30/);
  assert.doesNotMatch(app, /shuffle:\s*true/);
});

test('molecular practice view keeps question navigation inside practice and hides raw source ids', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');

  const practiceStart = app.indexOf('molecularPage === \'practice\'');
  assert.notEqual(practiceStart, -1);
  const practiceTemplate = app.slice(practiceStart);

  assert.doesNotMatch(practiceTemplate, /class="quiz-left-nav"/);
  assert.doesNotMatch(practiceTemplate, /selectedRangeTitle/);
  assert.doesNotMatch(practiceTemplate, /本轮合计/);
  assert.doesNotMatch(practiceTemplate, /index \+ 1/);
  assert.doesNotMatch(practiceTemplate, /概览/);
  assert.doesNotMatch(practiceTemplate, /题目列表/);
  assert.match(practiceTemplate, /退出练习/);
  assert.match(practiceTemplate, /返回题型选择/);
  assert.doesNotMatch(practiceTemplate, /activeQuestion\.type }} · {{ activeQuestion\.sourceQuestionId/);
  assert.match(practiceTemplate, /activeQuestion\.type !== 'translation'[\s\S]*?language-toggle/);
});

test('botany slice course opens a full-width six-page subapp without family/about pages', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/demo.css', import.meta.url), 'utf8');
  const shellComponent = await readFile(new URL('../src/components/quiz/QuizCourseShell.vue', import.meta.url), 'utf8');

  assert.match(app, /quizView === 'botany'/);
  assert.match(app, /QuizCourseShell/);
  assert.match(app, /botanyPage === 'home'/);
  assert.match(app, /botanyPage === 'categories'/);
  assert.match(app, /botanyPage === 'practice'/);
  assert.match(app, /botanyPage === 'gallery'/);
  assert.match(app, /botanyPage === 'mistakes'/);
  assert.match(app, /botanyPage === 'results'/);

  const botanyShell = app.slice(app.indexOf('quizView === \'botany\''));
  for (const label of ['首页', '分类', '练习', '图库', '错题本', '结果']) {
    assert.match(botanyShell, new RegExp(label));
  }
  assert.doesNotMatch(botanyShell, /科属/);
  assert.doesNotMatch(botanyShell, /关于/);
  assert.doesNotMatch(botanyShell, /已答 \{\{/);
  assert.doesNotMatch(botanyShell, /生词/);

  assert.match(css, /\.quiz-course-app\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(css, /\.quiz-course-content\s*\{[\s\S]*?width:\s*100%/);
  assert.match(app, /已选 \{\{ selectedCategorySourceIds\.length \}\} 类，\{\{ selectedBotanySliceCount \}\} 张/);
  assert.match(app, /返回首页[\s\S]*?开始练习/);
  assert.match(app, /botanyPage = 'categories'[\s\S]*?beginBotanyPractice/);
  assert.doesNotMatch(app, /重新乱序开始/);
});

test('microbiology course opens a full-width seven-page subapp without about page', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/demo.css', import.meta.url), 'utf8');
  const shellComponent = await readFile(new URL('../src/components/quiz/QuizCourseShell.vue', import.meta.url), 'utf8');

  assert.match(app, /quizView === 'microbiology'/);
  assert.match(app, /QuizCourseShell/);
  assert.match(app, /microbiologyPage === 'home'/);
  assert.match(app, /microbiologyPage === 'categories'/);
  assert.match(app, /microbiologyPage === 'pastExams'/);
  assert.match(app, /microbiologyPage === 'practice'/);
  assert.match(app, /microbiologyPage === 'mistakes'/);
  assert.match(app, /microbiologyPage === 'vocabulary'/);
  assert.match(app, /microbiologyPage === 'results'/);

  const microbiologyShell = app.slice(app.indexOf('quizView === \'microbiology\''));
  for (const label of ['首页', '章节', '真题', '练习', '错题本', '生词本', '结果']) {
    assert.match(microbiologyShell, new RegExp(label));
  }
  assert.doesNotMatch(microbiologyShell, /关于/);
  assert.doesNotMatch(shellComponent, /已答 \{\{/);

  assert.match(css, /\.quiz-course-app\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(css, /\.quiz-course-content\s*\{[\s\S]*?width:\s*100%/);
  assert.match(app, /已选 \{\{ selectedCategorySourceIds\.length \}\} 章，\{\{ selectedMicrobiologyCount \}\} 题/);
  assert.match(app, /返回首页[\s\S]*?开始练习/);
  assert.match(app, /microbiologyPage = 'categories'[\s\S]*?beginMicrobiologyPractice/);
  assert.doesNotMatch(app, /重新乱序开始/);
});

test('quiz option and markdown rendering styles stay shared across course subapps', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/demo.css', import.meta.url), 'utf8');

  const choiceComponent = await readFile(new URL('../src/components/quiz/ChoiceQuestionView.vue', import.meta.url), 'utf8');
  const markdownComponent = await readFile(new URL('../src/components/quiz/MarkdownResultView.vue', import.meta.url), 'utf8');

  assert.match(app, /ChoiceQuestionView/);
  assert.match(app, /TrueFalseQuestionView/);
  assert.match(app, /TextAnswerQuestionView/);
  assert.match(app, /ImageRevealQuestionView/);
  assert.match(choiceComponent, /class="practice-options"/);
  assert.match(choiceComponent, /buildOptionStateClass/);
  assert.match(css, /\.practice-options,\s*[\r\n]+\.option-list/);
  assert.match(css, /\.practice-options button,\s*[\r\n]+\.option-button/);
  assert.match(css, /\.practice-options button\.is-correct,\s*[\r\n]+\.option-button\.is-correct/);
  assert.match(css, /\.practice-options button\.is-incorrect,\s*[\r\n]+\.option-button\.is-incorrect/);

  assert.doesNotMatch(app, /v-html|innerHTML/);
  assert.doesNotMatch(markdownComponent, /v-html|innerHTML/);
  assert.match(app, /MarkdownResultView/);
  assert.match(markdownComponent, /buildAnswerMarkdownBlocks/);
  assert.match(markdownComponent, /parseMarkdownAnswer/);
  assert.match(markdownComponent, /v-if="answerBlocks\.length" class="markdown-answer"/);
  assert.match(markdownComponent, /v-if="explanationBlocks\.length" class="markdown-answer"/);
});

test('course subapps use the shared shell and practice layout instead of course-specific shells', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');

  assert.match(app, /quizCourseConfigs/);
  assert.match(app, /QuizCourseShell/);
  assert.match(app, /QuizPracticeLayout/);
  assert.doesNotMatch(app, /MolecularQuizApp/);
  assert.doesNotMatch(app, /BotanyQuizApp/);
  assert.doesNotMatch(app, /MicrobiologyQuizApp/);
});
