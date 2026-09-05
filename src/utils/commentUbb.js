import { ubbToHtml } from './ubbParser.js';

/**
 * Render a comment body as safe HTML for v-html injection. Always passes the
 * input through `ubbToHtml` so the CC98-style UBB tags work in comments, and
 * never returns raw HTML that could be injected by the author.
 *
 * @param {unknown} body raw comment text (may be null/undefined)
 * @returns {string} HTML string safe to assign to v-html
 */
export function renderCommentBody(body) {
  return ubbToHtml(String(body ?? ''));
}
