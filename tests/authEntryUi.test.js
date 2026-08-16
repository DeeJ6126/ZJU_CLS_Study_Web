import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth entry components expose the real account menu without a test account switcher', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const accountPopover = await readFile(new URL('../src/components/account/AccountPopover.vue', import.meta.url), 'utf8');
  const settingsPanel = await readFile(new URL('../src/components/SettingsPanel.vue', import.meta.url), 'utf8');

  assert.match(app, /AccountPopover/);
  assert.match(app, /AuthDialog/);
  assert.match(app, /canSubmitResource/);
  assert.match(app, /canComment/);
  assert.match(app, /canFavorite/);
  assert.match(accountPopover, /CC98注册/);
  assert.match(accountPopover, /浙大邮箱注册/);
  assert.match(accountPopover, /登录/);
  assert.match(accountPopover, /站内消息/);
  assert.match(accountPopover, /unreadCount/);
  assert.equal(accountPopover.includes('UserSwitcher'), false);
  assert.equal(settingsPanel.includes('UserSwitcher'), false);
  assert.match(accountPopover, /AccountSwitcher/);
  assert.match(accountPopover, /select-demo/);
  assert.match(app, /demoIdentityId/);
  assert.match(app, /selectDemoIdentity/);
});

test('auth dialog supports CC98 and ZJU email registration and login flows', async () => {
  const dialog = await readFile(new URL('../src/components/account/AuthDialog.vue', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../src/styles/auth.css', import.meta.url), 'utf8');

  assert.match(dialog, /CC98/);
  assert.match(dialog, /浙大邮箱/);
  assert.doesNotMatch(dialog, /暂未开放/);
  assert.match(dialog, /submit-register-cc98/);
  assert.match(dialog, /submit-login-cc98/);
  assert.match(dialog, /request-email-code/);
  assert.match(dialog, /submit-register-email/);
  assert.match(dialog, /submit-login-email/);
  assert.match(dialog, /submit-reset-email/);
  assert.match(dialog, /submit-bind-email/);
  assert.match(styles, /\.auth-dialog__code-row/);
  assert.match(styles, /\.account-popover__signed-in-actions/);
  assert.match(styles, /var\(--demo-primary, var\(--color-primary\)\)/);
});
