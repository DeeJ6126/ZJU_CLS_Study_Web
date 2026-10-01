import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../server/content/contentStore.js';
import { handleNoticeHttpRequest } from '../server/notice/noticeHttpService.js';
import { noticeListOptions, toPublicNotice, validateNoticeInput } from '../server/notice/noticeService.js';
import { readNoticeAttachment, removeNoticeAttachment, validateNoticeAttachment } from '../server/notice/noticeFileService.js';

const draft = { title: 'Notice', category: 'general', publishedDate: '2026-10-01' };
const publishable = { ...draft, summary: 'Summary', body: 'Markdown body' };
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function zipFixture(entries) {
  const locals = [], central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const bytes = Buffer.from(content), fileName = Buffer.from(name);
    const local = Buffer.alloc(30), index = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(bytes), 14); local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(fileName.length, 26);
    index.writeUInt32LE(0x02014b50); index.writeUInt16LE(20, 4); index.writeUInt16LE(20, 6);
    index.writeUInt32LE(crc32(bytes), 16); index.writeUInt32LE(bytes.length, 20);
    index.writeUInt32LE(bytes.length, 24); index.writeUInt16LE(fileName.length, 28); index.writeUInt32LE(offset, 42);
    locals.push(local, fileName, bytes); central.push(index, fileName);
    offset += local.length + fileName.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function officeFixture(extension, extra = []) {
  const path = extension === '.docx' ? 'word/document.xml' : 'xl/workbook.xml';
  const mime = extension === '.docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
  return zipFixture([['[Content_Types].xml', `<Types><Override PartName="/${path}" ContentType="${mime}"/></Types>`],
    ['_rels/.rels', '<Relationships/>'], [path, extension === '.docx' ? '<w:document xmlns:w="test"/>' : '<workbook/>'], ...extra]);
}

