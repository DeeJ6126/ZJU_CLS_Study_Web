import nodemailer from 'nodemailer';

function envFlag(value, fallback = true) {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

export function smtpConfigFromEnv(env = process.env) {
  return {
    host: env.SMTP_HOST || 'smtp.zju.edu.cn',
    port: Number(env.SMTP_PORT || 994),
    secure: envFlag(env.SMTP_SECURE, true),
    user: String(env.SMTP_USER || '').trim(),
    password: String(env.SMTP_PASSWORD || ''),
    fromName: String(env.SMTP_FROM_NAME || '生科智学').trim() || '生科智学',
  };
}

export function createSmtpEmailSender({
  config = smtpConfigFromEnv(),
  transport,
  logger = console,
  retryDelayMs = 500,
} = {}) {
  const smtpTransport = transport ?? (config.user && config.password
    ? nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
    : null);
  if (!smtpTransport) return null;

  const subjects = {
    register: '生科智学注册验证码',
    bind: '生科智学邮箱绑定验证码',
    'password-reset': '生科智学密码重置验证码',
  };
  return async ({ to, code, purpose, expiresInMinutes }) => {
    const subject = subjects[purpose] ?? '生科智学邮箱验证码';
    const text = [
      `你的验证码是：${code}`,
      `验证码在 ${expiresInMinutes} 分钟内有效，仅可使用一次。`,
      '如果不是你本人操作，请忽略这封邮件。',
    ].join('\n\n');
    const message = {
      from: `"${config.fromName.replaceAll('"', '')}" <${config.user}>`,
      to,
      subject,
      text,
    };
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await smtpTransport.sendMail(message);
        return;
      } catch (error) {
        logger?.warn?.('SMTP verification email delivery failed.', { purpose, attempt });
        if (attempt === 2) throw error;
        if (retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }
  };
}
