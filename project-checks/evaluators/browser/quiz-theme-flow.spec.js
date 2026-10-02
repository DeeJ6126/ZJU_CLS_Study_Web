import { expect, test } from '@playwright/test';

// Synthetic questions exercise UI states; no real bank answers or backend writes are used.
const guest = { id: 'guest', role: 'guest', nickname: '游客', verifications: { email: false } };
const options = [
  { key: 'A', text: '选项甲', textCn: '选项甲', textEn: 'Alpha option' },
  { key: 'B', text: '选项乙', textCn: '选项乙', textEn: 'Beta option' },
  { key: 'C', text: '选项丙', textCn: '选项丙', textEn: 'Gamma option' },
  { key: 'D', text: '选项丁', textCn: '选项丁', textEn: 'Delta option' },
];
const sliceImage = 'assets/images/茎/黄杨茎尖4X-1.jpg';
const fixtures = {
  BIO2023M: {
    slug: 'molecular-biology-review',
    title: '分子生物学',
    categories: [
      { sourceId: 'choice', title: '基础选择', type: 'multiple_choice', questionCount: 1 },
      { sourceId: 'judgement', title: '基础判断', type: 'true_false', questionCount: 1 },
      { sourceId: 'translation', title: '基础术语', parentTitle: '中英名词互译', type: 'translation', questionCount: 1 },
      { sourceId: 'short', title: '基础简答', type: 'short_answer', questionCount: 1 },
      { sourceId: 'essay', title: '基础论述', type: 'essay', questionCount: 1 },
    ],
    questions: [
      { sourceQuestionId: 'theme-molecular-choice', categorySourceId: 'choice', type: 'multiple_choice', prompt: 'DNA replication practice', body: { promptCn: 'DNA 分子选择练习', options } },
      { sourceQuestionId: 'theme-molecular-tf', categorySourceId: 'judgement', type: 'true_false', prompt: 'DNA judgement practice', body: { promptCn: 'DNA 判断练习' } },
      { sourceQuestionId: 'theme-molecular-translation', categorySourceId: 'translation', type: 'translation', prompt: '脱氧核糖核酸', body: { promptCn: '脱氧核糖核酸' } },
      { sourceQuestionId: 'theme-molecular-short', categorySourceId: 'short', type: 'short_answer', prompt: '简答练习：说明观察结果。', body: {} },
      { sourceQuestionId: 'theme-molecular-essay', categorySourceId: 'essay', type: 'essay', prompt: '论述练习：比较两个结果。', body: {} },
    ],
  },
  BIO2019F: {
    slug: 'botany-slice',
    title: '植物学',
    categories: [{ sourceId: '茎', title: '茎', type: 'image_reveal', questionCount: 2 }],
    questions: [1, 2].map((number) => ({
      sourceQuestionId: `theme-botany-${number}`, categorySourceId: '茎', type: 'image_reveal',
      prompt: '观察植物切片', body: { imagePath: sliceImage, sourceName: `切片练习 ${number}` },
    })),
  },
  BIO2110F: {
    slug: 'microbiology-final-review',
    title: '微生物学',
    categories: [{ sourceId: '1', title: '微生物基础', type: 'chapter', questionCount: 2 }],
    questions: [1, 2].map((number) => ({
      sourceQuestionId: `theme-micro-${number}`, categorySourceId: '1', type: 'multiple_choice',
      prompt: `DNA replication 微生物练习 ${number}`, body: { chapterId: '1', number, options },
    })),
  },
};
const palettes = {
  light: { ground: 'rgb(245, 248, 249)', surface: 'rgb(255, 255, 255)', ink: 'rgb(33, 49, 57)', primary: 'rgb(20, 118, 138)' },
  dark: { ground: 'rgb(23, 28, 30)', surface: 'rgb(34, 41, 44)', ink: 'rgb(241, 245, 246)', primary: 'rgb(132, 203, 218)' },
};

