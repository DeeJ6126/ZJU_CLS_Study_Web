import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommentApiClient } from '../src/services/commentApiClient.js';

test('comment client lists, creates, edits, and deletes identified comments', async () => {
  const requests = [];
  const client = createCommentApiClient(async (path, options = {}) => {
    requests.push({ path, options });
    return { ok: true, status: 200, async json() { return { comments: [] }; } };
  });
  await client.list('content-1');
  await client.create('content-1', { body: '评论', parentCommentId: 'comment-1' });
  await client.update('comment-1', '修改');
  await client.remove('comment-1');
  assert.deepEqual(requests.map((request) => request.options.method ?? 'GET'), ['GET', 'POST', 'PATCH', 'DELETE']);
  assert.equal(requests[0].path, 'api/content/items/content-1/comments');
  assert.equal(requests[2].path, 'api/comments/comment-1');
});
