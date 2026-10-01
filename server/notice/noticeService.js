import { publicApiPath } from '../publicApiPath.js';

export const noticeCategories = new Set(['awards', 'scholarships', 'aid', 'academic', 'general']);
export const noticeMajorIds = new Set(['biology', 'biology-qiushi', 'biology-qiangji', 'ecology', 'ecology-qiangji']);
const statuses = new Set(['draft', 'published', 'archived']);
const failure = (message) => ({ ok: false, status: 400, message });

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function safeHttpUrl(value) {
  if (/[\s\u0000-\u001f\u007f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function validateNoticeInput(input, { current = null, publish = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return failure('通知请求格式无效。');
  const data = { ...current, ...input };
  if (input.status !== undefined && input.status !== (current?.status ?? 'draft')) {
    return failure('请使用发布或下架操作改变通知状态。');
  }
  const value = {};
  for (const [field, limit] of [['title', 120], ['summary', 500], ['body', 100000],
    ['publisher', 120], ['audience', 200], ['sourceUrl', 2048], ['publishedDate', 10], ['deadline', 40]]) {
    if (data[field] !== undefined && typeof data[field] !== 'string') return failure('通知字段格式无效。');
    value[field] = (data[field] ?? '').trim();
    if (value[field].length > limit || /\u0000/.test(value[field])) return failure('通知字段过长或包含无效字符。');
  }
  value.audience ||= '全体学生';
  value.category = data.category;
  if (!value.title || !noticeCategories.has(value.category) || !validDate(value.publishedDate)) {
    return failure('请填写标题、分类和有效的发布日期。');
  }
  if (value.sourceUrl && !safeHttpUrl(value.sourceUrl)) return failure('原文链接必须是有效的 HTTP 或 HTTPS 地址。');
  if (value.deadline) {
    const match = value.deadline.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/);
    if (!match || !validDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59
      || Number(match[4] ?? 0) > 59 || !Number.isFinite(Date.parse(value.deadline))) {
      return failure('截止时间必须是包含时区的有效日期时间。');
    }
    value.deadline = new Date(value.deadline).toISOString();
  }
  if (data.pinned !== undefined && typeof data.pinned !== 'boolean') return failure('置顶设置格式无效。');
  value.pinned = data.pinned ?? false;
  if (data.majorIds !== undefined && (!Array.isArray(data.majorIds)
    || data.majorIds.some((id) => !noticeMajorIds.has(id)) || data.majorIds.length > 5)) return failure('专业设置无效。');
  if (data.cohortYears !== undefined && (!Array.isArray(data.cohortYears)
    || data.cohortYears.length > 100 || data.cohortYears.some((year) => !Number.isInteger(year) || year < 1900 || year > 2200))) {
    return failure('入学年份设置无效。');
  }
  value.majorIds = [...new Set(data.majorIds ?? [])];
  value.cohortYears = [...new Set(data.cohortYears ?? [])];
  if ((publish || current?.status === 'published') && (!value.summary
    || (!value.body && !value.sourceUrl && !current?.attachments?.length))) {
    return failure('发布通知需要摘要，以及正文、原文链接或附件。');
  }
  return { ok: true, value };
}

export function toPublicNotice(notice) {
  const { id, title, summary, body, category, publisher, sourceUrl, audience, majorIds, cohortYears,
    publishedDate, deadline, pinned, status, createdAt, updatedAt } = notice;
  return { id, title, summary, body, category, publisher, sourceUrl, audience, majorIds, cohortYears,
    publishedDate, deadline, pinned, status, createdAt, updatedAt,
    attachments: notice.attachments.map(({ id, fileName, mimeType, size }) => ({
    id, fileName, mimeType, size,
    url: publicApiPath(`/api/notices/${encodeURIComponent(notice.id)}/attachments/${encodeURIComponent(id)}`),
  })) };
}

export function noticeListOptions(searchParams, { publicOnly = false } = {}) {
  const query = (searchParams.get('query') ?? '').trim();
  const category = searchParams.get('category') ?? '';
  const status = publicOnly ? '' : searchParams.get('status') ?? '';
  const majorId = publicOnly ? searchParams.get('majorId') ?? '' : '';
  const year = publicOnly ? searchParams.get('cohortYear') ?? '' : '';
  const timing = publicOnly ? searchParams.get('timing') ?? '' : '';
  const page = Number(searchParams.get('page') || 1);
  const pageSize = Number(searchParams.get('pageSize') || 20);
  if (query.length > 200 || (category && !noticeCategories.has(category)) || (status && !statuses.has(status))
    || (majorId && !noticeMajorIds.has(majorId)) || (year && (!/^\d{4}$/.test(year) || +year < 1900 || +year > 2200))
    || (timing && !['active', 'expired'].includes(timing)) || !Number.isSafeInteger(page) || page < 1 || page > 1000000
    || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return failure('通知筛选参数无效。');
  return { ok: true, value: { publicOnly, query, category, status, majorId, cohortYear: year ? +year : null,
    timing, page, pageSize } };
}