async function mockQuizApi(page) {
  const sessions = new Map();
  const unexpected = [];
  const operations = [];
  let sequence = 0;
  const bySlug = (slug) => Object.values(fixtures).find((fixture) => fixture.slug === slug);
  function sessionView(session) {
    return {
      id: session.id, collectionSlug: session.fixture.slug, mode: session.mode,
      selectedCategorySourceIds: session.selectedCategorySourceIds,
      questionOrder: session.questions.map((question) => question.sourceQuestionId),
      questionIndex: session.questions.map((question, index) => ({ sourceQuestionId: question.sourceQuestionId, categorySourceId: question.categorySourceId, index, localNumber: index + 1 })),
      currentIndex: session.currentIndex,
      currentQuestion: session.questions[session.currentIndex],
      answerStatusBySourceQuestionId: session.statuses,
      startedAt: '2026-10-02T00:00:00.000Z',
    };
  }
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/zjubio/, '');
    const method = request.method();
    const data = method === 'GET' ? {} : request.postDataJSON() ?? {};
    operations.push({ path, method });
    let payload;
    if (path === '/api/auth/me') payload = { user: guest };
    else if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    else if (path === '/api/activities') payload = { activities: [] };
    else if (path === '/api/student-homepages') payload = { homepages: [] };
    else if (path === '/api/courses') payload = { courses: [] };
    else if (path === '/api/quiz/recent') payload = { recent: null };
    else if (path === '/api/quiz/account-state') payload = { state: { progress: null, mistakes: [], vocabulary: [] } };
    else if (path === '/api/quiz/collections') {
      const code = url.searchParams.get('courseCode');
      const fixture = fixtures[code];
      payload = { collections: fixture ? [{ courseCode: code, slug: fixture.slug, title: fixture.title, questionCount: fixture.questions.length }] : [] };
    } else if (/^\/api\/quiz\/collections\/[^/]+\/categories$/.test(path)) {
      payload = { categories: bySlug(path.split('/')[4])?.categories ?? [] };
    } else if (path.endsWith('/review-terms')) {
      payload = { terms: [
        { sourceQuestionId: 'theme-term-1', categoryTitle: '基础术语', promptCn: '脱氧核糖核酸', answerTerm: 'DNA', answerFullTerm: 'Deoxyribonucleic acid' },
        { sourceQuestionId: 'theme-term-2', categoryTitle: '基础术语', promptCn: '核糖核酸', answerTerm: 'RNA', answerFullTerm: 'Ribonucleic acid' },
      ] };
    } else if (path.endsWith('/image-gallery')) {
      payload = { items: [1, 2].map((number) => ({ sourceQuestionId: `theme-botany-${number}`, categorySourceId: '茎', categoryTitle: '茎', imagePath: sliceImage, sourceName: `切片练习 ${number}`, answer: '茎切片' })) };
    } else if (path.endsWith('/past-exams')) {
      payload = { exams: [{ examId: 'theme-exam', title: '期末练习卷', sourcePdf: '练习卷.pdf', questionCount: 2 }] };
    } else if (path.endsWith('/past-exams/theme-exam/questions')) {
      payload = { questions: [1, 2].map((number) => ({ number, prompt: `DNA replication 真题练习 ${number}`, options })) };
    } else if (path.endsWith('/past-exams/theme-exam/answers')) {
      payload = { result: { questionNumber: data.questionNumber, selectedKey: data.selectedKey, correctKey: 'A', isCorrect: data.selectedKey === 'A', explanation: { explanation: '这是用于界面测试的参考说明。' } } };
    } else if (path === '/api/quiz/sessions' && method === 'POST') {
      const fixture = bySlug(data.collectionSlug);
      const questions = fixture?.questions.filter((question) => data.sourceQuestionIds?.length
        ? data.sourceQuestionIds.includes(question.sourceQuestionId)
        : !data.categorySourceIds?.length || data.categorySourceIds.includes(question.categorySourceId)) ?? [];
      if (!questions.length) {
        unexpected.push(`Empty session: ${JSON.stringify(data)}`);
        await route.fulfill({ status: 400, json: { message: '测试范围为空' } });
        return;
      }
      const id = `quiz_${String(++sequence).padStart(32, 'a')}`;
      const session = { id, fixture, questions, selectedCategorySourceIds: [...new Set(questions.map((question) => question.categorySourceId))], currentIndex: 0, statuses: {}, mode: data.mode || 'categories' };
      sessions.set(id, session);
      payload = { session: sessionView(session) };
    } else if (/^\/api\/quiz\/sessions\/[^/]+(?:\/[^/]+)?$/.test(path)) {
      const [, , , , id, action] = path.split('/');
      const session = sessions.get(id);
      if (session && action === 'navigation') {
        session.currentIndex = Number.isInteger(data.currentIndex)
          ? Math.max(0, Math.min(data.currentIndex, session.questions.length - 1))
          : Math.max(0, Math.min(session.currentIndex + (data.direction === 'previous' ? -1 : 1), session.questions.length - 1));
        payload = { session: sessionView(session) };
      } else if (session && ['answers', 'reveals', 'self-judgements'].includes(action)) {
        const question = session.questions.find((item) => item.sourceQuestionId === data.sourceQuestionId);
        const correctDisplay = question.type === 'translation' ? 'DNA' : question.type === 'true_false' ? 'T' : question.type === 'image_reveal' ? '茎切片' : ['short_answer', 'essay'].includes(question.type) ? '### 参考要点\n- 比较观察结果\n- 保留证据边界' : 'A';
        const isCorrect = action === 'reveals' ? null : action === 'self-judgements' ? data.isCorrect
          : question.type === 'translation' ? data.answer?.text === 'DNA'
            : question.type === 'true_false' ? data.answer?.value === true : data.answer?.selectedKey === 'A';
        const revealedAnswer = question.type === 'image_reveal' ? { answer: '茎切片', sourceName: question.body.sourceName }
          : { referenceAnswer: correctDisplay };
        const result = { isCorrect, correctDisplay, gradingMode: action === 'reveals' ? 'reveal' : 'automatic', explanation: '这是用于界面测试的参考说明。', answer: revealedAnswer, revealedAnswer, nextIndex: Math.min(session.currentIndex + 1, session.questions.length - 1) };
        session.statuses[question.sourceQuestionId] = { ...result, answer: action === 'reveals' ? undefined : data.answer ?? { selfJudgedCorrect: data.isCorrect }, revealed: action === 'reveals' };
        payload = { result };
      } else if (session && !action) payload = { session: sessionView(session) };
    }
    if (!payload) {
      unexpected.push(`${method} ${path}`);
      await route.fulfill({ status: 500, json: { message: '未定义的测试请求' } });
      return;
    }
    await route.fulfill({ status: 200, json: payload });
  });
  return { unexpected, operations };
}

