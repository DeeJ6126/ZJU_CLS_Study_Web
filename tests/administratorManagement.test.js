import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuthStore } from '../server/authStore.js';
import { createContentStore } from '../server/content/contentStore.js';
import { addAdministrator } from '../server/administratorService.js';
import { publicUser, canManageAdministrators } from '../server/authService.js';
import { createAuthServer } from '../server/server.js';
import { createQuizStore } from '../server/quiz/quizStore.js';
import { createStudentHomepageStore } from '../server/studentHomepage/studentHomepageStore.js';
import { createConsultationStore } from '../server/consultation/consultationStore.js';
import { requestEmailCode, registerEmail } from '../server/emailAuthService.js';

const ownerEmail = '3240105782@zju.edu.cn';
function fixture(t, filename = ':memory:') {
  const store = createAuthStore({ filename }), content = createContentStore({ filename: ':memory:' });
  store.initialize(); content.initialize();
  const owner = store.createUser({ email: ownerEmail, nickname: 'Dee', role: 'admin', passwordHash: 'fixture' });
  const other = store.createUser({ email: '3250100001@zju.edu.cn', nickname: 'OtherAdmin', role: 'admin', passwordHash: 'fixture' });
  t.after(() => { store.close(); content.close(); });
  return { store, content, owner, other };
}

test('only the exact verified owner administrator may grant admin qualifications', t => {
  const { store, content, owner, other } = fixture(t);
  assert.equal(publicUser(owner).canManageAdministrators, true);
  assert.equal(publicUser(other).canManageAdministrators, false);
  assert.equal(canManageAdministrators({ ...owner, role: 'student' }), false);
  assert.equal(canManageAdministrators({ role: 'admin', email: ownerEmail }), false);
  assert.equal(addAdministrator(store, content, other.id, { studentId: '3250100002', actorId: owner.id }).status, 403);
  assert.equal(addAdministrator(store, content, null, { studentId: '3250100002' }).status, 403);
  assert.equal(store.hasAdministratorGrant('3250100002'), false);
  for (const studentId of ['3240105782@zju.edu.cn', '', 'abc', '1', '1'.repeat(21), 3250100002]) {
    assert.equal(addAdministrator(store, content, owner.id, { studentId }).status, 400);
  }
});

test('granting existing users is immediate, idempotent and attributed to the owner', t => {
  const { store, content, owner } = fixture(t);
  const student = store.createUser({ email: '3250100002@zju.edu.cn', nickname: 'TargetStudent', passwordHash: 'fixture' });
  const session = randomUUID(); store.createSession({ id: session, userId: student.id });
  const result = addAdministrator(store, content, owner.id, { studentId: '3250100002' });
  assert.equal(result.ok, true); assert.equal(result.registered, true);
  assert.equal(store.findUserById(student.id).role, 'admin');
  assert.equal(publicUser(store.findUserById(student.id)).canManageAdministrators, false);
  assert.equal(content.listAuditLogs()[0].actorId, owner.id);
  assert.equal(content.listAuditLogs()[0].actorName, 'Dee');
  assert.equal(content.listAuditLogs()[0].action, 'administrator.add');
  assert.equal(addAdministrator(store, content, owner.id, { studentId: '3250100002' }).status, 200);
  assert.equal(content.listAuditLogs().length, 1);
});

test('pending grants require verified registration and apply only to the correct school email', async t => {
  const { store, content, owner } = fixture(t);
  const result = addAdministrator(store, content, owner.id, { studentId: '3250100003' });
  assert.equal(result.registered, false);
  const cc98 = store.createUser({ cc98Name: '3250100003', nickname: 'ForumStudent', passwordHash: 'fixture' });
  assert.equal(store.findUserById(cc98.id).role, 'student');
  const options = { codeGenerator: () => '123456', sendEmail: async () => {} };
  // Exercise the real email-code verification path rather than trusting input role fields.
  await requestEmailCode(store, { studentId: '3250100003', purpose: 'register' }, options);
  const bad = await registerEmail(store, { studentId: '3250100003', nickname: 'VerifiedStudent', password: 'StrongPass1', code: '000000' });
  assert.equal(bad.ok, false);
  assert.equal(store.findUserByEmail('3250100003@zju.edu.cn'), null);
  const registered = await registerEmail(store, { studentId: '3250100003', nickname: 'VerifiedStudent', password: 'StrongPass1', code: '123456', role: 'admin' });
  assert.equal(registered.ok, true);
  assert.equal(registered.user.role, 'admin');
  assert.equal(registered.user.canManageAdministrators, false);
  const wrongDomain = store.createUser({ email: '3250100003@example.org', nickname: 'WrongDomain', passwordHash: 'fixture' });
  assert.equal(wrongDomain.role, 'student');
});

