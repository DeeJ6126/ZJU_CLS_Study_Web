import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import {
  createSession,
  hashPassword,
  normalizeNickname,
  publicUser,
  validateNickname,
  validatePassword,
  verifyPassword,
} from './authService.js';
import { gradeFromStudentId } from './studentGrade.js';

const scrypt = promisify(scryptCallback);
const purposes = new Set(['register', 'bind', 'password-reset']);

/**
 * @typedef {import('./authService.js').PublicUser} PublicUser
 * @typedef {import('./authService.js').ServiceResult} ServiceResult
 */

/**
 * @param {unknown} value
 * @returns {string} numeric student id, or '' if input is not all digits.
 */
export function normalizeStudentId(value) {
  const studentId = String(value ?? '').trim();
  return /^\d+$/.test(studentId) ? studentId : '';
}

function studentEmail(input) {
  const directStudentId = normalizeStudentId(input?.studentId);
  if (directStudentId) return `${directStudentId}@zju.edu.cn`;
  const legacyEmail = String(input?.email ?? '').trim().toLowerCase();
  const matched = legacyEmail.match(/^(\d+)@zju\.edu\.cn$/);
  return matched ? `${matched[1]}@zju.edu.cn` : '';
}

async function hashCode(code, salt) {
  return (await scrypt(code, salt, 32)).toString('hex');
}

