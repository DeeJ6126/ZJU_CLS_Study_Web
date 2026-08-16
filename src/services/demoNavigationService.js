export function getDemoPageHref(pageId) {
  return `#${pageId}`;
}

export function getDemoPageFromHash(hash, pages) {
  const pageId = String(hash ?? '').replace(/^#/, '');
  if (pageId === 'resources' || pageId.startsWith('resources/#')) {
    return 'overview';
  }
  if (pageId === 'admin') {
    return 'admin';
  }
  if (pageId === 'profile' || pageId.startsWith('profile/')) {
    return 'profile';
  }
  if (pageId === 'notifications') {
    return 'notifications';
  }
  return pages.some((page) => page.id === pageId) ? pageId : 'home';
}

export function getProfileIdFromHash(hash) {
  const value = String(hash ?? '').replace(/^#profile\/?/, '');
  return decodeURIComponent(value);
}

export function getProfileHref(publicId) {
  return `#profile/${encodeURIComponent(publicId)}`;
}
