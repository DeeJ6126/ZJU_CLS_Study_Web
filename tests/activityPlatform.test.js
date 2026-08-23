import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createContentStore } from '../server/content/contentStore.js';
import {
  archiveActivity,
  createActivity,
  publishActivity,
  seedActivityCatalog,
  updateActivity,
  validateActivityInput,
} from '../server/activity/activityService.js';
import { createActivityApiClient } from '../src/services/activityApiClient.js';

const catalog = JSON.parse(readFileSync('public/content/activities/catalog.json', 'utf8'));

function memoryStore() {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  return store;
}

test('activity validation requires factual public fields and safe images', () => {
  assert.equal(validateActivityInput({ title: '' }).ok, false);
  assert.equal(validateActivityInput({
    slug: 'good-slug', title: '活动', category: 'frontier', summary: '摘要', body: '正文',
    imageUrl: 'javascript:alert(1)', imageAlt: '说明', displayOrder: 1,
  }).ok, false);
  assert.equal(validateActivityInput({
    slug: 'good-slug', title: '活动', category: 'frontier', summary: '摘要', body: '正文',
    imageUrl: '/assets/activities/test.jpg', imageAlt: '', displayOrder: 1,
  }).ok, false);
});

test('activity store seeds idempotently and orders published featured records', () => {
  const store = memoryStore();
  assert.equal(seedActivityCatalog(store, catalog.activities), 6);
  assert.equal(seedActivityCatalog(store, catalog.activities), 0);
  assert.equal(store.listPublishedActivities().length, 6);
  assert.deepEqual(
    store.listPublishedActivities({ featuredOnly: true }).map((item) => item.slug),
    ['academic-voyage-lectures', 'lab-open-day', 'peer-learning'],
  );
});

test('administrator activity workflow creates, edits, publishes, features, and archives', () => {
  const store = memoryStore();
  const created = createActivity(store, {
    slug: 'new-program', title: '新活动', category: 'community', summary: '活动摘要', body: '活动正文',
    imageUrl: '/assets/activities/beautiful-trio.webp', imageAlt: '活动图片', featured: false, displayOrder: 90,
  }, 7);
  assert.equal(created.ok, true);
  assert.equal(created.activity.status, 'draft');

  const updated = updateActivity(store, created.activity.id, { featured: true, displayOrder: 5 }, 7);
  assert.equal(updated.activity.featured, true);
  assert.equal(updated.activity.displayOrder, 5);
  assert.equal(publishActivity(store, created.activity.id, 7).activity.status, 'published');
  assert.equal(store.findActivityBySlug('new-program').title, '新活动');
  assert.equal(archiveActivity(store, created.activity.id, 7).activity.status, 'archived');
});

test('public activity client keeps successful empty API responses and falls back only on failure', async () => {
  const calls = [];
  const emptyClient = createActivityApiClient(async (path) => {
    calls.push(path);
    return { ok: true, async json() { return { activities: [] }; } };
  });
  assert.deepEqual((await emptyClient.fetchActivities()).activities, []);
  assert.equal(calls.length, 1);

  const fallbackClient = createActivityApiClient(async (path) => {
    calls.push(path);
    if (path.startsWith('api/activities')) throw new Error('offline');
    return { ok: true, async json() { return catalog; } };
  });
  const fallback = await fallbackClient.fetchActivities();
  assert.equal(fallback.ok, true);
  assert.equal(fallback.fallback, true);
  assert.equal(fallback.activities.length, 6);
  assert.equal((await fallbackClient.fetchActivities({ featured: true })).activities.length, 3);
});
