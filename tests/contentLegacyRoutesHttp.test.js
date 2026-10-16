import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentStore } from '../server/content/contentStore.js';
import { handleContentHttpRequest } from '../server/content/contentHttpService.js';

test('public legacy microbiology GET returns published destinations while new-course GETs stay isolated', async () => {
  const contentStore = createContentStore({ filename: ':memory:' });
  contentStore.initialize();
  try {
    for (const [id, courseCode, status] of [
      ['theory', 'BIO2110F', 'published'], ['lab', 'BIO2113F', 'published'],
      ['old', 'BIO2009F', 'published'], ['draft', 'BIO2113F', 'draft'],
      ['archived', 'BIO2110F', 'archived'], ['other', 'BIO2019F', 'published'],
    ]) contentStore.createItem({ id, routeId: id, courseCode, type: 'material', title: id, status });
    for (const [courseCode, ids] of [
      ['BIO2009F', ['lab', 'old', 'theory']], ['BIO2110F', ['theory']], ['BIO2113F', ['lab']],
    ]) {
      let status, payload;
      const handled = await handleContentHttpRequest({
        request: { method: 'GET' }, response: {}, user: null, contentStore,
        url: new URL(`http://fixture/api/content/courses/${courseCode}`),
        sendJson(_response, code, value) { status = code; payload = value; },
      });
      assert.equal(handled, true);
      assert.equal(status, 200);
      assert.deepEqual(payload.items.map(item => item.id).sort(), ids);
      assert.equal(payload.items.find(item => item.id === 'lab')?.courseCode, courseCode === 'BIO2110F' ? undefined : 'BIO2113F');
      assert.ok(payload.items.every(item => !Object.hasOwn(item, 'storedName')));
    }
  } finally { contentStore.close(); }
});