async function checkSurface(page, theme, selector = '.quiz-course-content') {
  await expect(page.locator(selector)).toBeVisible();
  const measurements = await page.evaluate((selector) => {
    const root = getComputedStyle(document.documentElement);
    const shell = getComputedStyle(document.querySelector('.demo-shell'));
    const surface = getComputedStyle(document.querySelector(selector));
    const header = document.querySelector('.demo-head').getBoundingClientRect();
    return {
      theme: document.documentElement.dataset.theme,
      primary: root.getPropertyValue('--color-primary').trim(),
      ground: shell.backgroundColor, ink: shell.color,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      headerHeight: header.height, contentWidth: document.querySelector(selector).getBoundingClientRect().width,
      font: surface.fontFamily,
    };
  }, selector);
  expect(measurements.theme).toBe(theme);
  expect(measurements.primary).toBe(palettes[theme].primary);
  expect(measurements.ground).toBe(palettes[theme].ground);
  expect(measurements.ink).toBe(palettes[theme].ink);
  expect(measurements.overflow).toBe(false);
  expect(measurements.headerHeight).toBe(76);
  expect(measurements.contentWidth).toBeGreaterThan(700);
  expect(measurements.font).toContain('Outfit');
}

async function screenshot(page, courseCode, theme, state) {
  await page.screenshot({ path: `project-checks/artifacts/quiz-theme/${courseCode}-${theme}-${state}.png`, fullPage: true, animations: 'disabled' });
}

async function checkFeedbackColors(page) {
  const colors = await page.evaluate(() => {
    const variables = getComputedStyle(document.documentElement);
    const correct = getComputedStyle(document.querySelector('.practice-options button.is-correct'));
    const incorrect = getComputedStyle(document.querySelector('.practice-options button.is-incorrect'));
    return { positive: variables.getPropertyValue('--color-positive').trim(), negative: variables.getPropertyValue('--color-negative').trim(), correct: correct.color, incorrect: incorrect.color, correctOpacity: correct.opacity, incorrectOpacity: incorrect.opacity };
  });
  expect(colors.correct).toBe(colors.positive);
  expect(colors.incorrect).toBe(colors.negative);
  expect(colors.correctOpacity).toBe('1');
  expect(colors.incorrectOpacity).toBe('1');
}

async function checkImage(image) {
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 100 && element.naturalHeight > 100), { timeout: 15_000 }).toBe(true);
  const bounds = await image.boundingBox();
  expect(bounds.width).toBeGreaterThan(100);
  expect(bounds.height).toBeGreaterThan(100);
}

