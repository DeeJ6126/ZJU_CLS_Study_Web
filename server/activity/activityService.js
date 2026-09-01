import { randomUUID } from 'node:crypto';

const programs = new Map([
  ['academic-voyage', 'frontier'],
  ['laboratory-open-day', 'frontier'],
  ['major-festival', 'learning'],
  ['peer-learning', 'learning'],
  ['beautiful-trio', 'community'],
  ['joint-activities', 'exchange'],
]);

function clean(value) {
  return String(value ?? '').trim();
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isSafeImageUrl(value) {
  return value.startsWith('/assets/activities/') || isHttpUrl(value);
}

export function validateActivityInput(input, { partial = false, current = null } = {}) {
  const data = partial ? { ...current, ...input } : input;
  const title = clean(data.title);
  const programId = clean(data.programId);
  const imageUrl = clean(data.imageUrl);
  const externalUrl = clean(data.externalUrl);

  if (!title || title.length > 120) {
    return { ok: false, status: 400, message: '请填写不超过 120 个字的推文标题。' };
  }
  if (!programs.has(programId)) {
    return { ok: false, status: 400, message: '请选择有效的活动板块。' };
  }
  if (!imageUrl || !isSafeImageUrl(imageUrl)) {
    return { ok: false, status: 400, message: '请填写有效的封面地址。' };
  }
  if (!isHttpUrl(externalUrl)) {
    return { ok: false, status: 400, message: '请填写有效的推文链接。' };
  }

  return {
    ok: true,
    value: {
      slug: clean(data.slug) || `post-${randomUUID()}`,
      title,
      programId,
      category: programs.get(programId),
      imageUrl,
      imageAlt: `${title}封面`,
      externalUrl,
      summary: '',
      body: '',
      featured: true,
      displayOrder: 100,
    },
  };
}

export function toPublicActivity(activity) {
  return {
    id: activity.id,
    slug: activity.slug,
    title: activity.title,
    programId: activity.programId,
    category: activity.category,
    imageUrl: activity.imageUrl,
    imageAlt: activity.imageAlt,
    externalUrl: activity.externalUrl,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  };
}

function duplicateLink(store, externalUrl, ignoredId = '') {
  return store.listAdminActivities({}).some(
    (activity) => activity.id !== ignoredId && activity.externalUrl === externalUrl,
  );
}

export function createActivity(store, input, userId) {
  const validation = validateActivityInput(input);
  if (!validation.ok) return validation;
  if (duplicateLink(store, validation.value.externalUrl)) {
    return { ok: false, status: 409, message: '这篇推文已经在活动目录中。' };
  }
  return {
    ok: true,
    status: 201,
    activity: store.createActivity({
      ...validation.value, status: 'published', createdBy: userId, updatedBy: userId,
    }),
  };
}

export function updateActivity(store, id, input, userId) {
  const current = store.findActivityById(id);
  if (!current || !current.externalUrl) return { ok: false, status: 404, message: '推文不存在。' };
  const validation = validateActivityInput(input, { partial: true, current });
  if (!validation.ok) return validation;
  if (duplicateLink(store, validation.value.externalUrl, id)) {
    return { ok: false, status: 409, message: '这篇推文已经在活动目录中。' };
  }
  return {
    ok: true,
    status: 200,
    activity: store.updateActivity(id, { ...validation.value, updatedBy: userId }),
  };
}

export function publishActivity(store, id, userId) {
  const activity = store.findActivityById(id);
  if (!activity || !activity.externalUrl) return { ok: false, status: 404, message: '推文不存在。' };
  return { ok: true, status: 200, activity: store.setActivityStatus(id, 'published', userId) };
}

export function archiveActivity(store, id, userId) {
  const activity = store.findActivityById(id);
  if (!activity || !activity.externalUrl) return { ok: false, status: 404, message: '推文不存在。' };
  return { ok: true, status: 200, activity: store.setActivityStatus(id, 'archived', userId) };
}

export function seedActivityCatalog(store, activities = []) {
  let created = 0;
  for (const activity of activities.filter((item) => item.externalUrl && item.programId)) {
    if (store.findActivityById(activity.id) || store.findActivityBySlug(activity.slug)) continue;
    const validation = validateActivityInput(activity);
    if (!validation.ok) continue;
    store.createActivity({ ...validation.value, id: activity.id, status: 'published' });
    created += 1;
  }
  return created;
}
