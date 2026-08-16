import test from 'node:test';
import assert from 'node:assert/strict';

import { createSmtpEmailSender, smtpConfigFromEnv } from '../server/smtpMailer.js';

test('SMTP config uses secure ZJU defaults without exposing credentials', () => {
  const config = smtpConfigFromEnv({ SMTP_USER: 'sender@zju.edu.cn', SMTP_PASSWORD: 'app-password' });
  assert.deepEqual(config, {
    host: 'smtp.zju.edu.cn', port: 994, secure: true, user: 'sender@zju.edu.cn', password: 'app-password',
    fromName: '生科智学',
  });
});

test('SMTP sender emits a compact registration code email through the injected transport', async () => {
  const messages = [];
  const sender = createSmtpEmailSender({
    config: {
      host: 'smtp.zju.edu.cn', port: 994, secure: true, user: 'sender@zju.edu.cn', password: 'secret', fromName: '生科智学',
    },
    transport: { async sendMail(message) { messages.push(message); } },
  });
  await sender({ to: 'student@zju.edu.cn', code: '123456', purpose: 'register', expiresInMinutes: 10 });

  assert.equal(messages[0].to, 'student@zju.edu.cn');
  assert.equal(messages[0].from, '"生科智学" <sender@zju.edu.cn>');
  assert.match(messages[0].subject, /注册验证码/);
  assert.match(messages[0].text, /123456/);
  assert.doesNotMatch(JSON.stringify(messages[0]), /secret/);
});

test('SMTP sender retries once and logs only sanitized failure metadata', async () => {
  let attempts = 0;
  const warnings = [];
  const sender = createSmtpEmailSender({
    config: {
      host: 'smtp.zju.edu.cn', port: 994, secure: true, user: 'sender@zju.edu.cn', password: 'secret', fromName: '生科智学',
    },
    transport: {
      async sendMail() {
        attempts += 1;
        if (attempts === 1) throw new Error('temporary failure for student@zju.edu.cn code 123456');
      },
    },
    logger: { warn(message, metadata) { warnings.push({ message, metadata }); } },
    retryDelayMs: 0,
  });

  await sender({ to: 'student@zju.edu.cn', code: '123456', purpose: 'register', expiresInMinutes: 10 });
  assert.equal(attempts, 2);
  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0].metadata, { purpose: 'register', attempt: 1 });
  assert.doesNotMatch(JSON.stringify(warnings), /student@zju\.edu\.cn|123456|secret/);
});
