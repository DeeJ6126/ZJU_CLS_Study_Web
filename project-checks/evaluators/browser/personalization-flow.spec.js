import { expect, test } from '@playwright/test';

const guest = { id: 'guest', role: 'guest', nickname: '游客', verifications: { email: false } };
const sessionId = `quiz_${'a'.repeat(32)}`;
const note = { id: 'note-1', routeId: '1', courseCode: 'BIO2011F', type: 'experience', title: '生化学习心得', summary: '复习方法', author: '同学', teacher: '陈才勇', year: '2025-2026', body: '正文', bodyFormat: 'markdown' };

async function mockApi(page) {
  let signedIn = false;
  let user = { id: 'email-1', publicId: 'user-1', role: 'student', nickname: '测试同学', grade: 2024, majorId: 'ecology', verifications: { email: true } };
  const writes = [];
  await page.route('**/zjubio/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/zjubio', '');
    const method = request.method();
    if (method !== 'GET') writes.push(path);
    let payload = {};
    if (path === '/api/auth/me') payload = { user: signedIn ? user : guest };
    else if (path === '/api/auth/login/email') { signedIn = true; payload = { user }; }
    else if (path === '/api/auth/logout') { signedIn = false; payload = { ok: true }; }
    else if (path === '/api/account/profile/study') { user = { ...user, ...request.postDataJSON() }; payload = { user }; }
    else if (path === '/api/account/courses') payload = { courses: [] };
    else if (path === '/api/account/course-favorites') payload = { courseCodes: [] };
    else if (path === '/api/account/favorites') payload = { favorites: [] };
    else if (path === '/api/account/notifications') payload = { notifications: [], unreadCount: 0 };
    else if (path === '/api/quiz/account-state') payload = { state: { progress: null, mistakes: [], vocabulary: [] } };
    else if (path === '/api/quiz/recent') payload = { recent: null };
    else if (path === '/api/activities') payload = { activities: [] };
    else if (path === '/api/student-homepages') payload = { homepages: [] };
    else if (path === '/api/consultation/status') payload = { open: false, isMentor: false };
    else if (path.startsWith('/api/course-favorite-counts/')) payload = { count: 2 };
    else if (path.startsWith('/api/content/courses/')) payload = { items: [note] };
    else if (path === '/api/quiz/collections') payload = { collections: [{ slug: 'microbiology-final-review', title: '微生物学', courseCode: 'BIO2110F' }] };
    else if (path.endsWith('/categories')) payload = { categories: [{ sourceId: '1', title: '第一章', questionCount: 2, type: 'chapter' }] };
    else if (path === `/api/quiz/sessions/${sessionId}`) payload = { session: {
      id: sessionId, collectionSlug: 'microbiology-final-review', mode: 'categories',
      selectedCategorySourceIds: ['1'], questionOrder: ['q1', 'q2'], currentIndex: 1,
      questionIndex: [{ sourceQuestionId: 'q1', index: 0, categorySourceId: '1', localNumber: 1 }, { sourceQuestionId: 'q2', index: 1, categorySourceId: '1', localNumber: 2 }],
      currentQuestion: { sourceQuestionId: 'q2', type: 'multiple_choice', prompt: '继续练习的第二道题', body: { chapterId: '1', number: 2, options: [{ key: 'A', text: '选项甲' }, { key: 'B', text: '选项乙' }] } },
      answerStatusBySourceQuestionId: {}, startedAt: '2026-09-30T00:00:00.000Z',
    } };
    else if (path.endsWith('/comments')) payload = { comments: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  return writes;
}

test('guest settings, metadata, and favorites survive reload without account writes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const writes = await mockApi(page);
  await page.clock.setFixedTime(new Date('2026-09-30T00:00:00+08:00'));
  await page.goto('/');
  await page.getByRole('button', { name: '稍后设置' }).click();
  await page.reload();
  await page.getByRole('button', { name: '设置专业与入学年级', exact: true }).click();
  await page.locator('.home-study__setup').getByRole('combobox', { name: '专业', exact: true }).selectOption('biology');
  await page.locator('.home-study__setup').getByRole('combobox', { name: '入学年级', exact: true }).selectOption('2025');
  await page.locator('.home-study__setup').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.home-study__courses')).toContainText('生物化学');
  await page.reload();
  await expect(page.locator('.home-study__term')).toContainText('二（秋冬）');
  await page.goto('/#resources/#BIO2011F/#experiences');
  await expect(page.locator('.learning-card__metadata')).toContainText('陈才勇');
  await expect(page.locator('.learning-card__metadata')).toContainText('2025-2026');
  await page.locator('.learning-card__main-link').click();
  await expect(page.locator('.article-action-button')).toBeDisabled();
  await page.getByRole('button', { name: '收藏', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/#overview?program=2025&group=semester');
  const courseCard = page.locator('.overview-course-grid article').filter({ hasText: 'BIO2011F' }).first();
  await courseCard.getByRole('button', { name: '收藏', exact: true }).click();
  await page.reload();
  await expect(courseCard.getByRole('button', { name: '取消收藏', exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  await page.goto('/');
  await page.screenshot({ path: 'project-checks/artifacts/personalization-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: 'project-checks/artifacts/personalization-mobile.png', fullPage: true });
});

test('last guest practice resumes and login/logout keeps account and guest preferences separate', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const writes = await mockApi(page);
  await page.addInitScript(({ sessionId }) => {
    localStorage.setItem('zjubio:local-workspace:v1:guest', JSON.stringify({
      majorId: 'biology', cohortYear: 2025, onboardingDismissed: true,
      courseFavorites: ['BIO2011F'], contentFavorites: [],
      lastQuiz: { courseCode: 'BIO2110F', collectionSlug: 'microbiology-final-review', sessionId },
    }));
  }, { sessionId });
  await page.goto('/');
  await page.getByRole('button', { name: '继续练习', exact: true }).click();
  await expect(page.getByText('继续练习的第二道题', { exact: true })).toBeVisible();
  await page.locator('.demo-brand').click();
  await page.locator('.demo-user-chip').click();
  await page.locator('.account-popover').getByRole('button', { name: '登录', exact: true }).click();
  await page.locator('.auth-dialog input[type="text"]').fill('3240100001');
  await page.locator('.auth-dialog input[type="password"]').fill('testpass123');
  await page.locator('.auth-dialog').getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.demo-user-chip')).toContainText('测试同学');
  await expect(page.locator('.home-study__term')).toContainText('生态学');
  await page.keyboard.press('Escape');
  await expect(page.locator('.account-popover')).toHaveCount(0);
  expect(writes.some((path) => path.includes('/merge') || path.includes('/claim') || path.includes('/favorites/'))).toBe(false);
  await page.getByRole('button', { name: '修改专业与年级' }).click();
  await page.locator('.home-study__setup').getByRole('combobox', { name: '专业', exact: true }).selectOption('biology-qiushi');
  await page.locator('.home-study__setup').getByRole('combobox', { name: '入学年级', exact: true }).selectOption('2026');
  await page.locator('.home-study__setup').getByRole('button', { name: '保存', exact: true }).click();
  await page.reload();
  await expect(page.locator('.home-study__term')).toContainText('求是科学班');
  await page.locator('.demo-user-chip').click();
  await page.locator('.account-popover').getByRole('button', { name: '退出登录' }).click();
  await expect(page.locator('.home-study__term')).toContainText('生物科学');
  expect(errors).toEqual([]);
});
