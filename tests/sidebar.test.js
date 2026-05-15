import test from 'node:test';
import assert from 'node:assert/strict';

import { navigationItems } from '../src/data/navigation.js';

test('navigation data contains the requested learning platform sections', () => {
  const labels = navigationItems.map((item) => item.label);

  assert.deepEqual(labels, [
    '资源中心',
    '学业领航',
    '朋辈辅学',
    '实验室开放日',
    '最美活动',
  ]);
});

test('most beautiful activity contains the requested child sections', () => {
  const activity = navigationItems.find((item) => item.label === '最美活动');

  assert.ok(activity);
  assert.deepEqual(
    activity.children.map((item) => item.label),
    ['最美笔记', '最美日程表', '最美书桌'],
  );
});

test('navigation entries expose ids and href anchors for Vue sidebar rendering', () => {
  assert.equal(navigationItems[0].id, 'resources');
  assert.equal(navigationItems[0].href, '#resources');
  assert.equal(navigationItems.at(-1).href, '#beautiful-activities');
});
