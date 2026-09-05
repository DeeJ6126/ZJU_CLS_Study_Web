function validateName(value) {
  const name = String(value ?? '').trim();
  if (!name) return { ok: false, message: '同学名称不能为空。' };
  if (name.length > 40) return { ok: false, message: '同学名称不能超过 40 个字符。' };
  return { ok: true, name };
}

function validateHref(value) {
  const href = String(value ?? '').trim();
  if (!href) return { ok: false, message: '主页链接不能为空。' };
  if (href.length > 500) return { ok: false, message: '主页链接不能超过 500 个字符。' };
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, message: '主页链接必须以 http:// 或 https:// 开头。' };
    }
  } catch {
    return { ok: false, message: '主页链接格式无效，请输入完整 URL。' };
  }
  return { ok: true, href };
}

function validateSortOrder(value) {
  if (value == null || value === '') return { ok: true, sortOrder: 0 };
  const num = Number(value);
  if (!Number.isFinite(num)) return { ok: false, message: '排序值必须是数字。' };
  return { ok: true, sortOrder: Math.trunc(num) };
}

function validateStatus(value) {
  return value === 'pending' ? 'pending' : 'approved';
}

export function createStudentHomepage(store) {
  return function createHomepage(input) {
    const nameResult = validateName(input?.name);
    if (!nameResult.ok) return nameResult;
    const hrefResult = validateHref(input?.href);
    if (!hrefResult.ok) return hrefResult;
    const orderResult = validateSortOrder(input?.sortOrder);
    if (!orderResult.ok) return orderResult;
    const status = validateStatus(input?.status);
    const homepage = store.createHomepage({
      name: nameResult.name,
      href: hrefResult.href,
      sortOrder: orderResult.sortOrder,
      status,
    });
    return { ok: true, status: 201, homepage };
  };
}

export function updateStudentHomepage(store) {
  return function updateHomepage(id, input) {
    const existing = store.findHomepageById(id);
    if (!existing) return { ok: false, status: 404, message: '同学主页不存在。' };
    const nameResult = validateName(input?.name ?? existing.name);
    if (!nameResult.ok) return nameResult;
    const hrefResult = validateHref(input?.href ?? existing.href);
    if (!hrefResult.ok) return hrefResult;
    const orderResult = validateSortOrder(input?.sortOrder ?? existing.sortOrder);
    if (!orderResult.ok) return orderResult;
    const status = input?.status == null ? existing.status : validateStatus(input?.status);
    const homepage = store.updateHomepage(id, {
      name: nameResult.name,
      href: hrefResult.href,
      sortOrder: orderResult.sortOrder,
      status,
    });
    return { ok: true, status: 200, homepage };
  };
}

export function deleteStudentHomepage(store) {
  return function deleteHomepage(id) {
    const existing = store.findHomepageById(id);
    if (!existing) return { ok: false, status: 404, message: '同学主页不存在。' };
    const removed = store.deleteHomepage(id);
    return { ok: true, status: 200, homepage: removed };
  };
}

function validateApplicationPayload(input) {
  const name = String(input?.name ?? '').trim();
  const href = String(input?.href ?? '').trim();
  const intro = String(input?.intro ?? '').trim();
  const contact = String(input?.contact ?? '').trim();
  const note = String(input?.note ?? '').trim();
  if (!name) return { ok: false, status: 400, message: '同学名称不能为空。' };
  if (name.length > 40) return { ok: false, status: 400, message: '同学名称不能超过 40 个字符。' };
  if (!href) return { ok: false, status: 400, message: '主页链接不能为空。' };
  if (href.length > 500) return { ok: false, status: 400, message: '主页链接不能超过 500 个字符。' };
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, status: 400, message: '主页链接必须以 http:// 或 https:// 开头。' };
    }
  } catch {
    return { ok: false, status: 400, message: '主页链接格式无效，请输入完整 URL。' };
  }
  if (!intro) return { ok: false, status: 400, message: '请填写个人介绍。' };
  if (intro.length > 500) return { ok: false, status: 400, message: '个人介绍不能超过 500 个字符。' };
  if (!contact) return { ok: false, status: 400, message: '请填写联系方式。' };
  if (contact.length > 200) return { ok: false, status: 400, message: '联系方式不能超过 200 个字符。' };
  if (note.length > 500) return { ok: false, status: 400, message: '备注不能超过 500 个字符。' };
  return { ok: true, name, href, intro, contact, note };
}

export function createStudentHomepageApplication(store) {
  return function submitApplication(input, applicant = null) {
    if (!applicant || !applicant.id) {
      return { ok: false, status: 401, message: '请先登录后申请收录。' };
    }
    const validation = validateApplicationPayload(input);
    if (!validation.ok) return validation;
    const application = store.createApplication({
      name: validation.name,
      href: validation.href,
      intro: validation.intro,
      contact: validation.contact,
      note: validation.note,
      applicantId: applicant.id,
      applicantNickname: applicant.nickname ?? '',
    });
    return { ok: true, status: 201, application };
  };
}

export function approveStudentHomepageApplication(store) {
  return function approveApplication(id, { adminId, decisionNote = '' }) {
    const existing = store.findApplicationById(id);
    if (!existing) return { ok: false, status: 404, message: '申请不存在。' };
    if (existing.status !== 'pending') {
      return { ok: false, status: 409, message: '该申请已经被处理。' };
    }
    const dup = store.listHomepages().some((item) => item.href === existing.href && item.status === 'approved');
    if (dup) {
      return { ok: false, status: 409, message: '该链接已经在同学主页目录中，无需重复收录。' };
    }
    const nextSort = (store.listHomepages({ status: 'approved' }).at(-1)?.sortOrder ?? -1) + 1;
    const homepage = store.createHomepage({
      name: existing.name,
      href: existing.href,
      sortOrder: nextSort,
      status: 'approved',
    });
    const updated = store.decideApplication(id, {
      status: 'approved',
      decidedBy: adminId,
      decisionNote,
    });
    return { ok: true, status: 200, application: updated, homepage };
  };
}

export function rejectStudentHomepageApplication(store) {
  return function rejectApplication(id, { adminId, decisionNote = '' }) {
    const existing = store.findApplicationById(id);
    if (!existing) return { ok: false, status: 404, message: '申请不存在。' };
    if (existing.status !== 'pending') {
      return { ok: false, status: 409, message: '该申请已经被处理。' };
    }
    const updated = store.decideApplication(id, {
      status: 'rejected',
      decidedBy: adminId,
      decisionNote,
    });
    return { ok: true, status: 200, application: updated };
  };
}
