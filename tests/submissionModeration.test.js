import test from 'node:test';
import assert from 'node:assert/strict';

import { createContentStore } from '../server/content/contentStore.js';
import {
  approveSubmission,
  createSubmission,
  rejectSubmission,
  updateSubmission,
} from '../server/content/submissionService.js';

function createTestStore() {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  return store;
}

test('authenticated submissions stay pending until an administrator approves them', () => {
  const store = createTestStore();
  const created = createSubmission(store, {
    courseCode: 'BIO2110F',
    type: 'experience',
    title: '复习顺序',
    summary: '先建立章节框架，再补充细节。',
    author: '24级同学',
    body: '正文',
    cc98Url: 'https://www.cc98.org/topic/123',
    gpa: '4.32',
  }, { id: 7, nickname: 'submitter', verifications: { email: true } });

  assert.equal(created.ok, true);
  assert.equal(created.submission.status, 'pending');
  assert.equal(store.listPublishedByCourse('BIO2110F').length, 0);

  const edited = updateSubmission(store, created.submission.id, {
    title: '管理员校正后的标题',
  }, { id: 2, cc98Nickname: 'admin' });
  assert.equal(edited.submission.title, '管理员校正后的标题');

  const approved = approveSubmission(store, created.submission.id, { id: 2, cc98Nickname: 'admin' });
  assert.equal(approved.ok, true);
  assert.equal(approved.submission.status, 'approved');
  assert.equal(approved.item.status, 'published');
  assert.equal(approved.item.cc98Url, 'https://www.cc98.org/topic/123');
  assert.equal(approved.item.gpa, '4.32');
  assert.equal(store.listPublishedByCourse('BIO2110F').length, 1);
  assert.equal(store.listAuditLogs({ action: 'submission.approve' })[0].actorName, 'admin');
  store.close();
});

test('submission validation rejects unsafe links and invalid GPA values', () => {
  const store = createTestStore();
  const submitter = { id: 7, nickname: 'submitter', verifications: { email: true } };
  const unsafeLink = createSubmission(store, {
    courseCode: 'BIO2110F', type: 'experience', title: '标题', body: '正文', cc98Url: 'javascript:alert(1)',
  }, submitter);
  assert.equal(unsafeLink.status, 400);

  const invalidGpa = createSubmission(store, {
    courseCode: 'BIO2110F', type: 'experience', title: '标题', body: '正文', gpa: '5.01',
  }, submitter);
  assert.equal(invalidGpa.status, 400);
  store.close();
});

test('unverified logged-in users cannot submit content', () => {
  const store = createTestStore();
  const result = createSubmission(store, {
    courseCode: 'BIO2110F', type: 'experience', title: '匿名投稿', body: '正文',
  }, { id: 7, cc98Nickname: 'submitter' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.match(result.message, /学号认证/);
  store.close();
});

test('rejected submissions cannot later be approved', () => {
  const store = createTestStore();
  const created = createSubmission(store, {
    courseCode: 'BIO2110F', type: 'experience', title: '待审核', body: '正文',
  }, { id: 7, nickname: 'submitter', verifications: { email: true } });
  const rejected = rejectSubmission(store, created.submission.id, { id: 2, cc98Nickname: 'admin' }, '内容过少');
  assert.equal(rejected.submission.status, 'rejected');
  assert.equal(approveSubmission(store, created.submission.id, { id: 2, cc98Nickname: 'admin' }).status, 409);
  store.close();
});

test('content likes toggle once per authenticated identity and are included in public content', () => {
  const store = createTestStore();
  const item = store.createItem({
    courseCode: 'BIO2110F', type: 'experience', title: '心得', body: '正文', status: 'published',
  });

  assert.deepEqual(store.toggleLike(item.id, 'visitor-a'), { liked: true, likeCount: 1 });
  assert.deepEqual(store.toggleLike(item.id, 'visitor-a'), { liked: false, likeCount: 0 });
  assert.deepEqual(store.toggleLike(item.id, 'visitor-b'), { liked: true, likeCount: 1 });
  assert.equal(store.getLikeState(item.id, 'visitor-b').liked, true);
  assert.equal(store.getLikeState(item.id, 'visitor-a').liked, false);
  store.close();
});
