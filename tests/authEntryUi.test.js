import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth entry components keep login and registration options without test account switcher', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const accountPopover = await readFile(new URL('../src/components/account/AccountPopover.vue', import.meta.url), 'utf8');
  const settingsPanel = await readFile(new URL('../src/components/SettingsPanel.vue', import.meta.url), 'utf8');

  assert.equal(app.includes('<AccountAccessMenu'), false);
  assert.match(app, /canSubmitResource/);
  assert.match(app, /canComment/);
  assert.match(app, /canFavorite/);
  assert.match(accountPopover, /CC98注册/);
  assert.match(accountPopover, /浙大邮箱注册/);
  assert.match(accountPopover, /登录/);
  assert.equal(accountPopover.includes('UserSwitcher'), false);
  assert.equal(settingsPanel.includes('UserSwitcher'), false);
});

test('auth dialog keeps cc98 and school email tabs while disabling email flow', async () => {
  const dialog = await readFile(new URL('../src/components/account/AuthDialog.vue', import.meta.url), 'utf8');

  assert.match(dialog, /CC98/);
  assert.match(dialog, /学校邮箱/);
  assert.match(dialog, /学校邮箱注册\/登录暂未开放/);
  assert.match(dialog, /submit-register-cc98/);
  assert.match(dialog, /submit-login-cc98/);
  assert.match(dialog, /v-if="props.mode === 'login'"/);
});
