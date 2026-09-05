// Tests for countUsersFavoritingCourse — the favoriteCount badge helper
// in src/services/favoriteService.js. Each test guards a specific edge case
// so regressions in the per-account dedup logic surface immediately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFavoriteKey,
  isFavorited,
  toggleFavorite,
  countUsersFavoritingCourse,
} from '../src/services/favoriteService.js';

test('countUsersFavoritingCourse returns 0 for empty / missing inputs', () => {
  assert.equal(countUsersFavoritingCourse(null, 'BIO2110F'), 0);
  assert.equal(countUsersFavoritingCourse(undefined, 'BIO2110F'), 0);
  assert.equal(countUsersFavoritingCourse({}, 'BIO2110F'), 0);
  assert.equal(countUsersFavoritingCourse({ cc98: null }, 'BIO2110F'), 0);
  assert.equal(countUsersFavoritingCourse({ cc98: { favorites: [] } }, ''), 0);
  assert.equal(countUsersFavoritingCourse({ cc98: { favorites: [{ courseCode: 'BIO2110F' }] } }, ''), 0);
});

test('countUsersFavoritingCourse counts distinct accounts that favorited the course', () => {
  const accounts = {
    cc98: { favorites: [{ id: 'a', courseCode: 'BIO2110F' }] },
    email: { favorites: [{ id: 'b', courseCode: 'BIO2110F' }] },
  };
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 2);
});

test('countUsersFavoritingCourse deduplicates per account (one account with N items still counts as 1)', () => {
  const accounts = {
    cc98: {
      favorites: [
        { id: 'a', courseCode: 'BIO2110F' },
        { id: 'b', courseCode: 'BIO2110F' },
        { id: 'c', courseCode: 'BIO2110F' },
      ],
    },
    email: { favorites: [{ id: 'd', courseCode: 'BIO2110F' }] },
  };
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 2);
});

test('countUsersFavoritingCourse drops an account once all its matching items are removed', () => {
  const accounts = {
    cc98: { favorites: [{ id: 'a', courseCode: 'BIO2110F' }] },
    email: { favorites: [{ id: 'b', courseCode: 'BIO2019F' }] },
  };
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 1);
  accounts.cc98.favorites = [];
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 0);
});

test('countUsersFavoritingCourse ignores favorite entries without a courseCode (forward-compat)', () => {
  const accounts = {
    cc98: {
      favorites: [
        { id: 'a' },
        { id: 'b', courseCode: 'BIO2110F' },
      ],
    },
  };
  // Only the item with a courseCode counts toward the per-course total.
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 1);
});

test('countUsersFavoritingCourse tolerates malformed accounts entries', () => {
  const accounts = {
    cc98: null,
    email: { favorites: null },
    dual: { favorites: 'not-an-array' },
    real: { favorites: [null, undefined, { id: 'a', courseCode: 'BIO2110F' }] },
  };
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 1);
});

test('existing favorite helpers still work after the new addition', () => {
  // Sanity: the older helpers were not disturbed by adding countUsersFavoritingCourse.
  const favorites = [];
  const key = createFavoriteKey('BIO2110F', 'experiences', 'item-1');
  assert.equal(isFavorited(favorites, key), false);
  const afterToggle = toggleFavorite(favorites, key);
  assert.equal(isFavorited(afterToggle, key), true);
  const afterToggleOff = toggleFavorite(afterToggle, key);
  assert.equal(isFavorited(afterToggleOff, key), false);
});
