export function createFavoriteKey(courseCode, tabId, itemId) {
  return [courseCode, tabId, itemId].join(':');
}

export function isFavorited(favorites, key) {
  return favorites.includes(key);
}

export function toggleFavorite(favorites, key) {
  if (isFavorited(favorites, key)) {
    return favorites.filter((favoriteKey) => favoriteKey !== key);
  }

  return [...favorites, key];
}

/**
 * Count how many distinct accounts have favorited at least one item
 * belonging to the given `courseCode`. Each account contributes at most 1
 * to the total, regardless of how many of its favorites match.
 *
 * @param {Record<string, { favorites?: Array<{ courseCode?: string }> }>|null|undefined} accounts
 * @param {string} courseCode
 * @returns {number}
 */
export function countUsersFavoritingCourse(accounts, courseCode) {
  if (!accounts || typeof accounts !== 'object' || !courseCode) return 0;
  let count = 0;
  for (const account of Object.values(accounts)) {
    const favorites = account?.favorites;
    if (!Array.isArray(favorites) || favorites.length === 0) continue;
    if (favorites.some((favorite) => favorite && favorite.courseCode === courseCode)) {
      count += 1;
    }
  }
  return count;
}
