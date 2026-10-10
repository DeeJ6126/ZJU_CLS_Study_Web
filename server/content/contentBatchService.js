import { createHash } from 'node:crypto';
import { filterAdminCoursesToOverview } from '../../src/services/adminCourseService.js';
import { loadServerCourseCatalog } from '../account/courseCatalogService.js';
import { publicApiPath } from '../publicApiPath.js';
import { validateContentInput } from './contentService.js';

export const MAX_BATCH_ITEMS = 200;
export const MAX_BATCH_BYTES = 8 * 1024 * 1024;

const batchTypes = new Set(['experience', 'material']);
const fields = [
  'courseCode', 'type', 'title', 'summary', 'author', 'teacher', 'sourcePlatform',
  'sourceUrl', 'bodyFormat', 'body', 'externalUrl', 'gpa', 'gradePercentage', 'year',
];
const acceptedFields = new Set([...fields, 'cc98Url']);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = (status, message) => ({ ok: false, status, message });

function fingerprintRow(value) {
  if (!object(value)) return { invalidItemType: Array.isArray(value) ? 'array' : typeof value };
  // Only scalar fields can be imported. Never recurse into invalid JSON values.
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key,
    typeof value[key] === 'string' ? value[key] : { invalidFieldType: typeof value[key] },
  ]));
}

function inspectDocument(document) {
  if (!object(document) || Object.keys(document).some((key) => !['version', 'items'].includes(key))) {
    return failure(400, 'JSON 顶层仅支持 version 和 items 字段。');
  }
  if (document.version !== undefined && document.version !== 1) {
    return failure(400, 'JSON 格式版本必须为 1。');
  }
  if (!Array.isArray(document.items) || !document.items.length) {
    return failure(400, 'items 必须是非空数组。');
  }
  if (document.items.length > MAX_BATCH_ITEMS) {
    return failure(413, `每批最多 ${MAX_BATCH_ITEMS} 条，请拆分文件。`);
  }
  const serialized = JSON.stringify({ version: 1, items: document.items.map(fingerprintRow) });
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BATCH_BYTES) {
    return failure(413, '每批 JSON 最大 8 MiB，请拆分文件。');
  }
  return { ok: true, fingerprint: createHash('sha256').update(serialized).digest('hex') };
}

function coursesForBatch(courseCatalog) {
  return filterAdminCoursesToOverview((courseCatalog ?? loadServerCourseCatalog()).courses);
}

function matchingPublishedItems(store, courses, type = '', courseCodes = []) {
  const allowed = new Set(courses.map((course) => course.code));
  const selected = new Set(courseCodes);
  return store.listAdmin({ status: 'published', type }).filter((item) => (
    allowed.has(item.courseCode) && batchTypes.has(item.type)
    && (!selected.size || selected.has(item.courseCode))
  ));
}

function inspectRows(document, courses) {
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const values = [];
  const rows = document.items.map((input, position) => {
    const errors = [];
    const warnings = [];
    const item = object(input) ? input : {};
    if (!object(input)) errors.push('每条记录必须是 JSON 对象。');
    for (const key of Object.keys(item)) {
      if (!acceptedFields.has(key)) errors.push(`不支持字段：${key}。`);
      else if (typeof item[key] !== 'string') errors.push(`${key} 必须是字符串。`);
    }
    const courseCode = typeof item.courseCode === 'string' ? item.courseCode.trim() : '';
    const type = typeof item.type === 'string' ? item.type.trim() : '';
    if (!byCode.has(courseCode)) errors.push('课程代码不在当前管理课程目录中。');
    if (!batchTypes.has(type)) errors.push('类别只能为 experience 或 material。');
    const validation = errors.length ? null : validateContentInput(item);
    if (validation && !validation.ok) errors.push(validation.message);
    if (validation?.ok) {
      const value = validation.value;
      if (type === 'experience' && !value.body) errors.push('学习心得必须填写正文。');
      if (type === 'material' && !value.body && !value.externalUrl) {
        errors.push('复习资料至少需要正文或外部下载链接。');
      }
      if (!errors.length) {
        values.push(value);
      }
    }
    return {
      index: position + 1,
      courseCode,
      courseName: byCode.get(courseCode)?.name ?? '',
      type,
      title: typeof item.title === 'string' ? item.title.trim() : '',
      author: typeof item.author === 'string' ? item.author.trim() : '',
      bodyFormat: validation?.ok ? validation.value.bodyFormat
        : typeof item.bodyFormat === 'string' ? item.bodyFormat.trim() : 'markdown',
      errors,
      warnings,
    };
  });
  return { rows, values };
}

