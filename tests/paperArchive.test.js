import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, openSync, closeSync, ftruncateSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Open } from 'unzipper-esm';
import { preparePaperArchive, createPaperArchive, MAX_PAPER_ARCHIVE_FILES } from '../server/content/paperArchiveService.js';
import { handleContentHttpRequest } from '../server/content/contentHttpService.js';

const pdf = Buffer.from('%PDF-1.4\noriginal exam bytes');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'paper-archive-'));
  const uploads = join(root, 'uploads'), publicDirectory = join(root, 'public');
  mkdirSync(uploads); mkdirSync(join(publicDirectory, 'resource'), { recursive: true });
  writeFileSync(join(uploads, 'exam.pdf'), pdf);
  writeFileSync(join(publicDirectory, 'resource/static.pdf'), pdf);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const items = [
    { id: 'a', courseCode: 'BIO2110F', type: 'paper', status: 'published', title: '../同名试卷', year: '2024-2025', teacher: '甲/乙', file: { storedName: 'exam.pdf', fileName: '原卷.pdf' } },
    { id: 'b', courseCode: 'BIO2110F', type: 'paper', status: 'published', title: '../同名试卷', year: '2023-2024', teacher: '乙', file: { url: '/zjubio/resource/static.pdf' } },
    { id: 'private', courseCode: 'BIO2110F', type: 'paper', status: 'draft', file: { storedName: 'missing.pdf' } },
    { id: 'archived', courseCode: 'BIO2110F', type: 'paper', status: 'archived', file: { storedName: 'missing.pdf' } },
    { id: 'other', courseCode: 'BIO2019F', type: 'paper', status: 'published', file: { storedName: 'missing.pdf' } },
    { id: 'note', courseCode: 'BIO2110F', type: 'material', status: 'published', file: { storedName: 'missing.pdf' } },
    { id: 'external', courseCode: 'BIO2110F', type: 'paper', status: 'published', file: { url: 'https://file.cc98.org/never-fetch.pdf' } },
  ];
  return { courseCode: 'BIO2110F', uploadDirectory: uploads, publicDirectory,
    contentStore: { listPublishedByCourse: () => items }, items };
}
async function zipBytes(files) {
  const zip = createPaperArchive(files), parts = [];
  zip.on('error', error => zip.outputStream.destroy(error));
  zip.end();
  for await (const part of zip.outputStream) parts.push(part);
  return Buffer.concat(parts);
}

test('paper ZIP contains only published course PDFs, preserves bytes and handles duplicate safe names', async t => {
  const f = fixture(t), result = await preparePaperArchive(f);
  assert.equal(result.ok, true); assert.equal(result.files.length, 2);
  assert.ok(result.files.every(file => !/[\\/]/.test(file.name) && !file.name.startsWith('.')));
  assert.notEqual(result.files[0].name, result.files[1].name);
  const archive = await Open.buffer(await zipBytes(result.files));
  assert.equal(archive.files.length, 2);
  for (const file of archive.files) assert.deepEqual(await file.buffer(), pdf);
});

test('paper ZIP applies the same combined academic-year and multi-teacher filters as the list', async t => {
  const f = fixture(t);
  const result = await preparePaperArchive({ ...f, year: '2024-2025', teacher: '乙' });
  assert.equal(result.files.length, 1);
  assert.equal((await preparePaperArchive({ ...f, year: '2023-2024', teacher: '甲' })).status, 404);
  assert.equal((await preparePaperArchive({ ...f, year: 'x'.repeat(21) })).status, 400);
  assert.equal((await preparePaperArchive({ ...f, teacher: 'x'.repeat(41) })).status, 400);
  assert.equal((await preparePaperArchive({ ...f, courseCode: '../bad' })).status, 400);
});

test('paper ZIP rejects unsafe, missing and forged local files before starting a download', async t => {
  const f = fixture(t), original = f.items[0].file;
  for (const file of [{ storedName: '../exam.pdf' }, { url: '/resource/../../secret.pdf' }, { url: '/resource/%2e%2e/%2e%2e/secret.pdf' }, { storedName: 'missing.pdf' }]) {
    f.items[0].file = file;
    assert.equal((await preparePaperArchive(f)).status, 409);
  }
  writeFileSync(join(f.uploadDirectory, 'bad.pdf'), 'not PDF');
  f.items[0].file = { storedName: 'bad.pdf' };
  assert.equal((await preparePaperArchive(f)).status, 409);
  f.items[0].file = original;
});

test('paper ZIP bounds file count and aggregate bytes', async t => {
  const f = fixture(t);
  f.items.splice(0, f.items.length, ...Array.from({ length: MAX_PAPER_ARCHIVE_FILES + 1 }, (_, id) => ({ ...f.items[0], id })));
  assert.equal((await preparePaperArchive(f)).status, 413);
  const fd = openSync(join(f.uploadDirectory, 'large.pdf'), 'w');
  try { ftruncateSync(fd, 25 * 1024 * 1024); writeSync(fd, Buffer.from('%PDF-')); }
  finally { closeSync(fd); }
  const item = { ...f.items[0], file: { storedName: 'large.pdf' } };
  f.items.splice(0, f.items.length, ...Array.from({ length: 5 }, (_, id) => ({ ...item, id })));
  assert.equal((await preparePaperArchive(f)).status, 413);
});

test('public paper archive HTTP streams one ZIP and returns a useful empty-filter error', async t => {
  const f = fixture(t);
  const server = createServer(async (request, response) => {
    await handleContentHttpRequest({ request, response, url: new URL(request.url, 'http://fixture'), user: null,
      ...f, sendJson(res, status, body) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); } });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/content/courses/BIO2110F/papers/download`;
  const response = await fetch(base + '?year=2024-2025&teacher=' + encodeURIComponent('乙'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  assert.match(response.headers.get('content-disposition'), /^attachment;/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const archive = await Open.buffer(Buffer.from(await response.arrayBuffer()));
  assert.equal(archive.files.length, 1); assert.deepEqual(await archive.files[0].buffer(), pdf);
  const empty = await fetch(base + '?year=missing');
  assert.equal(empty.status, 404); assert.match((await empty.json()).message, /没有可下载/);
});
