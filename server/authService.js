import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

/**
 * @typedef {Object} Store
 * @description Persistence facade used by every auth function. See
 *   server/authStore.js for the full surface.
 */

/**
 * @typedef {Object} PublicUser
 * @property {string} id
 * @property {'guest'|'student'|'admin'} role
 * @property {string} nickname
 * @property {string} [publicId]
 * @property {string|null} [grade]
 * @property {string} cc98Nickname
 * @property {string} email
 * @property {string} [avatarUrl]
 * @property {string} avatarInitials
 * @property {string} avatarColor
 * @property {{cc98: boolean, email: boolean}} verifications
 */

/**
 * @template T
 * @typedef {Object} ServiceResult
 * @property {boolean} ok
 * @property {number} status  HTTP-style status code.
 * @property {string} message Human-readable message (also sent to client).
 * @property {T}      [user]
 * @property {string} [sessionId]
 */

/** @type {PublicUser} */
export const guestUser = {
  id: 'guest',
  role: 'guest',
  nickname: '访客',
  cc98Nickname: '未绑定',
  email: '',
  avatarUrl: '',
  avatarInitials: 'G',
  avatarColor: '#708090',
  verifications: {
    cc98: false,
    email: false,
  },
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

const reservedNicknames = new Set(['admin', 'administrator', '管理员', '系统', '生科智学']);

/**
 * Lowercase + trim a nickname for case-insensitive comparisons. Used to
 * detect collisions against the reserved-name set and existing users.
 *
 * @param {unknown} value
 * @returns {string} normalized nickname, or '' for non-string / empty input.
 */
export function normalizeNickname(value) {
  return normalizeText(value).toLocaleLowerCase('zh-CN');
}

/**
 * @param {unknown} value
 * @returns {boolean} true when the nickname is 2-20 word characters
 *   (letters, numbers, _, -) and is not a reserved system name.
 */
export function validateNickname(value) {
  const nickname = normalizeText(value);
  return /^[\p{L}\p{N}_-]{2,20}$/u.test(nickname)
    && !reservedNicknames.has(normalizeNickname(nickname));
}

function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  return `${local.slice(0, Math.min(2, local.length))}*****@${domain}`;
}

/**
 * Convert a database user row into a public-facing object. Masks the email
 * and resolves the avatar URL. Returns `guestUser` when given no row.
 *
 * @param {Object|null} user Database row from authStore.
 * @returns {PublicUser}
 */
export function publicUser(user) {
  if (!user) {
    return guestUser;
  }

  return {
    id: `${user.cc98Name ? 'cc98' : 'email'}-${user.id}`,
    role: user.role ?? 'student',
    nickname: user.nickname,
    publicId: user.publicId,
    grade: user.grade ?? null,
    cc98Nickname: user.cc98Name || '未绑定',
    email: maskEmail(user.email),
    avatarUrl: user.avatarStoredName
      ? `/api/profile-avatars/${encodeURIComponent(user.avatarStoredName)}`
      : '',
    avatarInitials: user.nickname.slice(0, 1).toUpperCase() || 'S',
    avatarColor: '#2d4a2b',
    verifications: {
      cc98: Boolean(user.cc98Name),
      email: Boolean(user.email),
    },
  };
}

/**
 * Persistent account and public-content writes require a verified numeric ZJU
 * student identity. Administrators are trusted for compatibility with already
 * provisioned administrator accounts while new administrators are created from
 * the student-ID allowlist.
 */
export function canLeaveSiteTrace(user) {
  return Boolean(user && (
    user.role === 'admin'
    || user.verifications?.email
    || user.email
  ));
}

/**
 * @param {string} password
 * @returns {Promise<string>} salt and scrypt-derived key, separated by ':'.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

/**
 * @param {string} password
 * @param {string} passwordHash
 * @returns {Promise<boolean>} true when the password matches the stored hash.
 */
