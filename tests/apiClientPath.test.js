import test from 'node:test';
import assert from 'node:assert/strict';

import { createRawClient, publicApiPath } from '../src/services/apiClient.js';

test('public API paths stay inside the zjubio public namespace', async () => {
  assert.equal(publicApiPath('api/auth/me'), '/zjubio/api/auth/me');
  assert.equal(publicApiPath('/api/auth/me'), '/zjubio/api/auth/me');
  assert.equal(publicApiPath('/zjubio/api/auth/me'), '/zjubio/api/auth/me');

  const paths = [];
  const client = createRawClient({
    fetchImpl: async (path) => {
      paths.push(path);
      return { ok: true };
    },
  });
  await client.fetchRaw('/zjubio/resource/quiz/catalog.json');
  assert.deepEqual(paths, ['/zjubio/resource/quiz/catalog.json']);
});
