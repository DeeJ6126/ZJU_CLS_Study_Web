export function getDemoPageHref(pageId) {
  return `#${pageId}`;
}

export function getDemoPageFromHash(hash, pages) {
  const pageId = String(hash ?? '').replace(/^#/, '');
  if (pageId === 'resources' || pageId.startsWith('resources/#')) {
    return 'overview';
  }
  return pages.some((page) => page.id === pageId) ? pageId : 'home';
}
