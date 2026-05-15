import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultThemeId, themes } from '../src/data/themes.js';
import { profile } from '../src/data/profile.js';

test('theme catalog contains named themes and defaults to minimalist white', () => {
  assert.equal(defaultThemeId, 'minimal-white');
  assert.deepEqual(
    themes.map((theme) => theme.name),
    ['石墨白', '林冠绿', '冰原蓝', '星夜黑', '电弧黑'],
  );
});

test('theme catalog maps to the selected theme-factory palettes', () => {
  const swatchesByTheme = Object.fromEntries(themes.map((theme) => [theme.id, theme.swatches]));

  assert.deepEqual(swatchesByTheme['minimal-white'], ['#36454f', '#708090', '#d3d3d3', '#ffffff']);
  assert.deepEqual(swatchesByTheme['plant-green'], ['#2d4a2b', '#7d8471', '#a4ac86', '#faf9f6']);
  assert.deepEqual(swatchesByTheme['life-blue'], ['#d4e4f7', '#4a6fa5', '#c0c0c0', '#fafafa']);
  assert.deepEqual(swatchesByTheme['silent-black'], ['#2b1e3e', '#4a4e8f', '#a490c2', '#e6e6fa']);
  assert.deepEqual(swatchesByTheme['tech-innovation'], ['#0066ff', '#00ffff', '#1e1e1e', '#ffffff']);
});

test('profile settings expose nickname, CC98 nickname, and avatar initials', () => {
  assert.equal(profile.nickname, '生科学子');
  assert.equal(profile.cc98Nickname, '待认证');
  assert.equal(profile.avatarInitials, 'LS');
});
