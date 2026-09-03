import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentHomepageStore } from '../server/studentHomepage/studentHomepageStore.js';

function makeStore() {
  return createStudentHomepageStore({ filename: ':memory:' });
}

test('student homepage store seeds initial entries and lists them in order', () => {
  const store = makeStore();
  store.initialize();
  store.seedHomepages([
    { id: 'b', name: 'B', href: 'https://b.example', sortOrder: 2 },
    { id: 'a', name: 'A', href: 'https://a.example', sortOrder: 1 },
    { id: 'c', name: 'C', href: 'https://c.example', sortOrder: 3 },
  ]);
  const list = store.listHomepages();
  assert.deepEqual(list.map((item) => item.id), ['a', 'b', 'c']);
});

test('student homepage store creates, updates, and deletes entries', () => {
  const store = makeStore();
  store.initialize();
  const created = store.createHomepage({ name: '张', href: 'https://x.example', sortOrder: 5 });
  assert.equal(created.name, '张');
  assert.equal(created.href, 'https://x.example');
  assert.equal(created.sortOrder, 5);

  const updated = store.updateHomepage(created.id, { name: '李', href: 'https://y.example' });
  assert.equal(updated.name, '李');
  assert.equal(updated.href, 'https://y.example');
  assert.equal(updated.sortOrder, 5);

  const removed = store.deleteHomepage(created.id);
  assert.equal(removed.id, created.id);
  assert.equal(store.listHomepages().length, 0);
});

test('student homepage store update returns null for unknown id', () => {
  const store = makeStore();
  store.initialize();
  assert.equal(store.updateHomepage('missing', { name: 'x' }), null);
  assert.equal(store.deleteHomepage('missing'), null);
});
