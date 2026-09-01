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
    title: '推文', programId: 'academic-voyage', imageUrl: 'javascript:alert(1)',
    externalUrl: 'https://mp.weixin.qq.com/s/example',
  }).ok, false);
  assert.equal(validateActivityInput({
    title: '推文', programId: 'academic-voyage', imageUrl: '/assets/activities/test.jpg',
    externalUrl: 'https://mp.weixin.qq.com/s/example',
  }).ok, true);
  assert.equal(validateActivityInput({
    title: '推文', programId: 'unknown', imageUrl: '/assets/activities/test.jpg',
    externalUrl: 'https://mp.weixin.qq.com/s/example',
  }).ok, false);
});

test('descriptive program catalog is not mistaken for a directory entry', () => {
  const store = memoryStore();
  assert.equal(seedActivityCatalog(store, catalog.activities), 0);
  assert.equal(seedActivityCatalog(store, catalog.activities), 0);
  assert.equal(store.listPublishedActivities().length, 0);
});

test('administrator adds a published push article, edits it, and removes it from the directory', () => {
  const store = memoryStore();
  const created = createActivity(store, {
    title: '实验室开放日回顾', programId: 'laboratory-open-day',
    imageUrl: '/assets/activities/laboratory-open-day.webp',
    externalUrl: 'https://mp.weixin.qq.com/s/lab-open-day',
  }, 7);
  assert.equal(created.ok, true);
  assert.equal(created.activity.status, 'published');
  assert.equal(created.activity.category, 'frontier');

  const updated = updateActivity(store, created.activity.id, { title: '实验室开放日纪实' }, 7);
  assert.equal(updated.activity.title, '实验室开放日纪实');
  assert.equal(publishActivity(store, created.activity.id, 7).activity.status, 'published');
  assert.equal(store.listPublishedActivities()[0].externalUrl, 'https://mp.weixin.qq.com/s/lab-open-day');
  assert.equal(archiveActivity(store, created.activity.id, 7).activity.status, 'archived');
  assert.equal(store.listPublishedActivities().length, 0);
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
  assert.equal(fallback.activities.length, 0);
});
