// Date/time formatting helpers for relative timestamps displayed in the UI.
// Keeps the human label short (e.g. "3 分钟前") while exposing a full ISO
// string via <time datetime="..."> for assistive tech.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * @param {unknown} value
 * @returns {{date: Date, time: number}|null}
 */
function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  return { date, time };
}

/**
 * Compact human label such as "刚刚" / "5 分钟前" / "3 小时前" / "2 天前" /
 * "2026-08-01" (for entries older than a week). Returns '' for invalid input
 * and "刚刚" for future timestamps.
 *
 * @param {unknown} value ISO timestamp or anything `new Date(...)` accepts.
 * @param {number} [now] Override for the reference time (useful in tests).
 * @returns {string}
 */
export function formatRelativeTime(value, now = Date.now()) {
  const parsed = parseTimestamp(value);
  if (!parsed) return '';
  const delta = now - parsed.time;
  if (delta < 0) {
    return '刚刚';
  }
  if (delta < MINUTE) {
    return '刚刚';
  }
  if (delta < HOUR) {
    return `${Math.floor(delta / MINUTE)} 分钟前`;
  }
  if (delta < DAY) {
    return `${Math.floor(delta / HOUR)} 小时前`;
  }
  if (delta < 7 * DAY) {
    return `${Math.floor(delta / DAY)} 天前`;
  }
  return parsed.date.toISOString().slice(0, 10);
}

/**
 * @param {unknown} value
 * @returns {string} ISO-8601 string suitable for `<time datetime="...">`, or ''.
 */
export function isoDateTime(value) {
  const parsed = parseTimestamp(value);
  return parsed ? parsed.date.toISOString() : '';
}
