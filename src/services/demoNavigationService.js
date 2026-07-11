export function getDemoPageHref(pageId) {
  return `#${pageId}`;
}

export function getDemoPageFromHash(hash, pages) {
  const pageId = String(hash ?? '').replace(/^#/, '');
  return pages.some((page) => page.id === pageId) ? pageId : 'home';
}
