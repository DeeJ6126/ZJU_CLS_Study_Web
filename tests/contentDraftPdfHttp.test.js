import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleContentHttpRequest } from '../server/content/contentHttpService.js';

test('course PDF drafts and archived PDFs are previewable only by administrators', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'course-draft-pdf-'));
  const bytes = Buffer.from('%PDF-1.4\nfixture');
  writeFileSync(join(directory, 'fixture.pdf'), bytes);
  try {
    for (const status of ['draft', 'archived', 'published']) {
      for (const role of [null, 'guest', 'student', 'admin']) {
       for (const download of [false, true]) {
        let code, headers, body;
        const response = { writeHead(value, fields) { code = value; headers = fields; }, end(value) { body = value; } };
        const handled = await handleContentHttpRequest({ request: { method: 'GET' }, response,
          url: new URL(`http://localhost/api/content/files/fixture${download ? '?download=1' : ''}`), user: role ? { role } : null,
          contentStore: { findById: () => ({ status, file: { storedName: 'fixture.pdf', fileName: '试卷.pdf' } }) },
          uploadDirectory: directory,
          sendJson(_response, value, data) { code = value; body = data; },
        });
        assert.equal(handled, true);
        const allowed = status === 'published' || role === 'admin';
        assert.equal(code, allowed ? 200 : 404, `${status}/${role}`);
        if (allowed) {
          assert.deepEqual(body, bytes);
          assert.equal(headers['content-type'], 'application/pdf');
          assert.equal(headers['cache-control'], 'private, no-store');
          assert.equal(headers['content-disposition'], `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent('试卷.pdf')}`);
        }
       }
      }
    }
    for (const file of [null, { storedName: '../fixture.pdf' }, { storedName: 'missing.pdf' }]) {
      let status;
      await handleContentHttpRequest({ request: { method: 'GET' }, response: {},
        url: new URL('http://localhost/api/content/files/fixture?download=1'), user: { role: 'admin' },
        contentStore: { findById: () => ({ status: 'draft', file }) }, uploadDirectory: directory,
        sendJson(_response, value) { status = value; },
      });
      assert.equal(status, 404);
    }
  } finally { rmSync(directory, { recursive: true }); }
});