async function molecularFlow(page, theme) {
  await page.locator('.quiz-course-nav').getByRole('button', { name: '题型选择', exact: true }).click();
  await expect(page.locator('.range-card')).toHaveCount(5);
  for (const card of await page.locator('.range-card').all()) await card.click();
  await expect(page.getByRole('button', { name: '进入练习', exact: true })).toBeEnabled();
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2023M', theme, 'categories');
  await page.getByRole('button', { name: '进入练习', exact: true }).click();
  await expect(page.locator('.practice-question h1')).toContainText('DNA');
  await page.locator('.language-toggle').getByRole('button', { name: 'EN', exact: true }).click();
  await page.locator('.vocabulary-picker-toggle input').check();
  await page.locator('.vocabulary-pick-line').getByRole('button', { name: 'replication', exact: true }).click();
  await expect(page.locator('.vocabulary-feedback')).toContainText('已加入');
  await page.locator('.vocabulary-picker-toggle input').uncheck();
  await page.locator('.vocabulary-picker-toggle input').blur();
  await page.keyboard.press('b');
  await expect(page.locator('.practice-options button.is-selected')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.practice-result')).toContainText('答案错误');
  await checkFeedbackColors(page);
  await expect(page.locator('.question-grid-cell.is-active')).toHaveClass(/is-incorrect/);
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2023M', theme, 'feedback');
  await page.keyboard.press('Space');
  await expect(page.locator('.practice-options--tf')).toBeVisible();
  await page.keyboard.press('t');
  await page.keyboard.press('Enter');
  await expect(page.locator('.practice-result')).toContainText('答案正确');
  await page.keyboard.press('Space');
  const translation = page.locator('.practice-textarea');
  await expect(translation).toBeFocused();
  await translation.fill('DNA');
  await translation.press('Enter');
  await expect(page.locator('.practice-result')).toContainText('答案正确');
  await expect(translation).toBeDisabled();
  await page.locator('.practice-actions').getByRole('button', { name: '下一题', exact: true }).click();
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await expect(page.locator('.markdown-answer h4')).toContainText('参考要点');
  await expect(page.locator('.markdown-answer li')).toHaveCount(2);
  await page.getByRole('button', { name: '答对', exact: true }).click();
  await expect(page.locator('.practice-result')).toContainText('答案正确');
  await page.locator('.practice-actions').getByRole('button', { name: '下一题', exact: true }).click();
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await page.getByRole('button', { name: '答错', exact: true }).click();
  await expect(page.locator('.practice-result')).toContainText('答案错误');
  await page.locator('.practice-actions').getByRole('button', { name: '下一题', exact: true }).click();
  await expect(page.locator('.results-panel')).toBeVisible();
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2023M', theme, 'results');
  await page.locator('.quiz-course-nav').getByRole('button', { name: '错题本', exact: true }).click();
  await expect(page.locator('.molecular-record-card')).toHaveCount(2);
  await page.locator('.quiz-course-nav').getByRole('button', { name: '生词本', exact: true }).click();
  await expect(page.locator('.vocabulary-item')).toHaveCount(1);
  await expect(page.locator('.vocabulary-item')).toContainText('replication');
  await page.locator('.vocabulary-item').click();
  await expect(page.locator('.vocabulary-item')).toContainText('learning');
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2023M', theme, 'vocabulary');
  await page.locator('.quiz-course-nav').getByRole('button', { name: '题型选择', exact: true }).click();
  await page.locator('.molecular-category-group').filter({ hasText: '基础术语' }).getByRole('button', { name: '复习', exact: true }).click();
  await expect(page.locator('.review-card h1')).toContainText('脱氧核糖核酸');
  await page.keyboard.press('Enter');
  await expect(page.locator('.practice-result')).toContainText('Deoxyribonucleic acid');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.review-card h1')).toContainText('核糖核酸');
  await expect(page.locator('.practice-result')).toHaveCount(0);
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2023M', theme, 'review');
}

async function botanyFlow(page, theme) {
  await page.locator('.quiz-course-nav').getByRole('button', { name: '分类', exact: true }).click();
  await expect(page.locator('.range-card')).toHaveCount(1);
  await page.locator('.range-card').click();
  await checkSurface(page, theme);
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await checkImage(page.locator('.botany-slice-image'));
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.practice-question__head')).toContainText('2 / 2');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.practice-question__head')).toContainText('1 / 2');
  await page.keyboard.press('Enter');
  await expect(page.locator('.practice-result')).toContainText('茎切片');
  await page.getByRole('button', { name: '加入错题本', exact: true }).click();
  await expect(page.getByRole('button', { name: '从错题本移除', exact: true })).toBeVisible();
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2019F', theme, 'practice');
  await page.keyboard.press('Space');
  await expect(page.locator('.practice-question__head')).toContainText('2 / 2');
  await expect(page.locator('.practice-result')).toContainText('等待揭晓');
  await page.keyboard.press('Enter');
  await expect(page.locator('.practice-result')).toContainText('茎切片');
  await page.keyboard.press('Space');
  await expect(page.locator('.results-panel')).toBeVisible();
  await checkSurface(page, theme);
  await page.locator('.quiz-course-nav').getByRole('button', { name: '错题本', exact: true }).click();
  await expect(page.locator('.botany-gallery-card')).toHaveCount(1);
  await checkImage(page.locator('.botany-gallery-card img'));
  await page.locator('.quiz-course-nav').getByRole('button', { name: '图库', exact: true }).click();
  await expect(page.locator('.botany-gallery-card')).toHaveCount(2);
  for (const image of await page.locator('.botany-gallery-card img').all()) await checkImage(image);
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2019F', theme, 'gallery');
}

