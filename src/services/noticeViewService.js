import { majorOptions } from '../data/courses/programCatalog.js';

const shanghaiFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function dateParts(date) {
  return Object.fromEntries(shanghaiFormatter.formatToParts(date)
    .filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

export function noticeDeadlineTimestamp(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const date = new Date(dateOnly ? `${text}T00:00:00+08:00` : text);
  if (Number.isNaN(date.getTime())) return null;
  if (dateOnly) {
    const parts = dateParts(date);
    if (`${parts.year}-${parts.month}-${parts.day}` !== text) return null;
  }
  return date.getTime() + (dateOnly ? 24 * 60 * 60 * 1000 : 0);
}

export function formatNoticeDate(value, includeTime = false) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && noticeDeadlineTimestamp(text) == null) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00+08:00` : text);
  if (Number.isNaN(date.getTime())) return '';
  const parts = dateParts(date);
  const label = `${parts.year}-${parts.month}-${parts.day}`;
  return includeTime && !/^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${label} ${parts.hour}:${parts.minute}` : label;
}

export function noticeDeadlineState(notice, now = new Date()) {
  const deadline = noticeDeadlineTimestamp(notice?.deadline);
  if (deadline == null) return { id: 'none', label: '未设截止日期', date: '' };
  const expired = new Date(now).getTime() >= deadline;
  return {
    id: expired ? 'expired' : 'active', label: expired ? '已截止' : '未截止',
    date: formatNoticeDate(notice.deadline, true),
  };
}

export function noticeAudienceLabel(notice) {
  const majors = (notice?.majorIds ?? []).map((id) => majorOptions.find((item) => item.id === id)?.label ?? id);
  const cohorts = (notice?.cohortYears ?? []).map((year) => `${year}级`);
  return [String(notice?.audience ?? '').trim(), majors.join('、'), cohorts.join('、')]
    .filter(Boolean).join(' · ') || '全体学生';
}

export function noticeDetailHref(id) {
  return `#notices/${encodeURIComponent(String(id ?? ''))}`;
}

export function safeNoticeUrl(value, { attachment = false } = {}) {
  const text = String(value ?? '').trim();
  if (!text || /[\u0000-\u0020\u007f\\]/.test(text)) return '';
  if (attachment) return /^\/zjubio\/api\/notices\/[^/?#]+\/attachments\/[^/?#]+$/.test(text) ? text : '';
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function noticeAttachmentType(attachment) {
  const extension = String(attachment?.fileName ?? '').split('.').at(-1).toLowerCase();
  if (extension === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(extension)) return 'Word';
  if (['xls', 'xlsx'].includes(extension)) return 'Excel';
  return '附件';
}

export function formatNoticeFileSize(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

export function noticeCohortOptions(now = new Date(), profileYear = '') {
  const year = Number(dateParts(new Date(now)).year);
  const years = new Set(Array.from({ length: 9 }, (_, index) => String(year + 1 - index)));
  if (/^\d{4}$/.test(String(profileYear))) years.add(String(profileYear));
  return [...years].sort((left, right) => Number(right) - Number(left));
}
