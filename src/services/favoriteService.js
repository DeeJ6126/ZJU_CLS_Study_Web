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
 * Count how many distinct accounts have explicitly favorited the course itself.
 * Content-item favorites (心得、资料、试卷) intentionally do not count.
 *
 * @param {Record<string, { courseFavorites?: Array<string|object>, favorites?: Array<object> }>|null|undefined} accounts
 * @param {string} courseCode
 * @returns {number}
 */
export function countUsersFavoritingCourse(accounts, courseCode) {
  if (!accounts || typeof accounts !== 'object' || !courseCode) return 0;
  let count = 0;
  for (const account of Object.values(accounts)) {
    const courseFavorites = Array.isArray(account?.courseFavorites) ? account.courseFavorites : [];
    const hasCourseFavorite = courseFavorites.some((favorite) => (
      typeof favorite === 'string'
        ? favorite === courseCode
        : favorite?.courseCode === courseCode && favorite?.type === 'course'
    ));
    if (hasCourseFavorite) {
      count += 1;
      continue;
    }
    // Accept an explicitly typed legacy record, but never infer a course
    // favorite from a content item's courseCode alone.
    if (Array.isArray(account?.favorites) && account.favorites.some((favorite) => (
      favorite?.courseCode === courseCode && favorite?.type === 'course'
    ))) count += 1;
  }
  return count;
}
