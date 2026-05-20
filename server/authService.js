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

function publicUser(user) {
  if (!user) {
    return guestUser;
  }

  return {
    id: `cc98-${user.id}`,
    role: 'student',
    nickname: user.cc98Name,
    cc98Nickname: user.cc98Name,
    email: '',
    avatarInitials: user.cc98Name.slice(0, 1).toUpperCase() || 'C',
    avatarColor: '#2d4a2b',
    verifications: {
      cc98: true,
      email: false,
    },
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, passwordHash) {
  const [salt, key] = String(passwordHash).split(':');
  if (!salt || !key) {
    return false;
  }
  const candidate = await scrypt(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function validatePassword(password) {
  return String(password ?? '').length >= 4;
}

export function createSession(store, userId) {
  if (!userId) {
    return '';
  }
  const sessionId = randomBytes(32).toString('hex');
  store.createSession({ id: sessionId, userId });
  return sessionId;
}

export async function registerCc98(store, { code, password }) {
  const normalizedCode = normalizeText(code);

  const verificationCode = store.findVerificationCode(normalizedCode);
  if (!verificationCode || verificationCode.usedByUserId) {
    return { ok: false, status: 400, message: '验证码无效或已使用。' };
  }

  const normalizedName = normalizeText(verificationCode.cc98Name);
  if (!normalizedName || !validatePassword(password)) {
    return { ok: false, status: 400, message: '请填写有效验证码和至少 4 位密码。' };
  }

  if (store.findUserByCc98Name(normalizedName)) {
    return { ok: false, status: 409, message: '该 CC98 名字已注册。' };
  }

  const user = store.createUser({
    cc98Name: normalizedName,
    passwordHash: await hashPassword(password),
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