async function microbiologyFlow(page, theme) {
  await page.locator('.quiz-course-nav').getByRole('button', { name: '章节', exact: true }).click();
  await expect(page.locator('.range-card')).toHaveCount(1);
  await page.locator('.range-card').click();
  await checkSurface(page, theme);
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.locator('.practice-question h1')).toContainText('微生物练习 1');
  await page.getByRole('button', { name: '取词模式', exact: true }).click();
  await page.locator('.vocabulary-token-row').getByRole('button', { name: 'replication', exact: true }).click();
  await expect(page.locator('.vocabulary-confirm')).toContainText('已加入');
  await page.getByRole('button', { name: '退出取词', exact: true }).click();
  await page.keyboard.press('b');
  await page.keyboard.press('Enter');
  await expect(page.locator('.practice-result')).toContainText('回答错误');
  await checkFeedbackColors(page);
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2110F', theme, 'feedback');
  await page.keyboard.press('Space');
  await expect(page.locator('.practice-question h1')).toContainText('微生物练习 2');
  await page.keyboard.press('u');
  await expect(page.locator('.practice-result')).toContainText('回答错误');
  await page.keyboard.press('Space');
  await expect(page.locator('.results-panel')).toBeVisible();
  await checkSurface(page, theme);
  await page.locator('.quiz-course-nav').getByRole('button', { name: '错题本', exact: true }).click();
  await expect(page.locator('.microbiology-record-card')).toHaveCount(2);
  await page.locator('.quiz-course-nav').getByRole('button', { name: '生词本', exact: true }).click();
  await expect(page.locator('.vocabulary-item')).toHaveCount(1);
  await page.locator('.vocabulary-item').click();
  await expect(page.locator('.vocabulary-item')).toContainText('learning');
  await checkSurface(page, theme);
  await page.locator('.quiz-course-nav').getByRole('button', { name: '真题', exact: true }).click();
  await expect(page.locator('.microbiology-record-card')).toContainText('期末练习卷');
  await page.locator('.microbiology-record-card').getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(page.locator('.practice-question h1')).toContainText('真题练习 1');
  await page.locator('.practice-options button').filter({ hasText: '选项乙' }).click();
  await expect(page.locator('.practice-result')).toContainText('回答错误');
  await checkFeedbackColors(page);
  await checkSurface(page, theme);
  await screenshot(page, 'BIO2110F', theme, 'past-exam');
  await page.getByRole('button', { name: '下一题', exact: true }).click();
  await expect(page.locator('.practice-question h1')).toContainText('真题练习 2');
}

for (const theme of ['light', 'dark']) {
  for (const courseCode of Object.keys(fixtures)) {
    test(`${courseCode} quiz desktop ${theme}: safe fixtures, themes and preserved study flows`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ colorScheme: 'light' });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      const api = await mockQuizApi(page);
      await page.goto('/#quiz');
      await expect(page.locator('.quiz-course-card')).toHaveCount(3);
      await expect(page.locator('.theme-switch')).toBeVisible();
      expect(await page.locator('.theme-switch').boundingBox()).toMatchObject({ width: 90, height: 35 });
      await expect(page.locator('.theme-switch .ts-moon')).toHaveCount(3);
      if (theme === 'dark') await page.locator('.theme-switch .ts-components').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
      await checkSurface(page, theme, '.quiz-main');
      await page.locator('.quiz-course-card').filter({ hasText: courseCode }).getByRole('button', { name: '选择课程', exact: true }).click();
      await expect(page.locator('.quiz-course-nav strong')).toContainText(fixtures[courseCode].title);
      await checkSurface(page, theme);
      await screenshot(page, courseCode, theme, 'dashboard');
      if (courseCode === 'BIO2023M') await molecularFlow(page, theme);
      else if (courseCode === 'BIO2019F') await botanyFlow(page, theme);
      else await microbiologyFlow(page, theme);
      expect(api.unexpected).toEqual([]);
      expect(api.operations.filter((operation) => operation.method !== 'GET').every((operation) => operation.path.startsWith('/api/quiz/'))).toBe(true);
      expect(pageErrors).toEqual([]);
    });
  }
}
