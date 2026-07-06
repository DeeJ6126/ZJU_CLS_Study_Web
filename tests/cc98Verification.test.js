import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { cc98TestVerificationCodes } from '../src/data/config/cc98VerificationCodes.js';
import { verifyCc98Code } from '../src/services/cc98VerificationService.js';

test('cc98 front-end prototype code succeeds with normalized input', () => {
  const result = verifyCc98Code({ code: '  bio-cc98  ' });

  assert.equal(result.ok, true);
  assert.equal(result.provider, 'cc98');
  assert.equal(result.cc98Nickname, 'cc98_bio_visitor');
  assert.match(result.message, /前端原型验证码匹配成功/);
});

test('cc98 front-end prototype code matching is case insensitive', () => {
  const result = verifyCc98Code({ code: 'BIO-CC98' });

  assert.equal(result.ok, true);
  assert.equal(result.provider, 'cc98');
});

test('cc98 disposable test batch exposes stable single-use codes', () => {
  assert.equal(cc98TestVerificationCodes.length, 30);
  assert.deepEqual(cc98TestVerificationCodes[0], {
    code: 'zjubio-test-001',
    cc98Nickname: 'zjubio_test_001',
    label: 'zjubio disposable test code 001',
  });
  assert.deepEqual(cc98TestVerificationCodes.at(-1), {
    code: 'zjubio-test-030',
    cc98Nickname: 'zjubio_test_030',
    label: 'zjubio disposable test code 030',
  });
});

test('cc98 front-end prototype code rejects empty and unknown input', () => {
  assert.deepEqual(
    verifyCc98Code({ code: '' }),
    {
      ok: false,
      provider: 'cc98',
      message: '请输入 CC98 前端原型验证码。',
    },
  );
  assert.deepEqual(
    verifyCc98Code({ code: 'not-a-code' }),
    {
      ok: false,
      provider: 'cc98',
      message: 'CC98 前端原型验证码匹配失败。',
    },
  );
});

test('cc98 verification service avoids real-security wording', async () => {
  const source = await readFile(new URL('../src/services/cc98VerificationService.js', import.meta.url), 'utf8');

  assert.equal(source.includes('真实安全认证'), false);
  assert.equal(source.includes('真实认证'), false);
  assert.equal(source.includes('安全校验'), false);
  assert.equal(source.includes('后端认证'), false);
});
