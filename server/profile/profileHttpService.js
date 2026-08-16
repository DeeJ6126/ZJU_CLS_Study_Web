import { publicUser, validateNickname } from '../authService.js';
import { toPublicContentItem } from '../content/contentService.js';
import {
  createRevisionSubmission,
  createSubmission,
  updateSubmission,
} from '../content/submissionService.js';
import { removeStoredFile } from '../content/contentFileService.js';

function publicProfile(user) {
  if (!user) return null;
  return {
    publicId: user.publicId,
    nickname: user.nickname,
    avatarUrl: user.avatarStoredName
      ? `/api/profile-avatars/${encodeURIComponent(user.avatarStoredName)}`
      : '',
  };
}

function owns(userId, record) {
  return Boolean(userId && record && record.ownerId === userId);
}

export async function handleProfileHttpRequest({
  request,
  response,
  url,
  sessionId,
  user,
  userId,
  authStore,
  contentStore,
  sendJson,
  readJsonBody,
  visitorId = '',
  uploadDirectory = '',
}) {
  if (request.method === 'GET' && url.pathname === '/api/profiles') {
    const query = url.searchParams.get('query') ?? '';
    const profiles = authStore.searchUsersByNickname(query).map(publicProfile);
    sendJson(response, 200, { profiles });
    return true;
  }

  const publicProfileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (request.method === 'GET' && publicProfileMatch) {
    const target = authStore.findUserByPublicId(decodeURIComponent(publicProfileMatch[1]));
    if (!target) {
      sendJson(response, 404, { message: '用户不存在。' });
      return true;
    }
    const owner = publicProfile(target);
    const posts = contentStore.listPublishedByOwner(target.id).map((item) => (
      toPublicContentItem(item, contentStore.getLikeState(item.id, visitorId), owner)
    ));
    sendJson(response, 200, { profile: owner, posts });
    return true;
  }

  if (!url.pathname.startsWith('/api/account/profile')
    && !url.pathname.startsWith('/api/account/posts')
    && !url.pathname.startsWith('/api/account/submissions')) {
    return false;
  }
  if (!userId) {
    sendJson(response, 401, { message: '请先登录账号。' });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/account/profile') {
    const comments = contentStore.listCommentsByAuthor(userId).map((comment) => {
      const item = contentStore.findById(comment.contentId);
      return {
        ...comment,
        itemTitle: item?.title ?? '内容已移除',
        courseCode: item?.courseCode ?? '',
        type: item?.type ?? '',
        routeId: item?.routeId ?? '',
      };
    });
    sendJson(response, 200, {
      user,
      posts: contentStore.listByOwner(userId),
      submissions: contentStore.listSubmissionsBySubmitter(userId),
      comments,
    });
    return true;
  }

  if (request.method === 'PATCH' && url.pathname === '/api/account/profile') {
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { message: '资料修改请求格式无效。' });
      return true;
    }
    const current = authStore.findUserById(userId);
    if (current.cc98Name) {
      sendJson(response, 409, { message: '已绑定 CC98 的账号昵称必须与 CC98 名字一致。' });
      return true;
    }
    const body = await readJsonBody(request);
    const nickname = String(body.nickname ?? '').trim();
    if (!validateNickname(nickname)) {
      sendJson(response, 400, { message: '昵称需为 2 至 20 位中文、字母、数字、下划线或连字符。' });
      return true;
    }
    const existing = authStore.findUserByNickname(nickname);
    if (existing && existing.id !== userId) {
      sendJson(response, 409, { message: '该昵称已被使用。' });
      return true;
    }
    authStore.updateProfile(userId, { nickname });
    sendJson(response, 200, { user: publicUser(authStore.findUserById(userId)) });
    return true;
  }

  const revisionMatch = url.pathname.match(/^\/api\/account\/posts\/([^/]+)\/revisions$/);
  if (request.method === 'POST' && revisionMatch) {
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { message: '帖子修改请求格式无效。' });
      return true;
    }
    const result = createRevisionSubmission(
      contentStore,
      decodeURIComponent(revisionMatch[1]),
      await readJsonBody(request),
      { id: userId, nickname: user.nickname, cc98Nickname: user.cc98Nickname },
    );
    sendJson(response, result.status, result.ok
      ? { submission: result.submission }
      : { message: result.message });
    return true;
  }

  const archiveMatch = url.pathname.match(/^\/api\/account\/posts\/([^/]+)\/archive$/);
  if (request.method === 'POST' && archiveMatch) {
    const id = decodeURIComponent(archiveMatch[1]);
    const item = contentStore.findById(id);
    if (!item) {
      sendJson(response, 404, { message: '帖子不存在。' });
      return true;
    }
    if (!owns(userId, item)) {
      sendJson(response, 403, { message: '不能下架他人的帖子。' });
      return true;
    }
    const archived = contentStore.setStatus(id, 'archived', userId);
    contentStore.createAuditLog({
      action: 'content.owner.archive',
      entityType: 'content',
      entityId: item.id,
      targetTitle: item.title,
      courseCode: item.courseCode,
      actorId: userId,
      actorName: user.nickname,
      detail: '作者主动下架',
    });
    sendJson(response, 200, { item: archived });
    return true;
  }

  const resubmitMatch = url.pathname.match(/^\/api\/account\/submissions\/([^/]+)\/resubmit$/);
  if (request.method === 'POST' && resubmitMatch) {
    const previous = contentStore.findSubmissionById(decodeURIComponent(resubmitMatch[1]));
    if (!previous) {
      sendJson(response, 404, { message: '投稿不存在。' });
      return true;
    }
    if (previous.submitterId !== userId) {
      sendJson(response, 403, { message: '不能重新提交他人的内容。' });
      return true;
    }
    if (previous.status !== 'rejected') {
      sendJson(response, 409, { message: '只有未通过的投稿可以重新提交。' });
      return true;
    }
    const changes = String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')
      ? await readJsonBody(request)
      : {};
    const result = createSubmission(contentStore, { ...previous, ...changes }, {
      id: userId,
      nickname: user.nickname,
      cc98Nickname: user.cc98Nickname,
    });
    sendJson(response, result.status, result.ok
      ? { submission: result.submission }
      : { message: result.message });
    return true;
  }

  const submissionMatch = url.pathname.match(/^\/api\/account\/submissions\/([^/]+)$/);
  if ((request.method === 'PATCH' || request.method === 'DELETE') && submissionMatch) {
    const id = decodeURIComponent(submissionMatch[1]);
    const submission = contentStore.findSubmissionById(id);
    if (!submission) {
      sendJson(response, 404, { message: '投稿不存在。' });
      return true;
    }
    if (submission.submitterId !== userId) {
      sendJson(response, 403, { message: '不能管理他人的投稿。' });
      return true;
    }
    if (request.method === 'PATCH') {
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        sendJson(response, 415, { message: '投稿修改请求格式无效。' });
        return true;
      }
      const result = updateSubmission(contentStore, id, await readJsonBody(request), {
        id: userId, nickname: user.nickname, cc98Nickname: user.cc98Nickname,
      });
      sendJson(response, result.status, result.ok ? { submission: result.submission } : { message: result.message });
      return true;
    }
    if (!['rejected', 'withdrawn'].includes(submission.status)) {
      sendJson(response, 409, { message: '只有未通过或已撤回的投稿可以删除。' });
      return true;
    }
    const removed = contentStore.deleteSubmission(id);
    if (removed.file?.storedName && uploadDirectory) removeStoredFile(uploadDirectory, removed.file.storedName);
    sendJson(response, 200, { ok: true });
    return true;
  }

  const withdrawMatch = url.pathname.match(/^\/api\/account\/submissions\/([^/]+)\/withdraw$/);
  if (request.method === 'POST' && withdrawMatch) {
    const submission = contentStore.findSubmissionById(decodeURIComponent(withdrawMatch[1]));
    if (!submission) {
      sendJson(response, 404, { message: '投稿不存在。' });
      return true;
    }
    if (submission.submitterId !== userId) {
      sendJson(response, 403, { message: '不能撤回他人的投稿。' });
      return true;
    }
    if (submission.status !== 'pending') {
      sendJson(response, 409, { message: '只有待审核投稿可以撤回。' });
      return true;
    }
    const withdrawn = contentStore.setSubmissionStatus(submission.id, 'withdrawn', {
      id: userId, cc98Nickname: user.cc98Nickname,
    }, {});
    sendJson(response, 200, { submission: withdrawn });
    return true;
  }

  sendJson(response, 404, { message: '个人账号接口不存在。' });
  return true;
}
