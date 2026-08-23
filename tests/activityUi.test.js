import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getActivitySlugFromHash, getDemoPageFromHash } from '../src/services/demoNavigationService.js';
import { demoTopPages } from '../src/data/quizDemo.js';

test('nested activity routes stay on the activity page and expose the selected slug', () => {
  assert.equal(getDemoPageFromHash('#activities/lab-open-day', demoTopPages), 'activities');
  assert.equal(getActivitySlugFromHash('#activities/lab-open-day'), 'lab-open-day');
  assert.equal(getActivitySlugFromHash('#activities'), '');
});

test('activity page renders source-backed filters, imagery, and an editorial directory', () => {
  const component = readFileSync('src/components/ActivityPage.vue', 'utf8');
  const config = readFileSync('src/data/activityConfig.js', 'utf8');
  const css = readFileSync('src/styles/activities.css', 'utf8');
  assert.match(component, /activeActivityClient\.value\.fetchActivities/);
  assert.match(config, /全部活动/);
  assert.match(config, /学术前沿/);
  assert.match(component, /selectedActivity\.imageAlt/);
  assert.match(component, /活动目录/);
  assert.doesNotMatch(component, /报名截止|活动时间|活动地点/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /@media\s*\(max-width:\s*800px\)/);
});

test('homepage recent activities come from the shared activity client while popular resources remain static', () => {
  const home = readFileSync('src/components/HomePage.vue', 'utf8');
  const data = readFileSync('src/data/homeContent.js', 'utf8');
  assert.match(home, /activeActivityClient\.value\.fetchActivities/);
  assert.match(home, /recentActivities/);
  assert.match(home, /href="#activities"/);
  assert.match(data, /homePopularResources/);
  assert.match(data, /microbiology-review/);
  assert.doesNotMatch(data, /export const homeActivities/);
});

test('app replaces the activity placeholder with the complete activity page', () => {
  const app = readFileSync('src/App.vue', 'utf8');
  assert.match(app, /import ActivityPage/);
  assert.match(app, /<ActivityPage[\s\S]*v-else-if="activePage === 'activities'"/);
  assert.doesNotMatch(app, /学院活动与学生会内容将在这里持续更新/);
});
