import test from 'node:test';
import assert from 'node:assert/strict';

import { createSubmissionApiClient } from '../src/services/submissionApiClient.js';

test('submission client creates submissions, uploads PDFs, and toggles anonymous likes', async () => {
  const requests = [];
  const client = createSubmissionApiClient(async (path, options = {}) => {
    requests.push({ path, options });
    return {
      ok: true,
      status: 200,
      async json() { return { submission: { id: 'submission-1' }, liked: true, likeCount: 3 }; },
    };
  });

  await client.create({ courseCode: 'BIO2110F', type: 'experience', title: '心得' });
  await client.uploadPdf('submission-1', new File(['%PDF-file'], '资料.pdf', { type: 'application/pdf' }));
  const liked = await client.toggleLike('content-1');

  assert.equal(requests[0].path, 'api/submissions');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[1].options.headers['x-submission-upload'], 'course-content');
  assert.equal(requests[1].options.body instanceof File, true);
  assert.equal(requests[2].path, 'api/content/content-1/like');
  assert.deepEqual(liked, { ok: true, status: 200, submission: { id: 'submission-1' }, liked: true, likeCount: 3 });
});
