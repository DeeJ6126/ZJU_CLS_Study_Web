import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contributionBox = readFileSync(new URL('../src/components/ContributionBox.vue', import.meta.url), 'utf8');

test('contribution entry is a compact button that opens a centered modal', () => {
  assert.match(contributionBox, />投稿</);
  assert.match(contributionBox, /contribution-modal/);
  assert.doesNotMatch(contributionBox, /提交申请/);
  assert.doesNotMatch(contributionBox, /例如：第六章复习提纲/);
});

test('contribution modal requests the required submission fields', () => {
  for (const label of ['标题', '副标题', 'cc98名字', 'cc98链接', '内容', '图片', '复习资料链接']) {
    assert.match(contributionBox, new RegExp(label));
  }

  assert.match(contributionBox, /type="file"/);
  assert.match(contributionBox, /v-model="form.title"/);
  assert.match(contributionBox, /v-model="form.cc98Link"/);
  assert.match(contributionBox, /v-model="form.body"/);
});
