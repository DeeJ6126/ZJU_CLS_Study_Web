// Tests for the favoriteCount wiring in CourseDetailPage.vue and App.vue.
// These tests cover the prop / computed / template surface via static
// analysis of the source files so they run in plain `node --test` without
// needing a Vue test renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appVuePath = resolve(__dirname, '..', 'src', 'App.vue');
const courseDetailPagePath = resolve(__dirname, '..', 'src', 'components', 'CourseDetailPage.vue');
const favoriteServicePath = resolve(__dirname, '..', 'src', 'services', 'favoriteService.js');
const appVueSource = readFileSync(appVuePath, 'utf8');
const courseDetailPageSource = readFileSync(courseDetailPagePath, 'utf8');
const favoriteServiceSource = readFileSync(favoriteServicePath, 'utf8');

test('favoriteService exports the helper so the UI can share the same definition', () => {
  assert.match(favoriteServiceSource, /export function countUsersFavoritingCourse/);
});

test('App.vue wires the favoriteCount prop to CourseDetailPage', () => {
  assert.match(appVueSource, /import \{ countUsersFavoritingCourse \} from '\.\/services\/favoriteService\.js';/);
  assert.match(appVueSource, /const favoriteCount = computed\(\(\) => \{[\s\S]*?countUsersFavoritingCourse\(demoAccountService\.getAllAccounts\(\), courseCode\)[\s\S]*?\}\)/);
  assert.match(appVueSource, /:favorite-count="favoriteCount"/);
});

test('CourseDetailPage accepts the favoriteCount prop and renders the per-course badge', () => {
  assert.match(courseDetailPageSource, /favoriteCount: \{\s*type: Number,\s*default: 0,\s*\}/);
  assert.match(courseDetailPageSource, /const favoriteCountLabel = computed\(\(\) => \{[\s\S]*?`\$\{count\} 人收藏`/);
  assert.match(courseDetailPageSource, /class="course-detail__favorite-count"[\s\S]*?❤️ \{\{ favoriteCountLabel \}\}/);
});
