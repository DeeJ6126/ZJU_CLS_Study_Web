import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const guestUser = {
  id: 'guest',
  role: 'guest',
  nickname: '访客',
  cc98Nickname: '未绑定',
  email: '',
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

export function normalizeNickname(value) {
  return normalizeText(value).toLocaleLowerCase('zh-CN');
}

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

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

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

export function createSession(store, userId) {
  if (!userId) {
    return '';
  }
  const sessionId = randomBytes(32).toString('hex');
  store.createSession({ id: sessionId, userId });
  return sessionId;
}

export async function registerCc98(store, { code, password }, { adminCc98Names = new Set() } = {}) {
  const normalizedCode = normalizeText(code);

  const verificationCode = store.findVerificationCode(normalizedCode);
  if (!verificationCode || verificationCode.usedByUserId) {
    return { ok: false, status: 400, message: '验证码无效或已使用。' };
  }

  const normalizedName = normalizeText(verificationCode.cc98Name);
  const isAdmin = adminCc98Names.has(normalizedName);
  const passwordIsValid = isAdmin ? String(password ?? '').length >= 10 : validatePassword(password);
  if (!normalizedName || !passwordIsValid) {
    if (isAdmin) {
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
    const next = store.replaceCc98Identity(userId, cc98Name, normalizedCode);
    store.deleteOtherSessions(userId, currentSessionId);
    return { ok: true, status: 200, user: publicUser(next) };
  } catch {
    return { ok: false, status: 409, message: 'CC98 绑定失败，请更换验证码后重试。' };
  }
}

export function getCurrentUser(store, sessionId) {
  const session = sessionId ? store.findSession(sessionId) : null;
  if (!session) {
    return guestUser;
  }
  return publicUser(store.findUserById(session.userId));
}

export function logout(store, sessionId) {
  if (sessionId) {
    store.deleteSession(sessionId);
  }
}
