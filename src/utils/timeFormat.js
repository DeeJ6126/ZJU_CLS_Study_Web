// Date/time formatting helpers for relative timestamps displayed in the UI.
// Keeps the human label short (e.g. "3 分钟前") while exposing a full ISO
// string via <time datetime="..."> for assistive tech.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  return { date, time };
}

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

export function isoDateTime(value) {
  const parsed = parseTimestamp(value);
  return parsed ? parsed.date.toISOString() : '';
}
