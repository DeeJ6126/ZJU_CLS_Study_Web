import test from 'node:test';
import assert from 'node:assert/strict';

import { navigationItems } from '../src/data/navigation.js';
import { renderSidebar } from '../src/components/sidebar.js';

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

test('sidebar renderer exposes navigation semantics and nested groups', () => {
  const html = renderSidebar(navigationItems);

  assert.match(html, /<aside class="app-sidebar"/);
  assert.match(html, /aria-label="学习平台主导航"/);
  assert.match(html, /href="#resources"/);
  assert.match(html, /<span class="nav-item__label">最美活动<\/span>/);
  assert.match(html, /<ul class="nav-sublist"/);
  assert.match(html, /最美日程表/);
});
