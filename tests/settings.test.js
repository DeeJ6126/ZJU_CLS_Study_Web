import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultThemeId, themes } from '../src/data/themes.js';
import { profile } from '../src/data/profile.js';

test('theme catalog contains four named themes and defaults to minimalist white', () => {
  assert.equal(defaultThemeId, 'minimal-white');
  assert.deepEqual(
    themes.map((theme) => theme.name),
    ['极简白', '植物绿', '生命蓝', '沉默黑'],
  );
});

test('profile settings expose nickname, CC98 nickname, and avatar initials', () => {
  assert.equal(profile.nickname, '生科学子');
  assert.equal(profile.cc98Nickname, '待认证');
  assert.equal(profile.avatarInitials, 'LS');
});