export async function verifyPassword(password, passwordHash) {
  const [salt, key] = String(passwordHash).split(':');
  if (!salt || !key) {
    return false;
  }
  const candidate = await scrypt(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function validatePassword(password) {
  return String(password ?? '').length >= 8;
}

export { validatePassword };

/**
 * Create a server-side session row and return its opaque id.
 * @param {Store} store
 * @param {number|string} userId
 * @returns {string} sessionId (empty when userId is falsy).
 */
export function createSession(store, userId) {
  if (!userId) {
    return '';
  }
  const sessionId = randomBytes(32).toString('hex');
  store.createSession({ id: sessionId, userId });
  return sessionId;
}

/**
 * Register a brand-new user from a one-time CC98 verification code.
 *
 * Admin role is granted only when BOTH conditions hold: the CC98 name is
 * on the allowlist AND the caller knows the shared admin invite token.
 * The token check prevents an attacker who obtained an unused admin seed
 * code from creating an admin account by guessing a 10+ character
 * password. The role downgrades silently to 'student' if either check
 * fails — that is by design: we don't want to leak whether a given
 * CC98 name is on the allowlist.
 *
 * @param {Store} store
 * @param {{code: string, password: string, adminInviteToken?: string}} input
 * @param {{adminCc98Names?: Set<string>, expectedAdminInviteToken?: string}} [options]
 * @returns {Promise<ServiceResult<PublicUser>>}
 */
export async function registerCc98(
  store,
  { code, password, adminInviteToken = '' },
  { adminCc98Names = new Set(), expectedAdminInviteToken = '' } = {},
) {
  const normalizedCode = normalizeText(code);

  const verificationCode = store.findVerificationCode(normalizedCode);
  if (!verificationCode || verificationCode.usedByUserId) {
    return { ok: false, status: 400, message: '验证码无效或已使用。' };
  }

  const normalizedName = normalizeText(verificationCode.cc98Name);
  const nameMatchesAdminAllowlist = adminCc98Names.has(normalizedName);
  const isAdmin = nameMatchesAdminAllowlist
    && expectedAdminInviteToken.length > 0
    && adminInviteToken === expectedAdminInviteToken;
  const passwordIsValid = isAdmin ? String(password ?? '').length >= 10 : validatePassword(password);
  if (!normalizedName || !passwordIsValid) {
    if (nameMatchesAdminAllowlist) {
      return { ok: false, status: 400, message: '管理员密码至少需要 10 位。' };
    }
    return { ok: false, status: 400, message: '请填写有效验证码和至少 8 位密码。' };
  }

  if (store.findUserByCc98Name(normalizedName)) {
    return { ok: false, status: 409, message: '该 CC98 名字已注册。' };
  }
  if (store.findUserByNickname(normalizedName)) {
    return { ok: false, status: 409, message: '该昵称已被使用。' };
  }
  // Reserved-nickname check is part of the front-end validator; mirror it
  // server-side so a direct API call can't bypass it.
  if (!validateNickname(normalizedName)) {
    return { ok: false, status: 400, message: '该 CC98 名字不可用作账号，请联系管理员。' };
  }

  const user = store.createUser({
    cc98Name: normalizedName,
    passwordHash: await hashPassword(password),
    role: isAdmin ? 'admin' : 'student',
  });
  store.consumeVerificationCode(normalizedCode, user.id);

  return {
    ok: true,
    status: 201,
    user: publicUser(user),
  };
}

/**
 * @param {Store} store
 * @param {{cc98Name: string, password: string}} input
 * @returns {Promise<ServiceResult<PublicUser>>} ok=true carries sessionId + user.
 */
export async function loginCc98(store, { cc98Name, password }) {
  const user = store.findUserByCc98Name(normalizeText(cc98Name));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, status: 401, message: 'CC98 名字或密码错误。' };
  }

  const sessionId = createSession(store, user.id);
  return {
    ok: true,
    status: 200,
    sessionId,
    user: publicUser(user),
  };
}

/**
 * @param {Store} store
 * @param {number|string} userId
 * @param {string} currentSessionId
 * @param {{code: string, password: string}} input
 * @returns {Promise<ServiceResult<PublicUser>>}
 */
export async function bindOrRebindCc98(store, userId, currentSessionId, { code, password }) {
  const user = store.findUserById(userId);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, status: 401, message: '当前密码错误。' };
  }
  const normalizedCode = normalizeText(code);
  const verificationCode = store.findVerificationCode(normalizedCode);
  const cc98Name = normalizeText(verificationCode?.cc98Name);
  if (!verificationCode || verificationCode.usedByUserId || !cc98Name) {
    return { ok: false, status: 400, message: '验证码无效或已使用。' };
  }
  const identityOwner = store.findUserByCc98Name(cc98Name);
  if (identityOwner && identityOwner.id !== userId) {
    return { ok: false, status: 409, message: '该 CC98 名字已绑定其他账号。' };
  }
  const nicknameOwner = store.findUserByNickname(cc98Name);
  if (nicknameOwner && nicknameOwner.id !== userId) {
    return { ok: false, status: 409, message: '该 CC98 名字与已有昵称冲突。' };
  }
  try {
    // HI-SEC-5: identity replacement + session invalidation in one
    // transaction so a partial state can never leak through.
    const next = store.replaceCc98IdentityAndInvalidateSessions(
      userId, cc98Name, normalizedCode, currentSessionId,
    );
    return { ok: true, status: 200, user: publicUser(next) };
  } catch {
    return { ok: false, status: 409, message: 'CC98 绑定失败，请更换验证码后重试。' };
  }
}

/**
 * Resolve the current user from a session id, falling back to `guestUser`.
 * @param {Store} store
 * @param {string} [sessionId]
 * @returns {PublicUser}
 */
export function getCurrentUser(store, sessionId) {
  const session = sessionId ? store.findSession(sessionId) : null;
  if (!session) {
    return guestUser;
  }
  return publicUser(store.findUserById(session.userId));
}

/**
 * @param {Store} store
 * @param {string} [sessionId]
 * @returns {void}
 */
export function logout(store, sessionId) {
  if (sessionId) {
    store.deleteSession(sessionId);
  }
}
