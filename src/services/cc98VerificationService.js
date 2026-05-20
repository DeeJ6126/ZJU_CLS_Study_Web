import { cc98VerificationCodes } from '../data/config/cc98VerificationCodes.js';

const PROVIDER = 'cc98';

function normalizeCode(code) {
  return String(code ?? '').trim().toLowerCase();
}

export function verifyCc98Code({ code }) {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return {
      ok: false,
      provider: PROVIDER,
      message: '请输入 CC98 前端原型验证码。',
    };
  }

  const matchedCode = cc98VerificationCodes.find(
    (item) => normalizeCode(item.code) === normalizedCode,
  );

  if (!matchedCode) {
    return {
      ok: false,
      provider: PROVIDER,
      message: 'CC98 前端原型验证码匹配失败。',
    };
  }

  return {
    ok: true,
    provider: PROVIDER,
    cc98Nickname: matchedCode.cc98Nickname,
    message: 'CC98 前端原型验证码匹配成功。',
  };
}
