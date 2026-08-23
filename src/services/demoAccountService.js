import { createDemoAccountSeeds, demoAccountSchemaVersion, demoAccountStorageKey } from '../data/config/demoAccountSeeds.js';
import { buildCourseRoute } from '../data/courses/resourcePaths.js';
import { bodyToParagraphs } from '../utils/markdownContent.js';
import { normalizeCourseScheduleRows } from './courseScheduleService.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const maxAvatarBytes = 2 * 1024 * 1024;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function defaultStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function publicOwner(user) {
  return { publicId: user.publicId, nickname: user.nickname, avatarUrl: user.avatarUrl || '' };
}

function normalizeRowsFromWorkbook(workbook) {
  if (!Array.isArray(workbook)) return [];
  if (!workbook.length) return [];
  if (Array.isArray(workbook[0]) && !Array.isArray(workbook[0][0])) return [workbook];
  if (Array.isArray(workbook[0]) && Array.isArray(workbook[0][0])) return workbook;
  return workbook.map((sheet) => sheet?.data ?? sheet).filter(Array.isArray);
}

async function defaultActivityLoader() {
  const response = await fetch('content/activities/catalog.json');
  if (!response.ok) return [];
  return (await response.json()).activities ?? [];
}

export function createDemoAccountService({
  storage = defaultStorage(), now = () => new Date().toISOString(), activityLoader = defaultActivityLoader,
} = {}) {
  let state;
  let persistenceWarning = '';

  function read() {
    if (state) return state;
    try {
      const saved = storage?.getItem(demoAccountStorageKey);
      const parsed = saved ? JSON.parse(saved) : null;
      state = parsed?.version === demoAccountSchemaVersion ? parsed : createDemoAccountSeeds();
    } catch {
      state = createDemoAccountSeeds();
      persistenceWarning = '浏览器未允许保存演示数据，本次修改仅在当前页面有效。';
    }
    return state;
  }

  function save() {
    try {
      storage?.setItem(demoAccountStorageKey, JSON.stringify(read()));
    } catch {
      persistenceWarning = '浏览器存储空间不足，本次修改可能不会在刷新后保留。';
    }
  }

  function persist(result) {
    save();
    return persistenceWarning ? { ...result, persistenceWarning } : result;
  }

  function account(identityId) {
    return read().accounts[identityId] ?? null;
  }

  function identityByPublicId(publicId) {
    return Object.entries(read().accounts).find(([, value]) => value.user.publicId === publicId)?.[0] ?? '';
  }

  function requireAccount(identityId) {
    const value = account(identityId);
    return value ? { ok: true, value } : { ok: false, message: '演示账号不存在。' };
  }

  function nextId(prefix) {
    read().sequence += 1;
    return `demo-${prefix}-${read().sequence}`;
  }

  async function ensureActivities() {
    if (Array.isArray(read().activities)) return read().activities;
    try {
      read().activities = clone(await activityLoader()).map((item) => ({
        ...item,
        status: item.status ?? 'published',
        featured: Boolean(item.featured),
        displayOrder: Number(item.displayOrder ?? 100),
        createdAt: item.createdAt ?? now(),
        updatedAt: item.updatedAt ?? now(),
      }));
      save();
    } catch {
      read().activities = [];
    }
    return read().activities;
  }

  function privatePayload(value) {
    const comments = value.comments.map((comment) => ({ ...comment }));
    return {
      ok: true,
      user: clone(value.user),
      posts: clone(value.posts),
      submissions: clone(value.submissions),
      comments,
      courses: clone(value.courses),
      favorites: clone(value.favorites),
      notifications: clone(value.notifications),
      unreadCount: value.notifications.filter((item) => !item.readAt).length,
      persistenceWarning,
    };
  }

  function getPrivateProfile(identityId) {
    const result = requireAccount(identityId);
    return result.ok ? privatePayload(result.value) : result;
  }

  function getPublicProfile(publicId) {
    const identityId = identityByPublicId(publicId);
    const result = requireAccount(identityId);
    if (!result.ok) return { ok: false, status: 404, message: '没有找到这个演示用户。' };
    return {
      ok: true,
      profile: clone({
        publicId: result.value.user.publicId,
        nickname: result.value.user.nickname,
        avatarUrl: result.value.user.avatarUrl || '',
        avatarInitials: result.value.user.avatarInitials,
        avatarColor: result.value.user.avatarColor,
      }),
      posts: clone(result.value.posts.filter((item) => item.status === 'published')),
    };
  }

  function updateUser(identityId, changes) {
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    Object.assign(result.value.user, changes);
    return persist({ ok: true, user: clone(result.value.user) });
  }

  function updateNickname(identityId, nickname) {
    const value = String(nickname ?? '').trim();
    if (value.length < 2 || value.length > 20) return { ok: false, message: '昵称需要 2–20 个字符。' };
    if (account(identityId)?.user.verifications?.cc98) return { ok: false, message: '昵称已与 CC98 名字绑定。' };
    return updateUser(identityId, { nickname: value, avatarInitials: value.slice(0, 1) });
  }

  function removeAvatar(identityId) {
    return updateUser(identityId, { avatarUrl: '' });
  }

  async function uploadAvatar(identityId, file, reader) {
    if (!file || !imageTypes.has(file.type)) return { ok: false, message: '头像仅支持 JPG、PNG 或 WebP。' };
    if (file.size > maxAvatarBytes) return { ok: false, message: '头像文件不能超过 2 MB。' };
    try {
      const readDataUrl = reader ?? ((input) => new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = () => reject(fileReader.error);
        fileReader.readAsDataURL(input);
      }));
      return updateUser(identityId, { avatarUrl: await readDataUrl(file) });
    } catch {
      return { ok: false, message: '头像文件无法读取。' };
    }
  }

  function bindCc98(identityId, { code } = {}) {
    if (!String(code ?? '').trim()) return { ok: false, message: '请输入演示验证码。' };
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    const cc98Nickname = result.value.user.cc98Nickname !== '未绑定'
      ? result.value.user.cc98Nickname
      : `demo_${identityId}_bound`;
    return updateUser(identityId, {
      nickname: cc98Nickname,
      cc98Nickname,
      verifications: { ...result.value.user.verifications, cc98: true },
    });
  }

  function bindEmail(identityId, studentId) {
    if (!/^\d+$/.test(String(studentId ?? ''))) return { ok: false, message: '请输入纯数字学号。' };
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    return updateUser(identityId, {
      email: `${studentId}@zju.edu.cn`,
      verifications: { ...result.value.user.verifications, email: true },
    });
  }

  async function previewCourseSchedule(identityId, file, workbookReader) {
    if (!account(identityId)) return { ok: false, message: '演示账号不存在。' };
    if (!file?.name?.toLowerCase().endsWith('.xlsx')) return { ok: false, message: '课表仅支持 XLSX 文件。' };
    if (file.size > 5 * 1024 * 1024) return { ok: false, message: '课表文件不能超过 5 MB。' };
    try {
      let workbook;
      if (workbookReader) workbook = await workbookReader(file);
      else {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const sheets = await readXlsxFile(file, { getSheets: true });
        workbook = [];
        for (const sheet of sheets) workbook.push(await readXlsxFile(file, { sheet: sheet.name }));
      }
      const catalogCodes = new Set(Object.values(read().accounts).flatMap((item) => item.courses.filter((course) => course.catalogMatched).map((course) => course.courseCode)));
      for (const rows of normalizeRowsFromWorkbook(workbook)) {
        const normalized = normalizeCourseScheduleRows(rows, { catalogCodes });
        if (normalized.ok) return normalized;
      }
      return { ok: false, message: '课表缺少必要表头或没有可识别课程。' };
    } catch {
      return { ok: false, message: '课表文件无法解析，请重新导出后再试。' };
    }
  }

  function replaceCourses(identityId, courses) {
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    result.value.courses = clone(courses ?? []);
    return persist({ ok: true, courses: clone(result.value.courses) });
  }

  function addCourse(identityId, input) {
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    const course = typeof input === 'string' ? { courseCode: input, courseName: input, catalogMatched: true } : clone(input);
    if (!result.value.courses.some((item) => item.courseCode === course.courseCode)) result.value.courses.push(course);
    return persist({ ok: true, courses: clone(result.value.courses) });
  }

  function removeCourse(identityId, courseCode) {
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    result.value.courses = result.value.courses.filter((item) => item.courseCode !== courseCode);
    return persist({ ok: true, courses: clone(result.value.courses) });
  }

  function addFavorite(identityId, item) {
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    const id = item?.contentId ?? item?.id;
    if (!id) return { ok: false, message: '该内容暂时无法收藏。' };
    if (!result.value.favorites.some((favorite) => favorite.id === id)) result.value.favorites.push({ ...clone(item), id });
    return persist({ ok: true, favorites: clone(result.value.favorites) });
  }

  function removeFavorite(identityId, id) {
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    result.value.favorites = result.value.favorites.filter((item) => item.id !== id);
    return persist({ ok: true, favorites: clone(result.value.favorites) });
  }

  function getLikedContentIds(identityId) {
    return clone(account(identityId)?.likedContentIds ?? []);
  }

  function toggleLike(identityId, contentId, currentCount = 0) {
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    result.value.likedContentIds ??= [];
    const liked = !result.value.likedContentIds.includes(contentId);
    result.value.likedContentIds = liked
      ? [...result.value.likedContentIds, contentId]
      : result.value.likedContentIds.filter((id) => id !== contentId);
    return persist({ ok: true, liked, likeCount: Math.max(0, Number(currentCount ?? 0) + (liked ? 1 : -1)) });
  }

  function createSubmission(identityId, input) {
    const result = requireAccount(identityId);
    if (!result.ok) return result;
    if (!String(input?.title ?? '').trim() || !String(input?.body ?? '').trim()) return { ok: false, message: '请填写标题和正文。' };
    const submission = { ...clone(input), id: nextId('submission'), status: 'pending', reviewNote: '', createdAt: now(), submitterPublicId: result.value.user.publicId, submitterName: result.value.user.nickname };
    result.value.submissions.unshift(submission);
    account('admin').notifications.unshift({ id: nextId('notification'), title: '有新的待审核投稿', body: `${result.value.user.nickname}提交了“${submission.title}”。`, createdAt: now(), readAt: '', target: null, actor: publicOwner(result.value.user) });
    return persist({ ok: true, submission: clone(submission) });
  }

  function archivePost(identityId, id) {
    const item = account(identityId)?.posts.find((postItem) => postItem.id === id);
    if (!item) return { ok: false, message: '没有找到这篇帖子。' };
    item.status = 'archived';
    return persist({ ok: true, item: clone(item) });
  }

  function revisePost(identityId, id, changes) {
    const owner = account(identityId);
    const postItem = owner?.posts.find((item) => item.id === id);
    if (!postItem) return { ok: false, message: '没有找到这篇帖子。' };
    return createSubmission(identityId, { ...postItem, ...clone(changes), id: undefined, submissionKind: 'revision', targetContentId: id });
  }

  function updateSubmission(identityId, id, changes, allowRejected = false) {
    const item = account(identityId)?.submissions.find((entry) => entry.id === id);
    if (!item) return { ok: false, message: '没有找到这条投稿。' };
    if (item.status !== 'pending' && !(allowRejected && item.status === 'rejected')) return { ok: false, message: '当前状态不能修改。' };
    Object.assign(item, clone(changes), allowRejected ? { status: 'pending', reviewNote: '' } : {});
    return persist({ ok: true, submission: clone(item) });
  }

  function withdrawSubmission(identityId, id) {
    const item = account(identityId)?.submissions.find((entry) => entry.id === id);
    if (!item || item.status !== 'pending') return { ok: false, message: '只有审核中的投稿可以撤回。' };
    item.status = 'withdrawn';
    return persist({ ok: true, submission: clone(item) });
  }

  function deleteSubmission(identityId, id) {
    const owner = account(identityId);
    const item = owner?.submissions.find((entry) => entry.id === id);
    if (!item || !['rejected', 'withdrawn'].includes(item.status)) return { ok: false, message: '当前投稿不能删除。' };
    owner.submissions = owner.submissions.filter((entry) => entry.id !== id);
    return persist({ ok: true });
  }

  function listComments(contentId, viewerIdentityId = '') {
    const comments = Object.entries(read().accounts).flatMap(([ownerIdentityId, owner]) => owner.comments
      .filter((item) => item.contentId === contentId)
      .map((item) => ({ ...item, author: publicOwner(owner.user), canManage: ownerIdentityId === viewerIdentityId })));
    return { ok: true, comments: clone(comments) };
  }

  function createComment(identityId, contentItem, { body, parentCommentId = '' }) {
    const owner = account(identityId);
    if (!owner || !String(body ?? '').trim()) return { ok: false, message: '评论内容不能为空。' };
    const comment = { id: nextId('comment'), contentId: contentItem.contentId ?? contentItem.id, courseCode: contentItem.courseCode, type: contentItem.type, routeId: contentItem.routeId ?? contentItem.id, itemTitle: contentItem.title, body: String(body).trim(), parentCommentId, deleted: false, createdAt: now() };
    owner.comments.unshift(comment);
    return persist({ ok: true, comment: clone(comment) });
  }

  function updateComment(identityId, id, body) {
    const item = account(identityId)?.comments.find((entry) => entry.id === id);
    if (!item || item.deleted) return { ok: false, message: '没有找到可编辑的评论。' };
    if (!String(body ?? '').trim()) return { ok: false, message: '评论内容不能为空。' };
    item.body = String(body).trim();
    return persist({ ok: true, comment: clone(item) });
  }

  function deleteComment(identityId, id) {
    const item = account(identityId)?.comments.find((entry) => entry.id === id);
    if (!item) return { ok: false, message: '没有找到这条评论。' };
    item.deleted = true;
    item.body = '该评论已删除';
    return persist({ ok: true });
  }

  function markNotificationRead(identityId, id) {
    const owner = account(identityId);
    const item = owner?.notifications.find((entry) => entry.id === id);
    if (!item) return { ok: false, message: '没有找到这条消息。' };
    item.readAt ||= now();
    return persist({ ok: true, unreadCount: owner.notifications.filter((entry) => !entry.readAt).length });
  }

  function markAllNotificationsRead(identityId) {
    const owner = account(identityId);
    if (!owner) return { ok: false, message: '演示账号不存在。' };
    owner.notifications.forEach((item) => { item.readAt ||= now(); });
    return persist({ ok: true, unreadCount: 0 });
  }

  function findSubmission(id) {
    for (const [identityId, owner] of Object.entries(read().accounts)) {
      const item = owner.submissions.find((entry) => entry.id === id);
      if (item) return { identityId, owner, item };
    }
    return null;
  }

  function reviewSubmission(id, status, note = '') {
    const found = findSubmission(id);
    if (!found || found.item.status !== 'pending') return { ok: false, message: '投稿不存在或已处理。' };
    found.item.status = status;
    found.item.reviewNote = note;
    if (status === 'approved') {
      if (found.item.submissionKind === 'revision') {
        const target = found.owner.posts.find((item) => item.id === found.item.targetContentId);
        if (target) Object.assign(target, { title: found.item.title, summary: found.item.summary, body: found.item.body, status: 'published' });
      } else {
        const contentId = nextId('content');
        found.item.routeId = contentId;
        found.owner.posts.unshift({ ...clone(found.item), id: contentId, contentId, routeId: contentId, status: 'published' });
      }
    }
    const verb = status === 'approved' ? '已通过' : '未通过';
    found.owner.notifications.unshift({ id: nextId('notification'), title: `投稿${verb}`, body: `“${found.item.title}”${verb}审核。${note ? ` ${note}` : ''}`, createdAt: now(), readAt: '', target: { courseCode: found.item.courseCode, type: found.item.type, routeId: found.item.routeId ?? '' }, actor: publicOwner(account('admin').user) });
    read().auditLogs.unshift({ id: nextId('audit'), action: `submission.${status === 'approved' ? 'approve' : 'reject'}`, courseCode: found.item.courseCode, actorName: account('admin').user.nickname, targetTitle: found.item.title, subjectPublicId: found.owner.user.publicId, createdAt: now() });
    return persist({ ok: true, submission: clone(found.item) });
  }

  function createAdminClient() {
    return {
      fetchContent: async (filters = {}) => ({ ok: true, items: clone(read().adminContent.filter((item) => (!filters.courseCode || item.courseCode === filters.courseCode) && (!filters.type || item.type === filters.type) && (!filters.status || item.status === filters.status))) }),
      createContent: async (input) => { const item = { id: nextId('admin-content'), status: 'draft', ...clone(input) }; read().adminContent.unshift(item); return persist({ ok: true, item: clone(item) }); },
      updateContent: async (id, input) => { const item = read().adminContent.find((entry) => entry.id === id); if (!item) return { ok: false, message: '内容不存在。' }; Object.assign(item, clone(input)); return persist({ ok: true, item: clone(item) }); },
      publishContent: async (id) => { const item = read().adminContent.find((entry) => entry.id === id); if (!item) return { ok: false, message: '内容不存在。' }; item.status = 'published'; return persist({ ok: true, item: clone(item) }); },
      archiveContent: async (id) => { const item = read().adminContent.find((entry) => entry.id === id); if (!item) return { ok: false, message: '内容不存在。' }; item.status = 'archived'; return persist({ ok: true, item: clone(item) }); },
      uploadPdf: async (id, file) => ({ ok: Boolean(file), item: clone(read().adminContent.find((entry) => entry.id === id)), message: file ? '' : '请选择 PDF。' }),
      removePdf: async (id) => ({ ok: true, item: clone(read().adminContent.find((entry) => entry.id === id)) }),
      fetchSubmissions: async (filters = {}) => { const all = Object.values(read().accounts).flatMap((owner) => owner.submissions); const submissions = all.filter((item) => (!filters.courseCode || item.courseCode === filters.courseCode) && (!filters.status || item.status === filters.status) && (!filters.query || JSON.stringify(item).toLowerCase().includes(String(filters.query).toLowerCase()))); return { ok: true, submissions: clone(submissions), pendingCount: all.filter((item) => item.status === 'pending').length }; },
      updateSubmission: async (id, input) => { const found = findSubmission(id); if (!found) return { ok: false, message: '投稿不存在。' }; Object.assign(found.item, clone(input)); return persist({ ok: true, submission: clone(found.item) }); },
      approveSubmission: async (id) => reviewSubmission(id, 'approved'),
      rejectSubmission: async (id, note) => reviewSubmission(id, 'rejected', note),
      fetchAuditLogs: async (filters = {}) => ({ ok: true, logs: clone(read().auditLogs.filter((item) => (!filters.courseCode || item.courseCode === filters.courseCode) && (!filters.action || item.action === filters.action) && (!filters.query || JSON.stringify(item).toLowerCase().includes(String(filters.query).toLowerCase())))) }),
      fetchActivities: async (filters = {}) => {
        const all = await ensureActivities();
        return { ok: true, activities: clone(all.filter((item) => (
          (!filters.status || item.status === filters.status)
          && (!filters.category || item.category === filters.category)
          && (!filters.query || JSON.stringify(item).toLowerCase().includes(String(filters.query).toLowerCase()))
        )).sort((a, b) => a.displayOrder - b.displayOrder)) };
      },
      createActivity: async (input) => {
        const all = await ensureActivities();
        if (all.some((item) => item.slug === input.slug)) return { ok: false, message: '活动链接标识已存在。' };
        const activity = { id: nextId('activity'), status: 'draft', createdAt: now(), updatedAt: now(), ...clone(input) };
        all.push(activity);
        read().auditLogs.unshift({ id: nextId('audit'), action: 'activity.create', targetTitle: activity.title, actorName: account('admin').user.nickname, courseCode: '', createdAt: now() });
        return persist({ ok: true, activity: clone(activity) });
      },
      updateActivity: async (id, input) => {
        const all = await ensureActivities();
        const activity = all.find((item) => item.id === id);
        if (!activity) return { ok: false, message: '活动不存在。' };
        if (all.some((item) => item.id !== id && item.slug === input.slug)) return { ok: false, message: '活动链接标识已存在。' };
        Object.assign(activity, clone(input), { updatedAt: now() });
        read().auditLogs.unshift({ id: nextId('audit'), action: 'activity.update', targetTitle: activity.title, actorName: account('admin').user.nickname, courseCode: '', createdAt: now() });
        return persist({ ok: true, activity: clone(activity) });
      },
      publishActivity: async (id) => {
        const activity = (await ensureActivities()).find((item) => item.id === id);
        if (!activity) return { ok: false, message: '活动不存在。' };
        activity.status = 'published'; activity.updatedAt = now();
        read().auditLogs.unshift({ id: nextId('audit'), action: 'activity.publish', targetTitle: activity.title, actorName: account('admin').user.nickname, courseCode: '', createdAt: now() });
        return persist({ ok: true, activity: clone(activity) });
      },
      archiveActivity: async (id) => {
        const activity = (await ensureActivities()).find((item) => item.id === id);
        if (!activity) return { ok: false, message: '活动不存在。' };
        activity.status = 'archived'; activity.updatedAt = now();
        read().auditLogs.unshift({ id: nextId('audit'), action: 'activity.archive', targetTitle: activity.title, actorName: account('admin').user.nickname, courseCode: '', createdAt: now() });
        return persist({ ok: true, activity: clone(activity) });
      },
    };
  }

  function createPublicActivityClient() {
    return {
      async fetchActivities({ featured = false } = {}) {
        const activities = (await ensureActivities())
          .filter((item) => item.status === 'published' && (!featured || item.featured))
          .sort((a, b) => a.displayOrder - b.displayOrder);
        return { ok: true, activities: clone(activities) };
      },
    };
  }

  function getPublishedCourseContent(courseCode) {
    const grouped = { experiences: [], materials: [], papers: [] };
    const collectionByType = { experience: 'experiences', material: 'materials', paper: 'papers' };
    for (const owner of Object.values(read().accounts)) {
      for (const postItem of owner.posts.filter((item) => item.status === 'published' && item.courseCode === courseCode)) {
        const collection = collectionByType[postItem.type];
        if (!collection) continue;
        grouped[collection].push({
          ...clone(postItem),
          contentId: postItem.contentId ?? postItem.id,
          routeId: postItem.routeId ?? postItem.id,
          author: postItem.author || owner.user.nickname,
          owner: publicOwner(owner.user),
          likeCount: postItem.likeCount ?? 0,
          viewerLiked: false,
          href: buildCourseRoute(postItem.courseCode, collection, postItem.routeId ?? postItem.id),
          paragraphs: bodyToParagraphs(postItem.body ?? ''),
        });
      }
    }
    for (const item of read().adminContent.filter((entry) => entry.status === 'published' && entry.courseCode === courseCode)) {
      const collection = collectionByType[item.type];
      if (!collection) continue;
      grouped[collection].push({
        ...clone(item),
        contentId: item.id,
        routeId: item.routeId ?? item.id,
        author: item.author || account('admin').user.nickname,
        owner: publicOwner(account('admin').user),
        likeCount: item.likeCount ?? 0,
        viewerLiked: false,
        href: buildCourseRoute(item.courseCode, collection, item.routeId ?? item.id),
        paragraphs: bodyToParagraphs(item.body ?? ''),
      });
    }
    return grouped;
  }

  function resetAccount(identityId) {
    if (!account(identityId)) return { ok: false, message: '演示账号不存在。' };
    const seeds = createDemoAccountSeeds();
    const publicId = read().accounts[identityId].user.publicId;
    read().accounts[identityId] = seeds.accounts[identityId];
    read().auditLogs = read().auditLogs.filter((item) => item.subjectPublicId !== publicId);
    if (identityId !== 'admin') {
      const admin = read().accounts.admin;
      admin.notifications = admin.notifications.filter((item) => item.actor?.publicId !== publicId);
      admin.notifications.push(...seeds.accounts.admin.notifications.filter((item) => item.actor?.publicId === publicId));
    } else {
      delete read().activities;
    }
    return persist({ ok: true, ...privatePayload(read().accounts[identityId]) });
  }

  return {
    getIdentityByPublicId: identityByPublicId,
    getUser: (identityId) => clone(account(identityId)?.user ?? null),
    getPrivateProfile,
    getPublicProfile,
    updateNickname,
    uploadAvatar,
    removeAvatar,
    bindCc98,
    bindEmail,
    previewCourseSchedule,
    replaceCourses,
    addCourse,
    removeCourse,
    addFavorite,
    removeFavorite,
    getLikedContentIds,
    toggleLike,
    createSubmission,
    archivePost,
    revisePost,
    updateSubmission,
    resubmitSubmission: (identityId, id, changes) => updateSubmission(identityId, id, changes, true),
    withdrawSubmission,
    deleteSubmission,
    listComments,
    createComment,
    updateComment,
    deleteComment,
    markNotificationRead,
    markAllNotificationsRead,
    createAdminClient,
    createPublicActivityClient,
    getPublishedCourseContent,
    resetAccount,
  };
}

export const demoAccountService = createDemoAccountService();
