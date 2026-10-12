import { canManageAdministrators } from './authService.js';

export function addAdministrator(store, contentStore, actorId, input) {
  const actor = store.findUserById(actorId);
  if (!canManageAdministrators(actor)) return { ok: false, status: 403, message: '当前账号不能增加管理员。' };
  const studentId = typeof input?.studentId === 'string' ? input.studentId.trim() : '';
  if (!/^\d{5,20}$/.test(studentId)) return { ok: false, status: 400, message: '请输入 5 到 20 位纯数字学号。' };
  const grant = store.grantAdministrator(studentId, actor);
  let persistenceWarning = '';
  if (grant.added) {
    try {
      contentStore.createAuditLog({ action: 'administrator.add', entityType: 'administrator', entityId: studentId,
        targetTitle: grant.user?.nickname || studentId, actorId: actor.id, actorName: actor.nickname,
        detail: grant.user ? `学号 ${studentId} 已成为管理员` : `学号 ${studentId} 注册认证后成为管理员` });
    } catch { persistenceWarning = '管理员资格已保存，但操作日志写入失败。'; }
  }
  return { ok: true, status: grant.added ? 201 : 200, persistenceWarning,
    message: grant.user ? `${grant.user.nickname} 已是管理员。` : '资格已保存，该学号完成注册认证后将成为管理员。',
    studentId, registered: Boolean(grant.user), nickname: grant.user?.nickname ?? '' };
}
