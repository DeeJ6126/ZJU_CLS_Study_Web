function clean(value) {
  return String(value ?? '').trim();
}

function validateBody(body) {
  const value = clean(body);
  if (!value || value.length > 1000) {
    return { ok: false, status: 400, message: '评论需为 1 至 1000 个字符。' };
  }
  return { ok: true, value };
}

export function createComment(store, { contentId, user, body, parentCommentId = '' }) {
  if (!user?.id) return { ok: false, status: 401, message: '请先登录后评论。' };
  const item = store.findById(contentId);
  if (!item || item.status !== 'published') return { ok: false, status: 404, message: '内容不存在。' };
  const validation = validateBody(body);
  if (!validation.ok) return validation;
  let rootParentId = '';
  if (parentCommentId) {
    const parent = store.findCommentById(parentCommentId);
    if (!parent || parent.contentId !== contentId || parent.deleted) {
      return { ok: false, status: 404, message: '回复的评论不存在。' };
    }
    rootParentId = parent.parentCommentId || parent.id;
  }
  if (store.hasRecentDuplicateComment(user.id, contentId, validation.value)) {
    return { ok: false, status: 429, message: '请勿重复发布相同评论。' };
  }
  if (store.countRecentComments(user.id) >= 10) {
    return { ok: false, status: 429, message: '评论发布过于频繁，请稍后再试。' };
  }
  return {
    ok: true,
    status: 201,
    comment: store.createComment({
      contentId,
      authorId: user.id,
      parentCommentId: rootParentId,
      body: validation.value,
    }),
  };
}

export function updateComment(store, id, user, body) {
  const comment = store.findCommentById(id);
  if (!comment) return { ok: false, status: 404, message: '评论不存在。' };
  if (comment.authorId !== user?.id) return { ok: false, status: 403, message: '不能编辑他人的评论。' };
  if (comment.deleted) return { ok: false, status: 409, message: '已删除的评论不能编辑。' };
  const validation = validateBody(body);
  if (!validation.ok) return validation;
  return { ok: true, status: 200, comment: store.updateComment(id, validation.value) };
}

export function deleteComment(store, id, user) {
  const comment = store.findCommentById(id);
  if (!comment) return { ok: false, status: 404, message: '评论不存在。' };
  if (comment.authorId !== user?.id && user?.role !== 'admin') {
    return { ok: false, status: 403, message: '不能删除他人的评论。' };
  }
  return { ok: true, status: 200, comment: store.softDeleteComment(id) };
}
