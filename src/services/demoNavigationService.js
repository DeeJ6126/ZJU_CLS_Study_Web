function stripHashQuery(hash) {
  const value = String(hash ?? '').replace(/^#/, '');
  const queryIndex = value.indexOf('?');
  return queryIndex === -1 ? value : value.slice(0, queryIndex);
}

export function getHashQuery(hash) {
  const value = String(hash ?? '').replace(/^#/, '');
  const queryIndex = value.indexOf('?');
  if (queryIndex === -1) {
    return new URLSearchParams();
  }
  return new URLSearchParams(value.slice(queryIndex + 1));
}

export function buildHashWithQuery(basePage, params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  const search = new URLSearchParams(entries).toString();
  return `#${basePage}${search ? `?${search}` : ''}`;
}

export function getDemoPageHref(pageId) {
  return `#${pageId}`;
}

export function getDemoPageFromHash(hash, pages) {
  const pageId = stripHashQuery(hash);
  if (pageId === 'resources' || pageId.startsWith('resources/#')) {
    return 'overview';
  }
  if (pageId === 'admin') {
    return 'admin';
  }
  if (pageId === 'activities' || pageId.startsWith('activities/')) {
    return 'activities';
  }
  if (pageId === 'activity' || pageId.startsWith('activity/')) {
    return 'activity-detail';
  }
  if (pageId === 'profile' || pageId.startsWith('profile/')) {
    return 'profile';
  }
  if (pageId === 'notifications') {
    return 'notifications';
  }
  if (pageId.startsWith('activity-program-')) {
    return 'activities';
  }
  if (pageId.startsWith('resource-')) {
    return 'overview';
  }
  return pages.some((page) => page.id === pageId) ? pageId : 'home';
}

export function getActivitySlugFromHash(hash) {
  const value = String(hash ?? '').replace(/^#activities\/?/, '');
  return value ? decodeURIComponent(value) : '';
}

export function getActivityDetailSlugFromHash(hash) {
  const value = String(hash ?? '').replace(/^#activity\/?/, '');
  return value ? decodeURIComponent(value) : '';
}

export function getActivityDetailHref(slug) {
  return `#activity/${encodeURIComponent(slug)}`;
}

export function getProfileIdFromHash(hash) {
  const value = String(hash ?? '').replace(/^#profile\/?/, '');
  return decodeURIComponent(value);
}

export function getProfileHref(publicId) {
  return `#profile/${encodeURIComponent(publicId)}`;
}