async function matchesCode(code, record) {
  const candidate = await scrypt(String(code ?? '').trim(), record.salt, 32);
  const expected = Buffer.from(record.codeHash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function defaultCodeGenerator() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function timeValue(now) {
  return typeof now === 'function' ? now() : new Date();
}

async function verifyEmailCode(store, { email, code, purpose }, options = {}) {
  const now = timeValue(options.now);
  const record = store.findLatestEmailCode(email, purpose);
  if (!record || record.consumedAt || record.attemptsLeft <= 0 || new Date(record.expiresAt) < now) {
    return { ok: false, status: 400, message: '验证码无效或已过期。' };
  }
  if (!(await matchesCode(code, record))) {
    store.failEmailCode(record.id);
    return { ok: false, status: 400, message: '验证码无效或已过期。' };
  }
  return { ok: true, record, consumedAt: now.toISOString() };
}

/**
 * Generate and "send" a one-time 6-digit email code. The smtpMailer is
 * injected so tests can swap in a stub.
 *
 * @param {import('./authService.js').Store} store
 * @param {{email?: string, studentId?: string, purpose: 'register'|'bind'|'password-reset', requestIpHash?: string}} input
 * @param {{sendEmail?: Function, codeGenerator?: Function, now?: Function}} [options]
 * @returns {Promise<ServiceResult<never>>}
 */
export async function requestEmailCode(store, input, options = {}) {
  const email = studentEmail(input);
  const purpose = String(input.purpose ?? 'register');
  if (!email || !purposes.has(purpose)) {
    return { ok: false, status: 400, message: '请填写有效的浙大邮箱。' };
  }
  const now = timeValue(options.now);
  const latest = store.findLatestEmailCode(email, purpose);
  if (latest && now.getTime() - new Date(latest.requestedAt).getTime() < 60_000) {
    return { ok: false, status: 429, message: '验证码发送过于频繁，请稍后再试。' };
  }
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();
  if (store.countEmailCodesSince(email, hourAgo) >= 5) {
    return { ok: false, status: 429, message: '验证码发送次数已达上限，请稍后再试。' };
  }
  if (store.countEmailCodesByIpSince(input.requestIpHash, hourAgo) >= 20
    || store.countAllEmailCodesSince(hourAgo) >= 200) {
    return { ok: false, status: 429, message: '验证码请求过多，请稍后再试。' };
  }
  if (purpose === 'register' && store.findUserByEmail(email)) {
    return { ok: false, status: 409, message: '该邮箱无法用于注册。' };
  }
  if (purpose === 'bind' && store.findUserByEmail(email)) {
    return { ok: false, status: 409, message: '该邮箱已绑定账号。' };
  }
  if (purpose === 'password-reset' && !store.findUserByEmail(email)) {
    return { ok: true, status: 202, message: '如果该邮箱已注册，验证码将发送至邮箱。' };
  }
  if (typeof options.sendEmail !== 'function') {
    return { ok: false, status: 503, message: '邮件服务尚未配置。' };
  }
  const code = (options.codeGenerator ?? defaultCodeGenerator)();
  const salt = randomBytes(16).toString('hex');
  const record = store.createEmailCode({
    id: randomBytes(16).toString('hex'),
    email,
    purpose,
    codeHash: await hashCode(code, salt),
    salt,
    requestedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    requestIpHash: input.requestIpHash ?? '',
  });
  try {
    await options.sendEmail({ to: email, code, purpose, expiresInMinutes: 10 });
  } catch (error) {
    // Surface the failure for operators without leaking the recipient to logs.
    // The smtpMailer already redacts the recipient; record the purpose only.
    console.error('[email] send failed', {
      purpose,
      error: error?.message ?? String(error),
    });
    store.deleteEmailCode(record.id);
    return { ok: false, status: 503, message: '验证码发送失败，请稍后重试。' };
  }
  return { ok: true, status: 202, message: '验证码已发送。' };
}

/**
 * @param {import('./authService.js').Store} store
 * @param {{studentId: string|number, nickname: string, password: string, code: string, email?: string}} input
 * @param {{now?: Function}} [options]
 * @returns {Promise<ServiceResult<PublicUser>>}
 */
export async function registerEmail(store, input, options = {}) {
  const email = studentEmail(input);
  const nickname = String(input.nickname ?? '').trim();
  if (!email || !validatePassword(input.password) || !validateNickname(nickname)) {
    return { ok: false, status: 400, message: '请填写纯数字学号、有效昵称和至少 8 位密码。' };
  }
  if (store.findUserByEmail(email)) {
    return { ok: false, status: 409, message: '该邮箱无法用于注册。' };
  }
  if (store.findUserByNickname(nickname)) {
    return { ok: false, status: 409, message: '该昵称已被使用。' };
  }
  const verified = await verifyEmailCode(store, { email, code: input.code, purpose: 'register' }, options);
  if (!verified.ok) return verified;
  const user = store.createUser({
    email,
    nickname,
    passwordHash: await hashPassword(input.password),
    grade: gradeFromStudentId(email.split('@')[0]),
  });
  store.consumeEmailCode(verified.record.id, verified.consumedAt);
  return { ok: true, status: 201, user: publicUser(user) };
}

/**
 * @param {import('./authService.js').Store} store
 * @param {{studentId: string|number, email?: string, password: string}} input
 * @returns {Promise<ServiceResult<PublicUser>>}
 */
export async function loginEmail(store, input) {
  const email = studentEmail(input);
  const user = email ? store.findUserByEmail(email) : null;
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    return { ok: false, status: 401, message: '邮箱或密码错误。' };
  }
  const sessionId = createSession(store, user.id);
  return { ok: true, status: 200, sessionId, user: publicUser(user) };
}

/**
 * @param {import('./authService.js').Store} store
 * @param {number|string} userId
 * @param {{code: string}} input
 * @param {{now?: Function}} [options]
 * @returns {Promise<ServiceResult<PublicUser>>}
 */
export async function bindEmailIdentity(store, userId, input, options = {}) {
  const email = studentEmail(input);
  const user = store.findUserById(userId);
  if (!user || !email || user.email || store.findUserByEmail(email)) {
    return { ok: false, status: 409, message: '该邮箱无法绑定。' };
  }
  const verified = await verifyEmailCode(store, { email, code: input.code, purpose: 'bind' }, options);
  if (!verified.ok) return verified;
  let next = store.addIdentity(userId, 'email', email);
  if (next.grade == null) {
    const derivedGrade = gradeFromStudentId(email.split('@')[0]);
    if (derivedGrade != null) {
      next = store.updateGrade(userId, derivedGrade);
    }
  }
  store.consumeEmailCode(verified.record.id, verified.consumedAt);
  return { ok: true, status: 200, user: publicUser(next) };
}

/**
 * @param {import('./authService.js').Store} store
 * @param {{studentId: string|number, code: string, password: string}} input
 *   The `password` field is the *new* password the user is choosing.
 * @param {{now?: Function}} [options]
 * @returns {Promise<ServiceResult<never>>}
 */
export async function resetPasswordByEmail(store, input, options = {}) {
  const email = studentEmail(input);
  const user = email ? store.findUserByEmail(email) : null;
  if (!user || !validatePassword(input.password)) {
    return { ok: false, status: 400, message: '验证码无效或密码不符合要求。' };
  }
  const verified = await verifyEmailCode(store, { email, code: input.code, purpose: 'password-reset' }, options);
  if (!verified.ok) return verified;
  store.updatePassword(user.id, await hashPassword(input.password));
  store.consumeEmailCode(verified.record.id, verified.consumedAt);
  return { ok: true, status: 200, message: '密码已重置，请重新登录。' };
}
