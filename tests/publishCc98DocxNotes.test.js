import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createContentStore } from '../server/content/contentStore.js';
import { prepareDocxNotes, publishDocxNotes } from '../scripts/publish-cc98-docx-notes.mjs';

function manifest() {
  const notes = Array.from({ length: 30 }, (_, index) => {
    const floor = index + 3;
    return { courseCode: 'BIO2011F', sourceFloor: `${floor}L`, author: `学生${index + 1}`, teacher: '',
      body: '### 学习建议\n\n**完整正文**', plainBody: '学习建议\n完整正文',
      cc98Url: `https://www.cc98.org/topic/6003753/${Math.floor((floor - 1) / 10) + 1}#${(floor - 1) % 10 + 1}` };
  });
  notes.push(...['MED2307M', 'MED2308M', 'CAB0701G'].map((courseCode) => ({ courseCode, author: '站外课程作者' })));
  return { count: 33, sourceDocument: '资源楼.docx', sourceSha256: 'a'.repeat(64), notes };
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'zjubio-docx-publish-'));
  const filename = join(dir, 'content.sqlite');
  const store = createContentStore({ filename });
  store.initialize();
  store.close();
  const db = new DatabaseSync(filename);
  return { db, close() { db.close(); unlinkSync(filename); rmdirSync(dir); } };
}
const actor = { id: 7, name: '审核管理员' };
const notes = () => prepareDocxNotes(manifest(), new Set(['BIO2011F'])).included;

test('reviewed DOCX manifest includes exactly 30 site notes with plain resource-tower titles', () => {
  const prepared = prepareDocxNotes(manifest(), new Set(['BIO2011F']));
  assert.equal(prepared.included.length, 30);
  assert.equal(prepared.excluded.length, 3);
  assert.ok(prepared.included.every((note) => note.title === '资源楼' && note.type === 'experience'));
  assert.equal(prepared.included[0].summary, 'CC98 资源楼 3L');
  assert.throws(() => prepareDocxNotes({ ...manifest(), count: 34 }));
  const empty = manifest(); empty.notes[0].body = '';
  assert.throws(() => prepareDocxNotes(empty), /body/);
});

test('the corrected body-only manifest publishes 30 notes without the empty field-trip introduction', () => {
  const source = manifest();
  const prepared = prepareDocxNotes(source, new Set(['BIO2011F']));
  assert.equal(prepared.included.length, 30);
  const f = fixture();
  try {
    assert.equal(publishDocxNotes(f.db, prepared.included, { actor, apply: true }).created, 30);
  } finally { f.close(); }
});

test('dry run leaves data untouched; publication is reviewed, unowned and idempotent', () => {
  const f = fixture();
  try {
    const plan = publishDocxNotes(f.db, notes(), { actor });
    assert.equal(f.db.prepare('select count(*) as n from content_items').get().n, 0);
    const result = publishDocxNotes(f.db, notes(), { actor, apply: true, expectedPlan: plan.items });
    assert.equal(result.created, 30);
    assert.equal(f.db.prepare("select count(*) as n from content_items where status = 'published' and owner_id is null").get().n, 30);
    assert.equal(f.db.prepare("select count(*) as n from audit_logs where action = 'content.review'").get().n, 30);
    assert.equal(publishDocxNotes(f.db, notes(), { actor, apply: true }).skipped, 30);
    assert.equal(f.db.prepare('select count(*) as n from content_items').get().n, 30);
  } finally { f.close(); }
});

test('existing imported notes retain routes, teacher metadata and GPA while becoming published', () => {
  const f = fixture();
  try {
    const note = notes()[0];
    f.db.prepare(`insert into content_items (id, route_id, course_code, type, title, author, body,
      cc98_url, teacher, gpa, source_path, created_at, updated_at) values
      ('old-id', 'old-route', ?, 'experience', '旧标题', ?, '旧正文', ?, '陈老师', '4.8', 'cc98-bio-resource/v3/old', 'old', 'old')`)
      .run(note.courseCode, note.author, note.cc98Url);
    const result = publishDocxNotes(f.db, notes(), { actor, apply: true });
    assert.equal(result.updated, 1);
    assert.equal(result.created, 29);
    const item = f.db.prepare("select * from content_items where id = 'old-id'").get();
    assert.equal(item.route_id, 'old-route');
    assert.equal(item.teacher, '陈老师');
    assert.equal(item.gpa, '4.8');
    assert.equal(item.title, '资源楼');
    assert.equal(item.body, note.body);
    assert.equal(item.status, 'published');
  } finally { f.close(); }
});

test('concurrent edits and student-owned matches stop the import before any writes', () => {
  const f = fixture();
  try {
    const note = notes()[0];
    f.db.prepare(`insert into content_items (id, course_code, type, title, author, cc98_url, source_path,
      created_at, updated_at) values ('existing', ?, 'experience', '旧标题', ?, ?, 'cc98-bio-resource/v3/existing', 'old', 'old')`)
      .run(note.courseCode, note.author, note.cc98Url);
    const plan = publishDocxNotes(f.db, notes(), { actor });
    f.db.prepare("update content_items set body = '并发修改' where id = 'existing'").run();
    assert.throws(() => publishDocxNotes(f.db, notes(), { actor, apply: true, expectedPlan: plan.items }), /changed/);
    assert.equal(f.db.prepare('select count(*) as n from content_items').get().n, 1);
    f.db.prepare("update content_items set owner_id = 99 where id = 'existing'").run();
    assert.throws(() => publishDocxNotes(f.db, notes(), { actor, apply: true }), /individual review/);
    assert.equal(f.db.prepare('select count(*) as n from audit_logs').get().n, 0);
  } finally { f.close(); }
});

test('an error midway through the batch rolls back both posts and audit records', () => {
  const f = fixture();
  try {
    f.db.exec("create trigger fail_import before insert on content_items when new.author = '学生30' begin select raise(abort, 'test failure'); end");
    assert.throws(() => publishDocxNotes(f.db, notes(), { actor, apply: true }), /test failure/);
    assert.equal(f.db.prepare('select count(*) as n from content_items').get().n, 0);
    assert.equal(f.db.prepare('select count(*) as n from audit_logs').get().n, 0);
  } finally { f.close(); }
});

test('legacy absolute-floor CC98 links reuse the existing post rather than adding a duplicate', () => {
  const f = fixture();
  try {
    const note = notes().find((entry) => entry.sourceFloor === '14L');
    f.db.prepare(`insert into content_items (id, course_code, type, title, author, cc98_url, source_path,
      created_at, updated_at) values ('legacy-floor', ?, 'experience', '旧标题', ?, ?, 'cc98-bio-resource/v3/legacy-floor', 'old', 'old')`)
      .run(note.courseCode, note.author, 'https://www.cc98.org/topic/6003753/2#14');
    const result = publishDocxNotes(f.db, notes(), { actor, apply: true });
    assert.equal(result.updated, 1);
    assert.equal(result.created, 29);
    assert.equal(f.db.prepare("select cc98_url from content_items where id = 'legacy-floor'").get().cc98_url, note.cc98Url);
  } finally { f.close(); }
});
