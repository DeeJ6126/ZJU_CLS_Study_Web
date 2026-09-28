import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/components/admin/AdminPage.vue', 'utf8');
const styles = readFileSync('src/styles/admin.css', 'utf8');

test('consultation management exposes the schedule and mentor selection controls', () => {
  assert.match(page, /changeView\('consultation'\)/);
  assert.match(page, /consultationApiClient\.listCandidates\(candidateQuery\.value\.trim\(\)\)/);
  assert.match(page, /mentorUserId: selectedMentor\.value\.id/);
  assert.match(page, /id: result\.mentorUserId/);
  assert.match(page, /!consultationStatus\.value\?\.closed/);
  assert.match(page, /startsAt: startsAt\.toISOString\(\)/);
  assert.match(page, /endsAt: endsAt\.toISOString\(\)/);
  assert.match(page, /type="datetime-local" required/g);
  assert.match(page, /consultationApiClient\.closeSession\(\)/);
  assert.match(page, /提前关闭/);
});

test('demo administrator cannot contact real consultation management endpoints', () => {
  assert.match(page, /if \(!isAdmin\.value \|\| props\.isDemo\) return;/g);
  assert.match(page, /if \(props\.isDemo \|\| consultationBusy\.value\) return;/);
  assert.match(page, /if \(props\.isDemo \|\| consultationBusy\.value \|\| !window\.confirm/);
  assert.match(page, /演示管理员不能开启真实咨询室/);
});

test('consultation controls adapt to narrow management layouts', () => {
  assert.match(styles, /\.admin-consultation__fields\s*\{/);
  assert.match(styles, /\.admin-consultation__candidates\s*\{/);
  assert.match(styles, /@media \(max-width: 620px\)\s*\{\s*\.admin-consultation__status/);
});
