const contentTypes = new Set(['experience', 'material', 'paper']);

function clean(value) {
  return String(value ?? '').trim();
}

function isHttpUrl(value) {
  if (!value) {
    return true;
  }
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateContentInput(input, { partial = false, current = null } = {}) {
  const data = partial ? { ...current, ...input } : input;
  const courseCode = clean(data.courseCode);
  const type = clean(data.type);
  const title = clean(data.title);
  const summary = clean(data.summary);
  const author = clean(data.author);
  const body = clean(data.body);
  const externalUrl = clean(data.externalUrl);
  const cc98Url = clean(data.cc98Url);
  const gpa = clean(data.gpa);
  const year = clean(data.year);
  const teacher = clean(data.teacher);

  if (!/^[A-Z0-9-]{3,24}$/.test(courseCode) || !contentTypes.has(type)) {
    return { ok: false, status: 400, message: '课程代码或内容类型无效。' };
  }
  if (!title || title.length > 80) {
    return { ok: false, status: 400, message: '标题需要填写且不能超过 80 个字符。' };
  }
  if (summary.length > 200 || author.length > 40 || body.length > 100000) {
    return { ok: false, status: 400, message: '内容字段超过长度限制。' };
  }
  if (!isHttpUrl(externalUrl)) {
    return { ok: false, status: 400, message: '外部链接必须使用 http 或 https。' };
  }
  if (!isHttpUrl(cc98Url)) {
    return { ok: false, status: 400, message: 'CC98 链接必须使用 http 或 https。' };
  }
  if (gpa && (!/^\d(?:\.\d{1,2})?$/.test(gpa) || Number(gpa) < 0 || Number(gpa) > 5)) {
    return { ok: false, status: 400, message: '绩点需要填写 0.00 到 5.00 之间的数值。' };
  }
  if (year.length > 20 || teacher.length > 40) {
    return { ok: false, status: 400, message: '学年或教师字段超过长度限制。' };
  }

  return {
    ok: true,
    value: { courseCode, type, title, summary, author, body, externalUrl, cc98Url, gpa, year, teacher },
  };
}

function validatePublishable(item) {
  if (item.type === 'paper' && !item.file) {
    return { ok: false, status: 400, message: '历年试卷上传 PDF 后才能发布。' };
  }
  if (item.type === 'material' && !item.body && !item.externalUrl && !item.file) {
    return { ok: false, status: 400, message: '复习资料至少需要正文、外部链接或 PDF。' };
  }
  return { ok: true };
}

export function toPublicContentItem(item, likeState = {}, owner = null) {
  return {
    id: item.id,
    routeId: item.routeId,
    courseCode: item.courseCode,
    type: item.type,
    title: item.title,
    summary: item.summary,
    author: item.author,
    body: item.body,
    externalUrl: item.externalUrl,
    cc98Url: item.cc98Url,
    gpa: item.gpa,
    year: item.year,
    teacher: item.teacher,
    file: item.file ? {
      fileName: item.file.fileName,
      mimeType: item.file.mimeType,
      size: item.file.size,
      url: item.file.url,
    } : null,
    likeCount: likeState.likeCount ?? 0,
    viewerLiked: Boolean(likeState.liked),
    owner: owner ? {
      publicId: owner.publicId,
      nickname: owner.nickname,
      avatarUrl: owner.avatarUrl ?? '',
    } : null,
  };
}

export function createContentItem(store, input, userId) {
  const validation = validateContentInput(input);
  if (!validation.ok) {
    return validation;
  }
  return {
    ok: true,
    status: 201,
    item: store.createItem({ ...validation.value, status: 'draft', createdBy: userId, updatedBy: userId }),
  };
}

export function updateContentItem(store, id, changes, userId) {
  const current = store.findById(id);
  if (!current) {
    return { ok: false, status: 404, message: '内容不存在。' };
  }
  const validation = validateContentInput(changes, { partial: true, current });
  if (!validation.ok) {
    return validation;
  }
  if (current.status === 'published') {
    const publishable = validatePublishable({ ...current, ...validation.value });
    if (!publishable.ok) {
      return publishable;
    }
  }
  return { ok: true, status: 200, item: store.updateItem(id, { ...validation.value, updatedBy: userId }) };
}

export function publishContentItem(store, id, userId) {
  const item = store.findById(id);
  if (!item) {
    return { ok: false, status: 404, message: '内容不存在。' };
  }
  const publishable = validatePublishable(item);
  if (!publishable.ok) {
    return publishable;
  }
  return { ok: true, status: 200, item: store.setStatus(id, 'published', userId) };
}

export function archiveContentItem(store, id, userId) {
  if (!store.findById(id)) {
    return { ok: false, status: 404, message: '内容不存在。' };
  }
  return { ok: true, status: 200, item: store.setStatus(id, 'archived', userId) };
}
