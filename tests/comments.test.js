import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentStore } from '../server/content/contentStore.js';
import {
  createComment,
  deleteComment,
  updateComment,
} from '../server/content/commentService.js';

function publishedItem(store, ownerId = 11) {
  return store.createItem({
    id: 'content-1', courseCode: 'BIO2110F', type: 'experience', title: '复习心得',
    body: '正文', status: 'published', ownerId,
  });
}

test('comments use authenticated identities and flatten replies to one level', () => {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  publishedItem(store);
  const root = createComment(store, {
    contentId: 'content-1', user: { id: 21 }, body: '第一条评论',
  });
  const reply = createComment(store, {
    contentId: 'content-1', user: { id: 22 }, body: '回复', parentCommentId: root.comment.id,
  });
  const nested = createComment(store, {
    contentId: 'content-1', user: { id: 23 }, body: '回复回复', parentCommentId: reply.comment.id,
  });

  assert.equal(root.ok, true);
  assert.equal(reply.comment.parentCommentId, root.comment.id);
  assert.equal(nested.comment.parentCommentId, root.comment.id);
  assert.equal(store.listComments('content-1').length, 3);
  store.close();
});

test('comment owners can edit and soft delete while other users are rejected', () => {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  publishedItem(store);
  const created = createComment(store, {
    contentId: 'content-1', user: { id: 21 }, body: '原评论',
  }).comment;

  assert.equal(updateComment(store, created.id, { id: 22 }, '越权编辑').status, 403);
  assert.equal(updateComment(store, created.id, { id: 21 }, '修改后的评论').comment.body, '修改后的评论');
  assert.equal(deleteComment(store, created.id, { id: 22 }).status, 403);
  assert.equal(deleteComment(store, created.id, { id: 21 }).comment.deleted, true);
  assert.equal(store.listComments('content-1')[0].body, '该评论已删除');
  store.close();
});

test('comments reject blank, oversized, unpublished, and rapid repeated messages', () => {
  const store = createContentStore({ filename: ':memory:' });
  store.initialize();
  publishedItem(store);
  assert.equal(createComment(store, { contentId: 'content-1', user: { id: 21 }, body: ' ' }).status, 400);
  assert.equal(createComment(store, { contentId: 'content-1', user: { id: 21 }, body: 'x'.repeat(1001) }).status, 400);
  assert.equal(createComment(store, { contentId: 'missing', user: { id: 21 }, body: '评论' }).status, 404);
  assert.equal(createComment(store, { contentId: 'content-1', user: { id: 21 }, body: '重复内容' }).ok, true);
  assert.equal(createComment(store, { contentId: 'content-1', user: { id: 21 }, body: '重复内容' }).status, 429);
  for (let index = 0; index < 10; index += 1) {
    assert.equal(createComment(store, { contentId: 'content-1', user: { id: 22 }, body: `消息 ${index}` }).ok, true);
  }
  assert.equal(createComment(store, { contentId: 'content-1', user: { id: 22 }, body: '消息 10' }).status, 429);
  store.close();
});
