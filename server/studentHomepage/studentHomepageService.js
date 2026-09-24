function validateName(value) {
  const name = String(value ?? '').trim();
  if (!name) return { ok: false, message: '同学名称不能为空。' };
  if (name.length > 40) return { ok: false, message: '同学名称不能超过 40 个字符。' };
  return { ok: true, name };
}

function validateHref(value, { allowEmpty = false } = {}) {
  const href = String(value ?? '').trim();
  if (!href) return allowEmpty ? { ok: true, href } : { ok: false, message: '主页链接不能为空。' };
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

function validateAvatar(value) {
  const avatarUrl = String(value ?? '').trim();
  if (!avatarUrl || avatarUrl === '/zjubio/resource/homepages/dee.png') return { ok: true, avatarUrl };
  if (!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatarUrl) || avatarUrl.length > 200000) {
    return { ok: false, status: 400, message: '头像格式无效或文件过大，请上传图片。' };
  }
  return { ok: true, avatarUrl };
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
    const hrefResult = validateHref(input?.href, { allowEmpty: true });
    if (!hrefResult.ok) return hrefResult;
    const avatarResult = validateAvatar(input?.avatarUrl);
    if (!avatarResult.ok) return avatarResult;
    const orderResult = validateSortOrder(input?.sortOrder);
    if (!orderResult.ok) return orderResult;
    const status = validateStatus(input?.status);
    const homepage = store.createHomepage({
      name: nameResult.name,
      href: hrefResult.href,
      avatarUrl: avatarResult.avatarUrl,
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
    const hrefResult = validateHref(input?.href ?? existing.href, { allowEmpty: true });
    if (!hrefResult.ok) return hrefResult;
    const avatarResult = validateAvatar(input?.avatarUrl ?? existing.avatarUrl);
    if (!avatarResult.ok) return avatarResult;
    const orderResult = validateSortOrder(input?.sortOrder ?? existing.sortOrder);
    if (!orderResult.ok) return orderResult;
    const status = input?.status == null ? existing.status : validateStatus(input?.status);
    const homepage = store.updateHomepage(id, {
      name: nameResult.name,
      href: hrefResult.href,
      avatarUrl: avatarResult.avatarUrl,
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
  const avatarResult = validateAvatar(input?.avatarUrl);
  if (!avatarResult.ok) return avatarResult;
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
  if (intro.length > 500) return { ok: false, status: 400, message: '个人介绍不能超过 500 个字符。' };
  if (contact.length > 200) return { ok: false, status: 400, message: '联系方式不能超过 200 个字符。' };
  if (note.length > 500) return { ok: false, status: 400, message: '备注不能超过 500 个字符。' };
  return { ok: true, name, href, avatarUrl: avatarResult.avatarUrl, intro, contact, note };
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
      avatarUrl: validation.avatarUrl,
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
      avatarUrl: existing.avatarUrl,
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