test('notice validation handles drafts, publishing, dates, safe URLs, and target metadata', () => {
  assert.equal(validateNoticeInput(draft).ok, true);
  assert.equal(validateNoticeInput(draft, { publish: true }).ok, false);
  assert.equal(validateNoticeInput(publishable, { publish: true }).ok, true);
  for (const changes of [{ title: '' }, { category: 'invalid' }, { publishedDate: '2026-02-30' },
    { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://user:pass@example.test' },
    { sourceUrl: 'https://example.test/\nfoo' }, { deadline: '2026-10-02T18:00' },
    { deadline: '2026-02-30T18:00:00+08:00' }, { deadline: '2026-10-02T25:00:00+08:00' },
    { majorIds: ['not-a-program'] }, { cohortYears: ['2026'] }, { pinned: 'false' }, { status: 'published' }]) {
    assert.equal(validateNoticeInput({ ...publishable, ...changes }).ok, false, JSON.stringify(changes));
  }
  assert.equal(validateNoticeInput(null).ok, false);
  assert.equal(validateNoticeInput([]).ok, false);
  assert.equal(validateNoticeInput({ ...draft, deadline: '2026-10-02T18:00:00+08:00' }).value.deadline, '2026-10-02T10:00:00.000Z');
  assert.equal(noticeListOptions(new URLSearchParams('pageSize=999')).ok, false);
});

test('notice attachments reject forged, mismatched, macro, traversal, encrypted and expansion-bomb packages', async () => {
  assert.equal((await validateNoticeAttachment({ buffer: Buffer.from('%PDF-1.7\n'), fileName: 'test.pdf', mimeType: 'application/pdf' })).ok, true);
  for (const [fileName, mimeType, buffer] of [
    ['../../test.pdf', 'application/pdf', Buffer.from('%PDF-1.7')],
    ['test.pdf', 'application/pdf', Buffer.from('not a PDF')],
    ['test.exe', 'application/pdf', Buffer.from('%PDF-1.7')],
    ['test.docx', docxMime, Buffer.from('PK\x03\x04 forged')],
    ['test.docx', docxMime, officeFixture('.xlsx')],
    ['test.docx', docxMime, officeFixture('.docx', [['word/vbaProject.bin', 'macro']])],
    ['test.xlsx', xlsxMime, officeFixture('.xlsx', [['../escape', 'x']])],
    ['test.pdf', docxMime, Buffer.from('%PDF-1.7')],
  ]) assert.equal((await validateNoticeAttachment({ buffer, fileName, mimeType })).ok, false, fileName);
  for (const extension of ['.docx', '.xlsx']) {
    const buffer = officeFixture(extension);
    assert.equal((await validateNoticeAttachment({ buffer, fileName: `test${extension}`, mimeType: extension === '.docx' ? docxMime : xlsxMime })).ok, true);
  }
  const encrypted = officeFixture('.xlsx'); encrypted.writeUInt16LE(1, 6);
  assert.equal((await validateNoticeAttachment({ buffer: encrypted, fileName: 'test.xlsx', mimeType: xlsxMime })).ok, false);
  const bomb = officeFixture('.xlsx');
  const centralOffset = bomb.readUInt32LE(bomb.length - 6);
  bomb.writeUInt32LE(101 * 1024 * 1024, centralOffset + 24);
  assert.equal((await validateNoticeAttachment({ buffer: bomb, fileName: 'test.xlsx', mimeType: xlsxMime })).ok, false);
  assert.equal((await validateNoticeAttachment({ buffer: Buffer.alloc(25 * 1024 * 1024 + 1), fileName: 'test.pdf', mimeType: 'application/pdf' })).status, 413);
  assert.equal(readNoticeAttachment(tmpdir(), '../escape.pdf'), null);
  assert.equal(removeNoticeAttachment(tmpdir(), '../escape.pdf'), false);
});

test('notice store persists in the content database and filters before stable pagination', () => {
  const directory = mkdtempSync(join(tmpdir(), 'notice-store-'));
  const filename = join(directory, 'content.sqlite');
  let store = createContentStore({ filename }); store.initialize();
  try {
    store.createNotice({ ...publishable, id: 'pinned', pinned: true, status: 'published', publishedDate: '2026-01-01' });
    store.createNotice({ ...publishable, id: 'restricted', status: 'published', title: 'Special Award', category: 'awards',
      majorIds: ['biology'], cohortYears: [2026], deadline: '2026-10-01T10:00:00.000Z' });
    store.createNotice({ ...publishable, id: 'expired', status: 'published', deadline: '2026-09-30T10:00:00.000Z' });
    store.createNotice({ ...draft, id: 'private' });
    assert.equal(store.listNotices({ publicOnly: true }).total, 3);
    assert.equal(store.listNotices({ publicOnly: true, pageSize: 1 }).items[0].id, 'pinned');
    assert.equal(store.listNotices({ publicOnly: true, majorId: 'ecology', cohortYear: 2025 }).total, 2);
    assert.equal(store.listNotices({ publicOnly: true, query: 'special', category: 'awards' }).total, 1);
    assert.equal(store.listNotices({ publicOnly: true, query: '%' }).total, 0);
    assert.equal(store.listNotices({ publicOnly: true, timing: 'active', now: '2026-10-01T10:00:00.000Z' }).total, 1);
    assert.equal(store.listNotices({ publicOnly: true, timing: 'expired', now: '2026-10-01T10:00:00.000Z' }).total, 2);
    store.attachNoticeFile('private', { id: 'attachment', fileName: 'test.pdf', storedName: 'secret.pdf', mimeType: 'application/pdf', size: 10 });
    store.close(); store = createContentStore({ filename }); store.initialize();
    assert.equal(store.findNoticeById('private').attachments[0].id, 'attachment');
    const publicNotice = toPublicNotice({ ...store.findNoticeById('private'), createdBy: 1 });
    assert.equal('storedName' in publicNotice.attachments[0], false);
    assert.equal('createdBy' in publicNotice, false);
    assert.equal(publicNotice.attachments[0].url, '/zjubio/api/notices/private/attachments/attachment');
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('notice HTTP permissions, draft visibility, lifecycle, attachment safety and audit trail', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'notice-http-'));
  const store = createContentStore({ filename: ':memory:' }); store.initialize();
  const uploadBodyWaiters = [];
  let releasePatchBody;
  let notifyPatchBodyRead;
  const patchBodyWaiting = new Promise((resolve) => { notifyPatchBodyRead = resolve; });
  const server = createServer(async (request, response) => {
    const auth = request.headers.cookie;
    const user = auth === 'admin' ? { role: 'admin', nickname: 'Admin' } : auth === 'student' ? { role: 'student' } : { role: 'guest' };
    const sendJson = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    try {
      await handleNoticeHttpRequest({ request, response, url: new URL(request.url, `http://${request.headers.host}`),
        user, userId: auth === 'admin' ? 1 : auth === 'student' ? 2 : null, contentStore: store, uploadDirectory: directory, sendJson,
        readJsonBody: async (req) => { const chunks = []; for await (const chunk of req) chunks.push(chunk);
          if (req.headers['x-notice-test-barrier'] === 'patch') {
            notifyPatchBodyRead(); await new Promise((resolve) => { releasePatchBody = resolve; });
          }
          return JSON.parse(Buffer.concat(chunks).toString() || '{}'); },
        readBinaryBody: async (req, limit) => { if (+req.headers['content-length'] > limit) return null;
          const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > limit) return null; chunks.push(chunk); }
          if (req.headers['x-notice-test-barrier'] === 'concurrent') await new Promise((resolve) => {
            uploadBodyWaiters.push(resolve);
            if (uploadBodyWaiters.length === 2) uploadBodyWaiters.forEach((release) => release());
          });
          return Buffer.concat(chunks); },
      });
    } catch { sendJson(response, 500, { message: 'Server error' }); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, { identity = 'admin', method = 'GET', body, headers = {} } = {}) => fetch(base + path, {
    method, headers: { ...(identity ? { cookie: identity } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  try {
    for (const method of ['GET', 'POST']) {
      assert.equal((await request('/api/admin/notices', { identity: '', method, body: method === 'POST' ? draft : undefined })).status, 401);
      assert.equal((await request('/api/admin/notices', { identity: 'student', method, body: method === 'POST' ? draft : undefined })).status, 403);
    }
    assert.equal((await request('/api/admin/notices', { method: 'POST', body: draft, headers: { origin: 'https://evil.test' } })).status, 403);
    assert.equal((await request('/api/admin/notices', { method: 'POST', body: draft, headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    const created = await request('/api/admin/notices', { method: 'POST', body: draft }); assert.equal(created.status, 201);
    const id = (await created.json()).notice.id;
    assert.equal((await request(`/api/notices/${id}`, { identity: '' })).status, 404);
    assert.equal((await (await request('/api/notices', { identity: '' })).json()).total, 0);
    assert.equal((await request(`/api/admin/notices/${id}/publish`, { method: 'POST', body: {} })).status, 400);
    const uploadPath = `/api/admin/notices/${id}/attachments`;
    const upload = (fileName, bytes = Buffer.from('%PDF-1.7\nfixture'), mimeType = 'application/pdf', identity = 'admin', marker = 'notice-attachment') => fetch(base + uploadPath, {
      method: 'POST', headers: { cookie: identity, 'content-type': mimeType, 'x-file-name': encodeURIComponent(fileName), 'x-notice-upload': marker }, body: bytes,
    });
    assert.equal((await upload('test.pdf', undefined, undefined, '')).status, 401);
    assert.equal((await upload('test.pdf', undefined, undefined, 'student')).status, 403);
    assert.equal((await upload('test.pdf', undefined, undefined, 'admin', '')).status, 415);
    assert.equal((await upload('../escape.pdf')).status, 400);
    assert.equal((await upload('forged.pdf', Buffer.from('fake'))).status, 400);
    assert.equal((await upload('test.docx', Buffer.from('PK\x03\x04fake'), docxMime)).status, 400);
    const uploaded = await upload('测试附件.pdf'); assert.equal(uploaded.status, 201);
    const attachment = (await uploaded.json()).notice.attachments[0];
    assert.equal('storedName' in attachment, false);
    const attachNoticeFile = store.attachNoticeFile;
    store.attachNoticeFile = () => { throw new Error('Injected database failure'); };
    assert.equal((await upload('unattached.pdf')).status, 500);
    store.attachNoticeFile = attachNoticeFile;
    assert.equal(readdirSync(join(directory, 'notice-attachments')).length, 1);
    const download = `/api/notices/${id}/attachments/${attachment.id}`;
    for (const identity of ['', 'student']) assert.equal((await request(download, { identity })).status, 404);
    assert.equal((await request(download)).status, 200);
    assert.equal((await request(`/api/admin/notices/${id}`, { identity: 'student' })).status, 403);
    assert.equal((await request(`/api/admin/notices/${id}`, { identity: 'admin' })).status, 200);
    assert.equal((await request(`/api/admin/notices/${id}`, { method: 'PATCH', body: { summary: 'Summary', pinned: true } })).status, 200);
    assert.equal((await request(`/api/admin/notices/${id}/publish`, { method: 'POST', body: {} })).status, 200);
    const downloaded = await request(download, { identity: '' }); assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
    assert.match(downloaded.headers.get('content-disposition'), /^attachment;/);
    assert.equal((await downloaded.text()), '%PDF-1.7\nfixture');
    assert.equal((await request(`/api/admin/notices/${id}/attachments/${attachment.id}`, { method: 'DELETE' })).status, 400);
    assert.equal((await request(`/api/admin/notices/${id}`, { method: 'PATCH', body: { summary: '' } })).status, 400);
    assert.equal((await request('/api/notices?page=0', { identity: '' })).status, 400);
    assert.equal((await request('/api/notices/%', { identity: '' })).status, 400);
    assert.equal((await (await request('/api/notices', { identity: '' })).json()).total, 1);
    assert.equal((await request(`/api/notices/${id}/comments`, { method: 'POST', body: {} })).status, 404);
    assert.equal((await request(`/api/admin/notices/${id}/archive`, { method: 'POST', body: {} })).status, 200);
    assert.equal((await request(download, { identity: '' })).status, 404);
    assert.equal((await request(`/api/admin/notices/${id}/attachments/${attachment.id}`, { method: 'DELETE', headers: { origin: 'https://evil.test' } })).status, 403);
    assert.equal((await request(`/api/admin/notices/${id}/attachments/${attachment.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await request(download)).status, 404);
    assert.deepEqual(readdirSync(join(directory, 'notice-attachments')), []);
    const patchRace = store.createNotice({ ...publishable, id: 'concurrent-patch-test' });
    const slowPatch = request(`/api/admin/notices/${patchRace.id}`, { method: 'PATCH', body: { summary: '' },
      headers: { 'x-notice-test-barrier': 'patch' } });
    await patchBodyWaiting;
    assert.equal((await request(`/api/admin/notices/${patchRace.id}/publish`, { method: 'POST', body: {} })).status, 200);
    releasePatchBody();
    assert.equal((await slowPatch).status, 400);
    assert.equal(store.findNoticeById(patchRace.id).summary, 'Summary');
    const concurrent = store.createNotice({ ...draft, id: 'concurrent-upload-test' });
    for (let index = 0; index < 19; index++) store.attachNoticeFile(concurrent.id, {
      id: `existing-${index}`, fileName: `existing-${index}.pdf`, mimeType: 'application/pdf',
      storedName: `existing-${index}.pdf`, size: 10,
    });
    const concurrentUpload = (fileName) => fetch(`${base}/api/admin/notices/${concurrent.id}/attachments`, {
      method: 'POST', headers: { cookie: 'admin', 'content-type': 'application/pdf', 'x-file-name': fileName,
        'x-notice-upload': 'notice-attachment', 'x-notice-test-barrier': 'concurrent' },
      body: Buffer.from('%PDF-1.7\nfixture'),
    });
    const raced = await Promise.all([concurrentUpload('race-one.pdf'), concurrentUpload('race-two.pdf')]);
    assert.deepEqual(raced.map((result) => result.status).sort(), [201, 400]);
    assert.equal(store.findNoticeById(concurrent.id).attachments.length, 20);
    assert.equal(readdirSync(join(directory, 'notice-attachments')).length, 1);
    assert.throws(() => store.attachNoticeFile(concurrent.id, {
      id: 'over-limit', fileName: 'limit.pdf', storedName: 'limit.pdf', mimeType: 'application/pdf', size: 10,
    }), { code: 'NOTICE_ATTACHMENT_LIMIT' });
    const corrupt = store.createNotice({ ...draft, id: 'corrupt-storage-test' });
    store.attachNoticeFile(corrupt.id, { id: 'bad-file', fileName: 'test.pdf', mimeType: 'application/pdf',
      storedName: '../escape.pdf', size: 10 });
    assert.equal((await request('/api/admin/notices/corrupt-storage-test/attachments/bad-file', { method: 'DELETE' })).status, 500);
    assert.equal(store.findNoticeById(corrupt.id).attachments.length, 1);
    for (const action of ['notice.create', 'notice.update', 'notice.publish', 'notice.archive', 'notice.file.add', 'notice.file.remove']) {
      assert.equal(store.listAuditLogs({ action }).length > 0, true, action);
    }
  } finally {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    store.close(); rmSync(directory, { recursive: true, force: true });
  }
});
