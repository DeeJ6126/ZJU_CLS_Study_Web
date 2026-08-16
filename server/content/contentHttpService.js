import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';

import {
  archiveContentItem,
  createContentItem,
  publishContentItem,
  toPublicContentItem,
  updateContentItem,
} from './contentService.js';
import { maxPdfBytes, removeStoredFile, savePdfFile } from './contentFileService.js';
import {
  approveSubmission,
  createSubmission,
  rejectSubmission,
  updateSubmission,
} from './submissionService.js';
import { createComment, deleteComment, updateComment } from './commentService.js';

async function readBuffer(request, limit) {
  const declaredLength = Number(request.headers['content-length'] ?? 0);
  if (declaredLength > limit) {
    return { ok: false, status: 413, message: '上传文件过大。' };
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      return { ok: false, status: 413, message: '上传文件过大。' };
    }
    chunks.push(chunk);
  }
  return { ok: true, buffer: Buffer.concat(chunks) };
}

function sendResult(sendJson, response, result) {
  if (!result.ok) {
    sendJson(response, result.status, { message: result.message });
    return;
  }
  sendJson(response, result.status, { item: result.item });
}

function authorizeAdmin(sendJson, response, user) {
  if (!user || user.role === 'guest') {
    sendJson(response, 401, { message: '请先登录管理员账号。' });
    return false;
  }
  if (user.role !== 'admin') {
    sendJson(response, 403, { message: '当前账号没有管理权限。' });
    return false;
  }
  return true;
}

function acceptsAdminMutation(request, { upload = false } = {}) {
  if (upload) {
    return request.headers['x-admin-upload'] === 'course-content';
  }
  return String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json');
}

function decodedFileName(value) {
  try {
    return decodeURIComponent(String(value ?? 'document.pdf'));
  } catch {
    return 'document.pdf';
  }
}

function actorFrom(user, userId) {
  return {
    id: userId,
    nickname: user?.nickname ?? '',
    cc98Nickname: user?.cc98Nickname ?? '',
  };
}

function publicOwner(user) {
  if (!user) return null;
  return {
    publicId: user.publicId,
    nickname: user.nickname,
    avatarUrl: user.avatarStoredName
      ? `/api/profile-avatars/${encodeURIComponent(user.avatarStoredName)}`
      : '',
  };
}

function publicComment(comment, authStore, viewer = null) {
  return {
    ...comment,
    author: publicOwner(authStore.findUserById(comment.authorId)),
    canManage: Boolean(viewer?.id && (viewer.id === comment.authorId || viewer.role === 'admin')),
  };
}

function logAdminAction(store, action, item, actor, detail = '') {
  store.createAuditLog({
    action,
    entityType: 'content',
    entityId: item.id,
    targetTitle: item.title,
    courseCode: item.courseCode,
    actorId: actor.id,
    actorName: actor.cc98Nickname,
    detail,
  });
}

