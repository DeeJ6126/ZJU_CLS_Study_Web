import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('account header uses direct profile/login and a message bell instead of an account card', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const profile = await readFile(new URL('../src/components/profile/ProfilePage.vue', import.meta.url), 'utf8');
  const settingsPanel = await readFile(new URL('../src/components/SettingsPanel.vue', import.meta.url), 'utf8');

  assert.doesNotMatch(app, /AccountPopover|accountOpen|accountPopoverRef/);
  assert.match(app, /AuthDialog/);
  assert.match(app, /canSubmitResource/);
  assert.match(app, /canComment/);
  assert.match(app, /canFavorite/);
  assert.match(app, /demo-notification-bell/);
  assert.match(app, /bellPaths/);
  assert.match(app, /unreadNotificationCount > 0/);
  assert.match(app, /viewerIsGuest \? openAuthDialog\('login'\) : openOwnProfile\(\)/);
  assert.match(profile, /v-if="isOwn" class="profile-account-footer"/);
  assert.match(profile, /v-if="canOpenAdmin"/);
  assert.match(profile, /emit\('logout'\)/);
  assert.equal(settingsPanel.includes('UserSwitcher'), false);
  assert.match(app, /demoIdentityId/);
  assert.match(app, /selectDemoIdentity/);
  assert.match(app, /demoIdentityEnabled = import\.meta\.env\.DEV/);
  assert.match(app, /if \(!demoIdentityEnabled\) saveDemoIdentityId\(''\)/);
  assert.doesNotMatch(app, /<AccountSwitcher/);
});

test('auth dialog exposes only student-ID registration, login, and recovery', async () => {
  const dialog = await readFile(new URL('../src/components/account/AuthDialog.vue', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../src/styles/auth.css', import.meta.url), 'utf8');

  assert.doesNotMatch(dialog, /CC98/);
  assert.match(dialog, /浙大邮箱/);
  assert.doesNotMatch(dialog, /暂未开放/);
  assert.doesNotMatch(dialog, /submit-register-cc98/);
  assert.doesNotMatch(dialog, /submit-login-cc98/);
  assert.match(dialog, /request-email-code/);
  assert.match(dialog, /submit-register-email/);
  assert.match(dialog, /submit-login-email/);
  assert.match(dialog, /submit-reset-email/);
  assert.match(dialog, /switch-mode', 'register'/);
  assert.doesNotMatch(dialog, /submit-bind-email/);
  assert.match(styles, /\.auth-dialog__code-row/);
  assert.match(styles, /\.account-popover__signed-in-actions/);
  assert.match(styles, /var\(--demo-primary, var\(--color-primary\)\)/);
});
