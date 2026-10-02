import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { demoTopPages } from '../src/data/quizDemo.js';
import { getDemoPageFromHash } from '../src/services/demoNavigationService.js';

test('more supports direct navigation while about is the last page', () => {
  assert.equal(demoTopPages.at(-1).id, 'about');
  assert.equal(demoTopPages.find((page) => page.id === 'more').label, '更多');
  assert.equal(getDemoPageFromHash('#more', demoTopPages), 'more');
  assert.equal(getDemoPageFromHash('#more?section=homepages', demoTopPages), 'more');
});

test('more restores the shared directory client and guarded student submission form', () => {
  const source = readFileSync('src/components/MorePage.vue', 'utf8');
  const { descriptor, errors } = parse(source);
  assert.deepEqual(errors, []);
  const script = compileScript(descriptor, { id: 'more-test' });
  const template = compileTemplate({ source: descriptor.template.content, filename: 'MorePage.vue', id: 'more-test', compilerOptions: { bindingMetadata: script.bindings } });
  assert.deepEqual(template.errors, []);
  assert.match(source, /studentHomepageApiClient/);
  assert.match(source, /submitApplication\(\{ \.\.\.form \}\)/);
  assert.match(source, /imageFileToAvatarDataUrl/);
  assert.match(source, /props\.canSubmit/);
  assert.doesNotMatch(source, /verifications|user\.role|user\.email/);
  assert.match(source, /noopener noreferrer/);
  assert.match(source, /viewerKey/);
});

test('homepage maintenance and review are nested within admin More rather than a separate nav item', () => {
  const admin = readFileSync('src/components/admin/AdminPage.vue', 'utf8');
  assert.match(admin, /changeView\('more'\)">更多/);
  assert.doesNotMatch(admin, /changeView\('homepages'\)/);
  assert.match(admin, /aria-label="更多管理"/);
  assert.match(admin, /role="tab" aria-selected="true">同学主页/);
  assert.match(admin, /decideHomepageApplication\(item, 'approve'\)/);
  assert.match(admin, /decideHomepageApplication\(item, 'reject'\)/);
});
