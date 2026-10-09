import test from 'node:test';
import assert from 'node:assert/strict';
import { readAdminDrafts, saveAdminDraft, removeAdminDraft, hasAdminDraftContent } from '../src/services/adminDraftService.js';

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}
const draft = (key = 'new:one') => ({ key, requestId: 'request-one', majorId: 'biology', editingId: '',
  form: { courseCode: 'BIO2011F', type: 'experience', title: '心得', body: '正文', sourcePlatform: 'other', sourceUrl: 'https://example.org/' } });

test('administrator and demonstration scopes keep independent drafts and update by stable key', () => {
  const s = storage();
  saveAdminDraft('real:1', draft(), s);
  saveAdminDraft('real:2', { ...draft(), form: { ...draft().form, title: '另一位管理员' } }, s);
  assert.equal(readAdminDrafts('real:1', s).drafts[0].form.title, '心得');
  assert.equal(readAdminDrafts('real:2', s).drafts[0].form.title, '另一位管理员');
  assert.equal(readAdminDrafts('demo:1', s).drafts.length, 0);
  saveAdminDraft('real:1', { ...draft(), editingId: 'server-id', pendingFileName: '资料.pdf' }, s);
  const found = readAdminDrafts('real:1', s).drafts;
  assert.equal(found.length, 1);
  assert.equal(found[0].editingId, 'server-id');
  assert.equal(found[0].pendingFileName, '资料.pdf');
  assert.equal(found[0].requestId, 'request-one');
  assert.equal(removeAdminDraft('real:1', 'new:one', s).drafts.length, 0);
  assert.equal(readAdminDrafts('real:2', s).drafts.length, 1);
});

test('drafts only persist known form fields and bounded file metadata, never credentials or file bytes', () => {
  const s = storage();
  const saved = saveAdminDraft('real:1', { ...draft(), password: 'secret', file: { bytes: 'data' },
    form: { ...draft().form, password: 'secret', body: 'x'.repeat(100001) },
    savedFile: { fileName: '资料.pdf', url: '/zjubio/api/content/files/id', storedName: 'private-path' } }, s);
  assert.equal(saved.draft.form.body.length, 100000);
  assert.equal('password' in saved.draft.form, false);
  assert.equal('password' in saved.draft, false);
  assert.equal('storedName' in saved.draft.savedFile, false);
});

test('storage errors report failure while leaving other drafts intact', () => {
  const broken = { getItem() { return '[]'; }, setItem() { throw new Error('quota'); } };
  assert.equal(saveAdminDraft('real:1', draft(), broken).ok, false);
  const malformed = { getItem() { return '{'; } };
  assert.equal(readAdminDrafts('real:1', malformed).ok, false);
  assert.equal(saveAdminDraft('', draft(), storage()).ok, false);
});

test('empty next-entry templates are not unfinished content and capacity never silently drops existing drafts', () => {
  assert.equal(hasAdminDraftContent({ courseCode: 'BIO2011F', type: 'experience', sourcePlatform: 'cc98' }), false);
  assert.equal(hasAdminDraftContent({ body: '内容' }), true);
  assert.equal(hasAdminDraftContent({}, '试卷.pdf'), true);
  const s = storage();
  for (let i = 0; i < 20; i++) assert.equal(saveAdminDraft('real:1', draft(`new:${i}`), s).ok, true);
  assert.equal(saveAdminDraft('real:1', draft('new:extra'), s).ok, false);
  assert.equal(readAdminDrafts('real:1', s).drafts.length, 20);
});

test('a stale window cannot overwrite or remove a newer draft revision', () => {
  const s = storage();
  const first = saveAdminDraft('real:1', draft(), s);
  const next = saveAdminDraft('real:1', { ...draft(), form: { ...draft().form, body: '另一窗口的修改' } }, s, first.draft.revision);
  assert.equal(next.ok, true);
  assert.equal(saveAdminDraft('real:1', draft(), s, first.draft.revision).ok, false);
  const removal = removeAdminDraft('real:1', first.draft.key, s, first.draft.revision);
  assert.equal(removal.skipped, true);
  assert.equal(removal.drafts[0].form.body, '另一窗口的修改');
  assert.equal(removeAdminDraft('real:1', next.draft.key, s, next.draft.revision).drafts.length, 0);
});
