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
