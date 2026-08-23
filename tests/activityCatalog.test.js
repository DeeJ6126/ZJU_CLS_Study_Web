import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync('public/content/activities/catalog.json', 'utf8'));

test('activity catalog contains six source-backed programs with stable public fields', () => {
  assert.equal(catalog.activities.length, 6);
  assert.equal(new Set(catalog.activities.map((item) => item.slug)).size, 6);
  assert.deepEqual(
    new Set(catalog.activities.map((item) => item.category)),
    new Set(['frontier', 'learning', 'community', 'exchange']),
  );
  for (const item of catalog.activities) {
    assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(item.summary.length >= 20);
    assert.ok(item.body.length >= 50);
    assert.equal(item.status, 'published');
    assert.equal(Number.isInteger(item.displayOrder), true);
    assert.equal(existsSync(`public${item.imageUrl}`), true);
    assert.ok(item.imageAlt.length >= 8);
    assert.equal('date' in item, false);
    assert.equal('venue' in item, false);
    assert.equal('deadline' in item, false);
  }
});

test('activity catalog facts cover every named program in the recruitment article', () => {
  const titles = catalog.activities.map((item) => item.title).join('\n');
  for (const phrase of ['学业领航', '实验室开放日', '专业节宣讲', '朋辈辅学', '最美三件套', '寻芳拾翠']) {
    assert.match(titles, new RegExp(phrase));
  }
});
