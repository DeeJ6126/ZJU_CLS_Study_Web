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
  assert.equal(countUsersFavoritingCourse({ cc98: { courseFavorites: [] } }, 'BIO2110F'), 0);
  assert.equal(countUsersFavoritingCourse({ cc98: { courseFavorites: ['BIO2110F'] } }, ''), 0);
});

test('countUsersFavoritingCourse counts distinct accounts with an explicit course favorite', () => {
  const accounts = {
    cc98: { courseFavorites: ['BIO2110F'] },
    email: { courseFavorites: ['BIO2110F', 'BIO2019F'] },
  };
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 2);
});

test('content-item favorites do not count as course favorites', () => {
  const accounts = {
    cc98: {
      favorites: [
        { id: 'a', courseCode: 'BIO2110F', type: 'material' },
        { id: 'b', courseCode: 'BIO2110F', type: 'paper' },
      ],
    },
  };
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 0);
});

test('explicitly typed legacy course favorites remain supported', () => {
  const accounts = {
    cc98: { favorites: [{ id: 'course:1', courseCode: 'BIO2110F', type: 'course' }] },
  };
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 1);
});

test('countUsersFavoritingCourse tolerates malformed account entries', () => {
  const accounts = {
    cc98: null,
    email: { courseFavorites: 'not-an-array' },
    real: { courseFavorites: [null, { courseCode: 'BIO2110F', type: 'material' }] },
  };
  assert.equal(countUsersFavoritingCourse(accounts, 'BIO2110F'), 0);
});

test('existing favorite helpers still work after the course count addition', () => {
  const favorites = [];
  const key = createFavoriteKey('BIO2110F', 'experiences', 'item-1');
  assert.equal(isFavorited(favorites, key), false);
  const afterToggle = toggleFavorite(favorites, key);
  assert.equal(isFavorited(afterToggle, key), true);
  const afterToggleOff = toggleFavorite(afterToggle, key);
  assert.equal(isFavorited(afterToggleOff, key), false);
});