test('pending qualification survives SQLite reopening', t => {
  const directory = mkdtempSync(join(tmpdir(), 'admin-grant-'));
  const store = createAuthStore({ filename: join(directory, 'auth.sqlite') });
  store.initialize();
  const owner = store.createUser({ email: ownerEmail, nickname: 'Dee', role: 'admin', passwordHash: 'fixture' });
  store.grantAdministrator('3250100004', owner);
  store.close();
  const reopened = createAuthStore({ filename: join(directory, 'auth.sqlite') });
  reopened.initialize();
  try {
    assert.equal(reopened.hasAdministratorGrant('3250100004'), true);
    const student = reopened.createUser({ email: '3250100004@zju.edu.cn', nickname: 'LaterStudent', passwordHash: 'fixture' });
    assert.equal(student.role, 'admin');
  } finally { reopened.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('audit operator filtering combines nickname snapshots and current identity before limiting rows', t => {
  const { content, owner, other } = fixture(t);
  for (let i = 0; i < 4; i++) content.createAuditLog({ action: 'content.update', entityType: 'content', entityId: `c${i}`, targetTitle: '内容', courseCode: 'BIO2011F', actorId: other.id, actorName: 'OtherAdmin' });
  content.createAuditLog({ action: 'content.publish', entityType: 'content', entityId: 'owner-post', targetTitle: '心得', courseCode: 'BIO2011F', actorId: owner.id, actorName: '', createdAt: '2020-01-01T00:00:00.000Z' });
  const result = content.listAuditLogs({ actorName: 'Dee', actorIds: [owner.id], action: 'content.publish', courseCode: 'BIO2011F', limit: 1 });
  assert.equal(result.length, 1); assert.equal(result[0].actorId, owner.id);
  const selected = content.listAuditLogs({ actorName: 'Dee', actorIds: [owner.id, other.id], actorId: owner.id });
  assert.equal(selected.length, 1); assert.equal(selected[0].actorId, owner.id);
  assert.equal(content.listAuditLogs({ actorName: '%' }).length, 0);
});

test('HTTP enforces owner authorization and resolves old empty audit names', async t => {
  const store = createAuthStore({ filename: ':memory:' }), content = createContentStore({ filename: ':memory:' });
  const quiz = createQuizStore({ filename: ':memory:' }), homepages = createStudentHomepageStore({ filename: ':memory:' }), consultation = createConsultationStore({ filename: ':memory:' });
  const { server } = createAuthServer({ store, quizStore: quiz, contentStore: content, studentHomepageStore: homepages, consultationStore: consultation, adminStudentIds: new Set(), adminCc98Names: [] });
  const owner = store.createUser({ email: ownerEmail, nickname: 'Dee', role: 'admin', passwordHash: 'fixture' });
  const other = store.createUser({ email: '3250100005@zju.edu.cn', nickname: 'OtherAdmin', role: 'admin', passwordHash: 'fixture' });
  const student = store.createUser({ email: '3250100006@zju.edu.cn', nickname: 'Student', passwordHash: 'fixture' });
  const cookies = {};
  for (const [key, user] of Object.entries({ owner, other, student })) { const id = randomUUID(); store.createSession({ id, userId: user.id }); cookies[key] = `study_session=${id}`; }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); for (const db of [store, content, quiz, homepages, consultation]) db.close?.(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const grant = (role, headers = {}) => fetch(`${base}/api/admin/administrators`, { method: 'POST', headers: { 'content-type': 'application/json', ...(role ? { cookie: cookies[role] } : {}), ...headers }, body: JSON.stringify({ studentId: '3250100007', canManageAdministrators: true }) });
  assert.equal((await grant(null)).status, 401);
  assert.equal((await grant('student')).status, 403);
  assert.equal((await grant('other')).status, 403);
  assert.equal((await grant('owner', { 'content-type': 'text/plain' })).status, 415);
  assert.equal(store.hasAdministratorGrant('3250100007'), false);
  assert.equal((await grant('owner')).status, 201);
  content.createAuditLog({ action: 'content.update', entityType: 'content', entityId: 'old', targetTitle: '旧日志', actorId: owner.id, actorName: '未绑定' });
  const response = await fetch(`${base}/api/admin/audit-logs?actorName=Dee`, { headers: { cookie: cookies.other } });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.administratorNames.sort(), ['Dee', 'OtherAdmin']);
  const logs = payload.logs;
  assert.ok(logs.some(log => log.targetTitle === '旧日志' && log.actorName === 'Dee'));
  assert.ok(logs.every(log => log.actorId === owner.id));
  store.updateProfile(owner.id, { nickname: 'RenamedOwner' });
  const renamed = await fetch(`${base}/api/admin/audit-logs?actorName=RenamedOwner`, { headers: { cookie: cookies.other } });
  assert.equal((await renamed.json()).logs.length, logs.length);
});
