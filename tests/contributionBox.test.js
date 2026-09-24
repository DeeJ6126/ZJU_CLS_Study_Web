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

test('contribution modal keeps the shared fields and both body formats', () => {
  for (const label of ['标题', '副标题', 'cc98名字', 'cc98链接', '内容格式', 'Markdown', 'UBB']) {
    assert.match(contributionBox, new RegExp(label));
  }
  assert.match(contributionBox, /v-model="form.title"/);
  assert.match(contributionBox, /v-model="form.cc98Link"/);
  assert.match(contributionBox, /v-model="form.body"/);
  assert.match(contributionBox, /成绩百分制（选填/);
  assert.match(contributionBox, /投稿审核/);
});

test('contribution form keeps PDF-only past-paper uploads and removes legacy helper fields', () => {
  assert.doesNotMatch(contributionBox, /插入图片请在内容里/);
  assert.doesNotMatch(contributionBox, /复习资料链接/);
  assert.match(contributionBox, /isPaper/);
  assert.match(contributionBox, /v-model.trim="form.year"/);
  assert.match(contributionBox, /老师（选填）/);
  assert.match(contributionBox, /type="file"/);
  assert.match(contributionBox, /拖到这里/);
  assert.doesNotMatch(contributionBox, /🖼|🎨|☺/);
  assert.match(contributionBox, /CC98 图片链接/);
});
