import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createContentStore } from '../server/content/contentStore.js';
import {
  archiveActivity,
  createActivity,
  publishActivity,
  seedActivityCatalog,
  toPublicActivity,
  updateActivity,
  validateActivityInput,
} from '../server/activity/activityService.js';
import { createActivityApiClient } from '../src/services/activityApiClient.js';
import { activityPrograms } from '../src/data/activityConfig.js';

const catalog = JSON.parse(readFileSync('public/content/activities/catalog.json', 'utf8'));

function memoryStore() {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  return store;
}

test('activity validation requires factual public fields and safe images', () => {
  assert.equal(validateActivityInput({ title: '' }).ok, false);
  assert.equal(validateActivityInput({
    title: '推文', programId: 'laboratory-open-day', imageUrl: 'javascript:alert(1)',
    externalUrl: 'https://mp.weixin.qq.com/s/example',
  }).ok, false);
  assert.equal(validateActivityInput({
    title: '推文', programId: 'laboratory-open-day', imageUrl: '/assets/activities/test.jpg',
    externalUrl: 'https://mp.weixin.qq.com/s/example',
  }).ok, true);
  assert.equal(validateActivityInput({
    title: '推文', programId: 'unknown', imageUrl: '/assets/activities/test.jpg',
    externalUrl: 'https://mp.weixin.qq.com/s/example',
  }).ok, false);
});

test('homepage recommendation is opt-in, editable, and preserved by ordinary edits', () => {
  const store = memoryStore();
  seedActivityCatalog(store, catalog.articles.map((item) => ({ ...item, featured: true })));
  assert.ok(store.listPublishedActivities().every((item) => !item.featured));
  const input = { title: '推荐测试', programId: 'peer-learning', imageUrl: '/assets/activities/peer-learning.webp', externalUrl: 'https://mp.weixin.qq.com/s/home-test' };
  const created = createActivity(store, input, 7);
  assert.equal(created.activity.featured, false);
  assert.equal(validateActivityInput({ ...input, featured: 'true' }).ok, false);
  assert.equal(validateActivityInput({ ...input, programId: 'academic-voyage' }).ok, false);
  const recommended = updateActivity(store, created.activity.id, { featured: true }, 7);
  assert.equal(toPublicActivity(recommended.activity).featured, true);
  assert.equal(updateActivity(store, created.activity.id, { title: '普通编辑' }, 7).activity.featured, true);
  seedActivityCatalog(store, catalog.articles);
  assert.equal(store.findActivityById(created.activity.id).featured, true);
  assert.equal(updateActivity(store, created.activity.id, { featured: false }, 7).activity.featured, false);
});

test('the new program uses existing article management without seeding placeholder posts', () => {
  const store = memoryStore();
  try {
    seedActivityCatalog(store, catalog.articles);
    assert.equal(store.listPublishedActivities().filter((item) => item.programId === activityPrograms[0].id).length, 0);
    const created = createActivity(store, {
      title: '第一期分享', programId: activityPrograms[0].id,
      imageUrl: activityPrograms[0].imageUrl, externalUrl: 'https://mp.weixin.qq.com/s/test-major-zero-distance',
    }, 7);
    assert.equal(created.ok, true);
    assert.equal(created.activity.category, 'learning');
    assert.equal(created.activity.featured, false);
    assert.equal(updateActivity(store, created.activity.id, { title: '第一期回顾' }, 7).activity.title, '第一期回顾');
    assert.equal(archiveActivity(store, created.activity.id, 7).activity.status, 'archived');
  } finally { store.close(); }
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
  assert.equal(calls[0], '/zjubio/api/activities');

  const fallbackClient = createActivityApiClient(async (path) => {
    calls.push(path);
    if (path.startsWith('/zjubio/api/activities')) throw new Error('offline');
    return { ok: true, async json() { return catalog; } };
  });
  const fallback = await fallbackClient.fetchActivities();
  assert.equal(fallback.ok, true);
  assert.equal(fallback.fallback, true);
  assert.equal(fallback.activities.length, 12);
  assert.ok(fallback.activities.every((activity) => !activity.featured));
});