export async function handleContentHttpRequest({
  request,
  response,
  url,
  user,
  userId,
  contentStore,
  authStore,
  uploadDirectory,
  sendJson,
  readJsonBody,
  visitorId = '',
}) {
  const actor = actorFrom(user, userId);
  const commentListMatch = url.pathname.match(/^\/api\/content\/items\/([^/]+)\/comments$/);
  if (request.method === 'GET' && commentListMatch) {
    const contentId = decodeURIComponent(commentListMatch[1]);
    const item = contentStore.findById(contentId);
    if (!item || item.status !== 'published') {
      sendJson(response, 404, { message: '内容不存在。' });
      return true;
    }
    sendJson(response, 200, {
      comments: contentStore.listComments(contentId).map((comment) => publicComment(comment, authStore, {
        id: userId,
        role: user?.role,
      })),
    });
    return true;
  }
  if (request.method === 'POST' && commentListMatch) {
    if (!userId) {
      sendJson(response, 401, { message: '请先登录后评论。' });
      return true;
    }
    if (!user?.verifications?.cc98 && !user?.verifications?.email && user?.role !== 'admin') {
      sendJson(response, 403, { message: '完成 CC98 或浙大邮箱认证后才可以评论。' });
      return true;
    }
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { message: '评论请求格式无效。' });
      return true;
    }
    const contentId = decodeURIComponent(commentListMatch[1]);
    const body = await readJsonBody(request);
    const result = createComment(contentStore, { contentId, user: { id: userId }, ...body });
    if (!result.ok) {
      sendJson(response, result.status, { message: result.message });
      return true;
    }
    const item = contentStore.findById(contentId);
    if (result.comment.parentCommentId) {
      const parent = contentStore.findCommentById(result.comment.parentCommentId);
      if (parent?.authorId && parent.authorId !== userId) {
        authStore.createNotification({
          userId: parent.authorId, type: 'comment.reply', actorId: userId,
          contentId, commentId: result.comment.id, title: '评论收到回复',
          body: `${user.nickname} 回复了你的评论。`,
        });
      }
    } else if (item.ownerId && item.ownerId !== userId) {
      authStore.createNotification({
        userId: item.ownerId, type: 'content.comment', actorId: userId,
        contentId, commentId: result.comment.id, title: '帖子收到新评论',
        body: `${user.nickname} 评论了「${item.title}」。`,
      });
    }
    sendJson(response, 201, { comment: publicComment(result.comment, authStore, { id: userId, role: user.role }) });
    return true;
  }

  const commentMatch = url.pathname.match(/^\/api\/comments\/([^/]+)$/);
  if ((request.method === 'PATCH' || request.method === 'DELETE') && commentMatch) {
    if (!userId) {
      sendJson(response, 401, { message: '请先登录后管理评论。' });
      return true;
    }
    const id = decodeURIComponent(commentMatch[1]);
    const result = request.method === 'PATCH'
      ? updateComment(contentStore, id, { id: userId, role: user.role }, (await readJsonBody(request)).body)
      : deleteComment(contentStore, id, { id: userId, role: user.role });
    sendJson(response, result.status, result.ok
      ? { comment: publicComment(result.comment, authStore, { id: userId, role: user.role }) }
      : { message: result.message });
    return true;
  }

  const publicCourseMatch = url.pathname.match(/^\/api\/content\/courses\/([^/]+)$/);
  if (request.method === 'GET' && publicCourseMatch) {
    const courseCode = decodeURIComponent(publicCourseMatch[1]);
    sendJson(response, 200, {
      items: contentStore.listPublishedByCourse(courseCode).map((item) => (
        toPublicContentItem(
          item,
          contentStore.getLikeState(item.id, visitorId),
          publicOwner(item.ownerId ? authStore?.findUserById(item.ownerId) : null),
        )
      )),
    });
    return true;
  }

  const publicFileMatch = url.pathname.match(/^\/api\/content\/files\/([^/]+)$/);
  if (request.method === 'GET' && publicFileMatch) {
    const item = contentStore.findById(decodeURIComponent(publicFileMatch[1]));
    if (!item || item.status !== 'published' || !item.file?.storedName) {
      sendJson(response, 404, { message: '文件不存在。' });
      return true;
    }
    const storedName = basename(item.file.storedName);
    if (storedName !== item.file.storedName) {
      sendJson(response, 404, { message: '文件不存在。' });
      return true;
    }
    try {
      const file = readFileSync(join(uploadDirectory, storedName));
      response.writeHead(200, {
        'content-type': 'application/pdf',
        'content-length': file.length,
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(item.file.fileName)}`,
        'x-content-type-options': 'nosniff',
      });
      response.end(file);
    } catch {
      sendJson(response, 404, { message: '文件不存在。' });
    }
    return true;
  }

  const likeMatch = url.pathname.match(/^\/api\/content\/([^/]+)\/like$/);
  if (request.method === 'POST' && likeMatch) {
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { message: '点赞请求格式无效。' });
      return true;
    }
    const item = contentStore.findById(decodeURIComponent(likeMatch[1]));
    if (!item || item.status !== 'published') {
      sendJson(response, 404, { message: '内容不存在。' });
      return true;
    }
    const resolvedVisitorId = visitorId || randomUUID();
    const result = contentStore.toggleLike(item.id, resolvedVisitorId);
    sendJson(response, 200, result, visitorId ? {} : {
      'set-cookie': `study_visitor=${encodeURIComponent(resolvedVisitorId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/submissions') {
    if (!userId) {
      sendJson(response, 401, { message: '请先登录后投稿。' });
      return true;
    }
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { message: '投稿请求格式无效。' });
      return true;
    }
    const result = createSubmission(contentStore, await readJsonBody(request), actor);
    sendJson(response, result.status, result.ok ? { submission: result.submission } : { message: result.message });
    return true;
  }

  const submissionFileMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/file$/);
  if (request.method === 'PUT' && submissionFileMatch) {
    if (!userId) {
      sendJson(response, 401, { message: '请先登录后上传文件。' });
      return true;
    }
    const submission = contentStore.findSubmissionById(decodeURIComponent(submissionFileMatch[1]));
    if (!submission || submission.submitterId !== userId || submission.status !== 'pending') {
      sendJson(response, submission ? 403 : 404, { message: submission ? '不能修改该投稿。' : '投稿不存在。' });
      return true;
    }
    if (request.headers['x-submission-upload'] !== 'course-content') {
      sendJson(response, 415, { message: '投稿文件请求格式无效。' });
      return true;
    }
    const body = await readBuffer(request, maxPdfBytes);
    if (!body.ok) {
      sendJson(response, body.status, { message: body.message });
      return true;
    }
    const saved = savePdfFile({
      buffer: body.buffer,
      fileName: decodedFileName(request.headers['x-file-name']),
      mimeType: String(request.headers['content-type'] ?? '').toLowerCase(),
      uploadDirectory,
    });
    if (!saved.ok) {
      sendJson(response, saved.status, { message: saved.message });
      return true;
    }
    if (submission.file?.storedName) removeStoredFile(uploadDirectory, submission.file.storedName);
    sendJson(response, 201, { submission: contentStore.attachSubmissionFile(submission.id, saved.file) });
    return true;
  }

  if (!url.pathname.startsWith('/api/admin/content')
    && !url.pathname.startsWith('/api/admin/submissions')
    && url.pathname !== '/api/admin/audit-logs') {
    return false;
  }
  if (!authorizeAdmin(sendJson, response, user)) {
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/submissions') {
    sendJson(response, 200, {
      submissions: contentStore.listSubmissions({
        courseCode: url.searchParams.get('courseCode') ?? '',
        type: url.searchParams.get('type') ?? '',
        status: url.searchParams.get('status') ?? '',
        query: url.searchParams.get('query') ?? '',
      }),
      pendingCount: contentStore.listSubmissions({ status: 'pending' }).length,
    });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/audit-logs') {
    sendJson(response, 200, {
      logs: contentStore.listAuditLogs({
        action: url.searchParams.get('action') ?? '',
        courseCode: url.searchParams.get('courseCode') ?? '',
        query: url.searchParams.get('query') ?? '',
      }),
    });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/content') {
    sendJson(response, 200, {
      items: contentStore.listAdmin({
        courseCode: url.searchParams.get('courseCode') ?? '',
        type: url.searchParams.get('type') ?? '',
        status: url.searchParams.get('status') ?? '',
      }),
    });
    return true;
  }

  if (!acceptsAdminMutation(request, { upload: request.method === 'PUT' })) {
    sendJson(response, 415, { message: '管理写操作的请求格式无效。' });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/content') {
    const result = createContentItem(contentStore, await readJsonBody(request), userId);
    if (result.ok) logAdminAction(contentStore, 'content.create', result.item, actor, '新建内容草稿');
    sendResult(sendJson, response, result);
    return true;
  }

  const itemMatch = url.pathname.match(/^\/api\/admin\/content\/([^/]+)$/);
  if (request.method === 'PATCH' && itemMatch) {
    const result = updateContentItem(
      contentStore,
      decodeURIComponent(itemMatch[1]),
      await readJsonBody(request),
      userId,
    );
    if (result.ok) logAdminAction(contentStore, 'content.update', result.item, actor, '编辑内容');
    sendResult(sendJson, response, result);
    return true;
  }

  const statusMatch = url.pathname.match(/^\/api\/admin\/content\/([^/]+)\/(publish|archive)$/);
  if (request.method === 'POST' && statusMatch) {
    const id = decodeURIComponent(statusMatch[1]);
    const result = statusMatch[2] === 'publish'
      ? publishContentItem(contentStore, id, userId)
      : archiveContentItem(contentStore, id, userId);
    if (result.ok) logAdminAction(contentStore, `content.${statusMatch[2]}`, result.item, actor);
    sendResult(sendJson, response, result);
    return true;
  }

  const fileMatch = url.pathname.match(/^\/api\/admin\/content\/([^/]+)\/file$/);
  if (fileMatch && request.method === 'PUT') {
    const id = decodeURIComponent(fileMatch[1]);
    const item = contentStore.findById(id);
    if (!item || !['material', 'paper'].includes(item.type)) {
      sendJson(response, item ? 400 : 404, { message: item ? '该内容类型不能上传 PDF。' : '内容不存在。' });
      return true;
    }
    const body = await readBuffer(request, maxPdfBytes);
    if (!body.ok) {
      sendJson(response, body.status, { message: body.message });
      return true;
    }
    const saved = savePdfFile({
      buffer: body.buffer,
      fileName: decodedFileName(request.headers['x-file-name']),
      mimeType: String(request.headers['content-type'] ?? '').toLowerCase(),
      uploadDirectory,
    });
    if (!saved.ok) {
      sendJson(response, saved.status, { message: saved.message });
      return true;
    }
    if (item.file?.storedName) {
      removeStoredFile(uploadDirectory, item.file.storedName);
    }
    const next = contentStore.attachFile(id, {
      ...saved.file,
      url: `/api/content/files/${encodeURIComponent(id)}`,
    }, userId);
    logAdminAction(contentStore, 'content.file.upload', next, actor, saved.file.fileName);
    sendJson(response, 201, { item: next });
    return true;
  }

  if (fileMatch && request.method === 'DELETE') {
    const id = decodeURIComponent(fileMatch[1]);
    const item = contentStore.findById(id);
    if (!item) {
      sendJson(response, 404, { message: '内容不存在。' });
      return true;
    }
    if (item.type === 'paper' && item.status === 'published') {
      sendJson(response, 400, { message: '请先下架试卷，再移除 PDF。' });
      return true;
    }
    if (item.file?.storedName) {
      removeStoredFile(uploadDirectory, item.file.storedName);
    }
    const next = contentStore.removeFile(id, userId);
    logAdminAction(contentStore, 'content.file.remove', next, actor, item.file?.fileName ?? '');
    sendJson(response, 200, { item: next });
    return true;
  }

  const adminSubmissionMatch = url.pathname.match(/^\/api\/admin\/submissions\/([^/]+)$/);
  if (request.method === 'PATCH' && adminSubmissionMatch) {
    const result = updateSubmission(
      contentStore, decodeURIComponent(adminSubmissionMatch[1]), await readJsonBody(request), actor,
    );
    sendJson(response, result.status, result.ok ? { submission: result.submission } : { message: result.message });
    return true;
  }

  const reviewMatch = url.pathname.match(/^\/api\/admin\/submissions\/([^/]+)\/(approve|reject)$/);
  if (request.method === 'POST' && reviewMatch) {
    const body = await readJsonBody(request);
    const result = reviewMatch[2] === 'approve'
      ? approveSubmission(contentStore, decodeURIComponent(reviewMatch[1]), actor)
      : rejectSubmission(contentStore, decodeURIComponent(reviewMatch[1]), actor, body.note);
    if (result.ok && result.submission?.submitterId) {
      const approved = reviewMatch[2] === 'approve';
      const revision = result.submission.submissionKind === 'revision';
      authStore.createNotification({
        userId: result.submission.submitterId,
        type: `${revision ? 'revision' : 'submission'}.${approved ? 'approved' : 'rejected'}`,
        actorId: userId,
        contentId: result.item?.id ?? result.submission.targetContentId ?? '',
        submissionId: result.submission.id,
        title: approved ? (revision ? '帖子修改已通过' : '投稿已通过') : (revision ? '帖子修改未通过' : '投稿未通过'),
        body: approved
          ? `「${result.submission.title}」已通过审核。`
          : `「${result.submission.title}」未通过审核${result.submission.reviewNote ? `：${result.submission.reviewNote}` : '。'}`,
      });
    }
    sendJson(response, result.status, result.ok
      ? { submission: result.submission, ...(result.item ? { item: result.item } : {}) }
      : { message: result.message });
    return true;
  }

  sendJson(response, 404, { message: '管理接口不存在。' });
  return true;
}
