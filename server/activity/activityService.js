const activityCategories = new Set(['frontier', 'learning', 'community', 'exchange']);

function clean(value) {
  return String(value ?? '').trim();
}

function isSafeImageUrl(value) {
  if (!value) return true;
  if (value.startsWith('/assets/activities/')) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateActivityInput(input, { partial = false, current = null } = {}) {
  const data = partial ? { ...current, ...input } : input;
  const slug = clean(data.slug);
  const title = clean(data.title);
  const category = clean(data.category);
  const summary = clean(data.summary);
  const body = clean(data.body);
  const imageUrl = clean(data.imageUrl);
  const imageAlt = clean(data.imageAlt);
  const displayOrder = Number(data.displayOrder ?? 100);
  const featured = data.featured === true || data.featured === 1;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return { ok: false, status: 400, message: '活动链接标识只能使用小写字母、数字和连字符。' };
  }
  if (!title || title.length > 80 || !activityCategories.has(category)) {
    return { ok: false, status: 400, message: '活动标题或分类无效。' };
  }
  if (!summary || summary.length > 240 || !body || body.length > 20000) {
    return { ok: false, status: 400, message: '活动摘要和正文需要填写，并保持在长度限制内。' };
  }
  if (!isSafeImageUrl(imageUrl) || (imageUrl && (!imageAlt || imageAlt.length > 160))) {
    return { ok: false, status: 400, message: '活动图片地址或图片说明无效。' };
  }
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 9999) {
    return { ok: false, status: 400, message: '展示顺序需要是 0 到 9999 的整数。' };
  }
  return {
    ok: true,
    value: { slug, title, category, summary, body, imageUrl, imageAlt, featured, displayOrder },
  };
}

export function toPublicActivity(activity) {
  return {
    id: activity.id,
    slug: activity.slug,
    title: activity.title,
    category: activity.category,
    summary: activity.summary,
    body: activity.body,
    imageUrl: activity.imageUrl,
    imageAlt: activity.imageAlt,
    featured: activity.featured,
    displayOrder: activity.displayOrder,
    updatedAt: activity.updatedAt,
  };
}

export function createActivity(store, input, userId) {
  const validation = validateActivityInput(input);
  if (!validation.ok) return validation;
  if (store.findActivityBySlug(validation.value.slug)) {
    return { ok: false, status: 409, message: '活动链接标识已存在。' };
  }
  return {
    ok: true,
    status: 201,
    activity: store.createActivity({
      ...validation.value, status: 'draft', createdBy: userId, updatedBy: userId,
    }),
  };
}

export function updateActivity(store, id, input, userId) {
  const current = store.findActivityById(id);
  if (!current) return { ok: false, status: 404, message: '活动不存在。' };
  const validation = validateActivityInput(input, { partial: true, current });
  if (!validation.ok) return validation;
  const duplicate = store.findActivityBySlug(validation.value.slug);
  if (duplicate && duplicate.id !== id) {
    return { ok: false, status: 409, message: '活动链接标识已存在。' };
  }
  return {
    ok: true,
    status: 200,
    activity: store.updateActivity(id, { ...validation.value, updatedBy: userId }),
  };
}

export function publishActivity(store, id, userId) {
  const activity = store.findActivityById(id);
  if (!activity) return { ok: false, status: 404, message: '活动不存在。' };
  const validation = validateActivityInput(activity);
  if (!validation.ok) return validation;
  return { ok: true, status: 200, activity: store.setActivityStatus(id, 'published', userId) };
}

export function archiveActivity(store, id, userId) {
  if (!store.findActivityById(id)) return { ok: false, status: 404, message: '活动不存在。' };
  return { ok: true, status: 200, activity: store.setActivityStatus(id, 'archived', userId) };
}

export function seedActivityCatalog(store, activities = []) {
  let created = 0;
  for (const activity of activities) {
    if (store.findActivityById(activity.id) || store.findActivityBySlug(activity.slug)) continue;
    const validation = validateActivityInput(activity);
    if (!validation.ok) continue;
    store.createActivity({ ...validation.value, id: activity.id, status: 'published' });
    created += 1;
  }
  return created;
}