export function previewContentBatch(store, document, courseCatalog) {
  const inspection = inspectDocument(document);
  if (!inspection.ok) return inspection;
  const { rows } = inspectRows(document, coursesForBatch(courseCatalog));
  const invalidCount = rows.filter((row) => row.errors.length).length;
  return {
    ok: true,
    status: 200,
    preview: { fingerprint: inspection.fingerprint, total: rows.length,
      validCount: rows.length - invalidCount, invalidCount, rows },
  };
}

export function importContentBatch(store, input, actor, courseCatalog) {
  if (actor?.role !== 'admin' || !actor.id) return failure(403, '当前账号没有管理权限。');
  if (!object(input) || typeof input.requestId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId)) {
    return failure(400, '批量导入请求标识必须为 UUID。');
  }
  const inspection = inspectDocument(input.document);
  if (!inspection.ok) return inspection;
  if (input.fingerprint !== inspection.fingerprint) {
    return failure(409, '文件内容与预览不一致，请重新预览。');
  }
  const previous = store.findContentBatchRequest(actor.id, input.requestId);
  if (previous) {
    if (previous.fingerprint !== inspection.fingerprint) {
      return failure(409, '该请求标识已用于其他文件，请重新预览导入。');
    }
    return { ok: true, status: 200,
      result: { createdCount: previous.items.length, replayed: true, items: previous.items } };
  }
  const { rows, values } = inspectRows(input.document, coursesForBatch(courseCatalog));
  if (rows.some((row) => row.errors.length)) return failure(400, '文件中仍有错误，请修正后重新预览。');
  const result = store.createContentBatch({
    items: values, fingerprint: inspection.fingerprint, requestId: input.requestId, actor,
  });
  if (result.conflict) return failure(409, '该请求标识已用于其他文件，请重新预览导入。');
  return { ok: true, status: result.replayed ? 200 : 201,
    result: { createdCount: result.items.length, replayed: result.replayed, items: result.items } };
}

function validateFilter(input) {
  if (!object(input)) return failure(400, '导出筛选格式无效。');
  const type = input.type ?? '';
  if (typeof type !== 'string' || (type && !batchTypes.has(type))) {
    return failure(400, '类别只能为空、experience 或 material。');
  }
  const courseCodes = input.courseCodes ?? [];
  if (!Array.isArray(courseCodes) || courseCodes.some((code) => typeof code !== 'string')) {
    return failure(400, '课程筛选必须是课程代码数组。');
  }
  return { ok: true, type, courseCodes: [...new Set(courseCodes)] };
}

export function listContentBatchCourses(store, type = '', courseCatalog) {
  const filter = validateFilter({ type });
  if (!filter.ok) return filter;
  const courses = coursesForBatch(courseCatalog);
  const counts = new Map();
  for (const item of matchingPublishedItems(store, courses, type)) {
    counts.set(item.courseCode, (counts.get(item.courseCode) ?? 0) + 1);
  }
  return { ok: true, status: 200, courses: courses.filter((course) => counts.has(course.code))
    .map((course) => ({ code: course.code, name: course.name, count: counts.get(course.code) })),
  total: [...counts.values()].reduce((total, count) => total + count, 0) };
}

function downloadUrl(item) {
  if (item.externalUrl) return item.externalUrl;
  if (!item.file?.url) return '';
  let path = String(item.file.url);
  if (path.startsWith('/api/')) path = publicApiPath(path);
  else if (path.startsWith('/resource/')) path = `/zjubio${path}`;
  try {
    const url = new URL(path, 'https://bis.zju.edu.cn/zjubio/');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function exportContentBatch(store, input, courseCatalog) {
  const filter = validateFilter(input);
  if (!filter.ok) return filter;
  const courses = coursesForBatch(courseCatalog);
  const allowed = new Set(courses.map((course) => course.code));
  if (filter.courseCodes.some((code) => !allowed.has(code))) {
    return failure(400, '课程筛选包含当前管理目录以外的课程。');
  }
  const items = matchingPublishedItems(store, courses, filter.type, filter.courseCodes)
    .sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id))
    .map((item) => Object.fromEntries(fields.map((key) => [key,
      key === 'externalUrl' ? downloadUrl(item) : item[key] ?? '',
    ])));
  if (items.length > MAX_BATCH_ITEMS) return failure(413, `每批最多导出 ${MAX_BATCH_ITEMS} 条，请缩小筛选范围。`);
  const document = { version: 1, items };
  if (Buffer.byteLength(`${JSON.stringify(document, null, 2)}\n`, 'utf8') > MAX_BATCH_BYTES) {
    return failure(413, '导出 JSON 超过 8 MiB，请缩小筛选范围。');
  }
  return { ok: true, status: 200, document, count: items.length };
}
