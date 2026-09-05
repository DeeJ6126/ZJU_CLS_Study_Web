import { validateContentInput } from './contentService.js';

const GRADE_TABLE = [
  { min: 95, max: 100, score: 5.0 },
  { min: 92, max: 94, score: 4.8 },
  { min: 89, max: 91, score: 4.5 },
  { min: 86, max: 88, score: 4.2 },
  { min: 83, max: 85, score: 3.9 },
  { min: 80, max: 82, score: 3.6 },
  { min: 77, max: 79, score: 3.3 },
  { min: 74, max: 76, score: 3.0 },
  { min: 71, max: 73, score: 2.7 },
  { min: 68, max: 70, score: 2.4 },
  { min: 65, max: 67, score: 2.1 },
  { min: 62, max: 64, score: 1.8 },
  { min: 60, max: 61, score: 1.5 },
  { min: 0, max: 59, score: 0 },
];

function percentageToGPA(percentage) {
  const num = Number(percentage);
  if (!Number.isFinite(num)) return null;
  const entry = GRADE_TABLE.find((row) => num >= row.min && num <= row.max);
  return entry ? entry.score : 0;
}

function actorFields(actor) {
  return {
    actorId: actor?.id ?? null,
    actorName: actor?.cc98Nickname ?? '',
  };
}

function log(store, action, submission, actor, detail = '') {
  store.createAuditLog({
    action,
    entityType: 'submission',
    entityId: submission.id,
    targetTitle: submission.title,
    courseCode: submission.courseCode,
    ...actorFields(actor),
    detail,
  });
}

function submissionInput(input, fallback = {}) {
  const gradePercentage = String(input.gradePercentage ?? fallback.gradePercentage ?? '').trim();
  let gpa = String(input.gpa ?? fallback.gpa ?? '').trim();
  if (gradePercentage && !gpa) {
    const computed = percentageToGPA(gradePercentage);
    if (computed !== null) gpa = computed.toFixed(1);
  }
  return {
    courseCode: input.courseCode ?? fallback.courseCode,
    type: input.type ?? fallback.type,
    title: input.title ?? fallback.title,
    summary: input.summary ?? fallback.summary,
    author: input.author ?? fallback.author,
    body: input.body ?? fallback.body,
    bodyFormat: input.bodyFormat ?? fallback.bodyFormat ?? 'markdown',
    externalUrl: input.externalUrl ?? fallback.externalUrl,
    cc98Url: input.cc98Url ?? fallback.cc98Url,
    gpa,
    gradePercentage,
    year: input.year ?? fallback.year,
    teacher: input.teacher ?? fallback.teacher,
    imageName: input.imageName ?? fallback.imageName ?? '',
  };
}

function validateSubmission(input, current = null) {
  const value = submissionInput(input, current ?? {});
  const validation = validateContentInput(value);
  if (!validation.ok) return validation;
  if (!validation.value.body && validation.value.type === 'experience') {
    return { ok: false, status: 400, message: '学习心得需要填写正文。' };
  }
  return { ok: true, value: { ...validation.value, imageName: String(value.imageName ?? '').trim().slice(0, 160) } };
}

export function createSubmission(store, input, user) {
  if (!user?.id) return { ok: false, status: 401, message: '请先登录后投稿。' };
  const validation = validateSubmission(input);
  if (!validation.ok) return validation;
  return {
    ok: true,
    status: 201,
    submission: store.createSubmission({
      ...validation.value,
      submitterId: user.id,
      submitterName: user.nickname || user.cc98Nickname || '',
      file: input.file ?? null,
    }),
  };
}

export function createRevisionSubmission(store, targetId, input, user) {
  if (!user?.id) return { ok: false, status: 401, message: '请先登录后编辑。' };
  const target = store.findById(targetId);
  if (!target) return { ok: false, status: 404, message: '帖子不存在。' };
  if (target.ownerId !== user.id) return { ok: false, status: 403, message: '不能编辑他人的帖子。' };
  if (!['published', 'archived'].includes(target.status)) {
    return { ok: false, status: 409, message: '当前帖子不能提交修改审核。' };
  }
  const existingRevision = store.listSubmissionsBySubmitter(user.id).find((submission) => (
    submission.submissionKind === 'revision'
    && submission.targetContentId === target.id
    && submission.status === 'pending'
  ));
  if (existingRevision) return { ok: false, status: 409, message: '该帖子已有修改正在审核。' };
  const validation = validateSubmission(input, target);
  if (!validation.ok) return validation;
  return {
    ok: true,
    status: 201,
    submission: store.createSubmission({
      ...validation.value,
      submitterId: user.id,
      submitterName: user.nickname || user.cc98Nickname || '',
      submissionKind: 'revision',
      targetContentId: target.id,
      baseTargetUpdatedAt: target.updatedAt,
    }),
  };
}

