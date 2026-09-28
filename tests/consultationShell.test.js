import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { demoTopPages } from '../src/data/quizDemo.js';
import { buildHashWithQuery, getDemoPageFromHash, getHashQuery } from '../src/services/demoNavigationService.js';

test('consultation route keeps mentor conversation selection in the hash', () => {
  const href = buildHashWithQuery('consultation', { conversation: 'chat/1' });
  assert.equal(getDemoPageFromHash(href, demoTopPages), 'consultation');
  assert.equal(getHashQuery(href).get('conversation'), 'chat/1');
  assert.equal(demoTopPages.find((page) => page.id === 'consultation')?.label, '咨询');
});

test('shell gates navigation and mounts consultation with mentor notification polling', async () => {
  const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/demo.css', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(app, /page\.id === 'consultation' && !consultationAvailable/);
  assert.match(app, /<ConsultationPage[\s\S]*:initial-conversation-id="consultationConversationId"/);
  assert.match(app, /refreshConsultationInbox/);
  assert.match(app, /consultationToast/);
  assert.match(css, /\.consultation-toast\s*\{/);
  assert.match(main, /styles\/consultation\.css/);
});