export function updateSubmission(store, id, changes, actor) {
  const current = store.findSubmissionById(id);
  if (!current) return { ok: false, status: 404, message: '投稿不存在。' };
  if (current.status !== 'pending') return { ok: false, status: 409, message: '只能编辑待审核投稿。' };
  const validation = validateSubmission(changes, current);
  if (!validation.ok) return validation;
  const submission = store.updateSubmission(id, validation.value);
  log(store, 'submission.update', submission, actor, '编辑待审核投稿');
  return { ok: true, status: 200, submission };
}

export function approveSubmission(store, id, actor) {
  const submission = store.findSubmissionById(id);
  if (!submission) return { ok: false, status: 404, message: '投稿不存在。' };
  if (submission.status !== 'pending') return { ok: false, status: 409, message: '该投稿已经处理。' };
  const revisionTarget = submission.submissionKind === 'revision'
    ? store.findById(submission.targetContentId)
    : null;
  if (submission.submissionKind === 'revision'
    && (!revisionTarget || revisionTarget.ownerId !== submission.submitterId)) {
    return { ok: false, status: 409, message: '原帖子不存在或归属已变化。' };
  }
  if (revisionTarget && revisionTarget.updatedAt !== submission.baseTargetUpdatedAt) {
    return { ok: false, status: 409, message: '原帖子已发生变化，请作者重新提交修改。' };
  }
  if (submission.type === 'paper' && !submission.file && !revisionTarget?.file) {
    return { ok: false, status: 400, message: '历年试卷需要 PDF 才能通过审核。' };
  }
  if (submission.type === 'material' && !submission.body && !submission.externalUrl
    && !submission.file && !revisionTarget?.file) {
    return { ok: false, status: 400, message: '复习资料至少需要正文、链接或 PDF。' };
  }
  // Reject duplicates of an already-published item with the same link
  // (Bug 5). The two columns are searched independently because the
  // existing schema stores them in separate fields — calling
  // findPublishedByExternalUrl with the cc98Url value would never match.
  for (const [url, findFn, label] of [
    [submission.externalUrl, store.findPublishedByExternalUrl, '链接'],
    [submission.cc98Url, store.findPublishedByCc98Url, 'CC98 链接'],
  ]) {
    if (!url || !findFn) continue;
    const dup = findFn(url, { excludeId: revisionTarget?.id ?? '' });
    if (dup) {
      return { ok: false, status: 409, message: `已有相同${label}的已发布内容。` };
    }
  }
  const itemFields = {
    courseCode: submission.courseCode,
    type: submission.type,
    title: submission.title,
    summary: submission.summary,
    author: submission.author || submission.submitterName,
    body: submission.body,
    externalUrl: submission.externalUrl,
    cc98Url: submission.cc98Url,
    gpa: submission.gpa,
    year: submission.year,
    teacher: submission.teacher,
    updatedBy: actor?.id,
  };
  const item = revisionTarget
    ? store.updateItem(revisionTarget.id, itemFields)
    : store.createItem({
      ...itemFields,
      status: 'published',
      ownerId: submission.submitterId,
      createdBy: submission.submitterId,
      file: submission.file ? {
      ...submission.file,
      url: '',
    } : null,
    });
  let publishedItem = submission.file
    ? store.attachFile(item.id, { ...submission.file, url: `/api/content/files/${encodeURIComponent(item.id)}` }, actor?.id)
    : item;
  if (revisionTarget?.status === 'archived') {
    publishedItem = store.setStatus(item.id, 'published', actor?.id);
  }
  const reviewed = store.setSubmissionStatus(id, 'approved', actor, { approvedContentId: item.id });
  log(store, 'submission.approve', reviewed, actor, '审核通过并发布');
  return { ok: true, status: 200, submission: reviewed, item: publishedItem };
}

export function rejectSubmission(store, id, actor, note = '') {
  const submission = store.findSubmissionById(id);
  if (!submission) return { ok: false, status: 404, message: '投稿不存在。' };
  if (submission.status !== 'pending') return { ok: false, status: 409, message: '该投稿已经处理。' };
  const reviewed = store.setSubmissionStatus(id, 'rejected', actor, { note: String(note).trim().slice(0, 500) });
  log(store, 'submission.reject', reviewed, actor, reviewed.reviewNote || '未填写原因');
  return { ok: true, status: 200, submission: reviewed };
}
