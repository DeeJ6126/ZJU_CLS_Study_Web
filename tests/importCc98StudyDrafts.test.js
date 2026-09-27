import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { importStudyDrafts, prepareStudyDrafts, reviseStudyDrafts } from '../scripts/import-cc98-study-drafts.mjs';

function makeRow(overrides = {}) {
  return {
    courseCode: 'BIO2011F', title: '生化甲课程心得', author: '23级 张同学',
    teacher: '陈老师', body: '# 心得\n\n正文', bodyFormat: 'markdown',
    cc98Url: 'https://www.cc98.org/topic/6003753/1#5', sourceFloor: '5L',
    gradePercentage: '', permissionStatus: '未确认', publishReady: false,
    boundaryStatus: '已确认', textStatus: 'complete', ...overrides,
  };
}

function makeDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    create table content_items (
      id text primary key, route_id text, course_code text, type text, title text,
      summary text, author text, body text, body_format text, cc98_url text,
      grade_percentage text, teacher text, status text, source_path text unique,
      created_at text, updated_at text
    );
    create table audit_logs (
      id text primary key, action text, entity_type text, entity_id text,
      target_title text, course_code text, actor_name text, detail text, created_at text
    );
  `);
  return db;
}

test('only reviewed, complete site-course notes become unpublished drafts', () => {
  const drafts = prepareStudyDrafts(`${JSON.stringify(makeRow())}\n`);
  const db = makeDatabase();
  assert.equal(importStudyDrafts(db, drafts).created, 0);
  assert.equal(db.prepare('select count(*) as count from content_items').get().count, 0);
  const created = importStudyDrafts(db, drafts, { apply: true });
  assert.equal(created.created, 1);
  const stored = db.prepare('select * from content_items').get();
  assert.equal(stored.status, 'draft');
  assert.equal(stored.body, '# 心得\n\n正文');
  assert.equal(stored.teacher, '陈老师');
  assert.equal(stored.author, '23级 张同学');
  assert.equal(db.prepare('select count(*) as count from audit_logs').get().count, 1);
  assert.equal(importStudyDrafts(db, drafts, { apply: true }).skipped, 1);
  db.close();
});

test('rejects out-of-scope, partial, or publish-ready notes before writes', () => {
  for (const changes of [
    { courseCode: 'MED2307M' }, { textStatus: 'partial' },
    { publishReady: true }, { permissionStatus: '已确认' },
    { boundaryStatus: '待人工复核' }, { body: '' },
  ]) {
    assert.throws(() => prepareStudyDrafts(JSON.stringify(makeRow(changes))));
  }
});

test('duplicate or changed source records never create a second draft', () => {
  const db = makeDatabase();
  const [draft] = prepareStudyDrafts(JSON.stringify(makeRow()));
  importStudyDrafts(db, [draft], { apply: true });
  db.prepare('update content_items set body = ?').run('管理员修改过的正文');
  assert.throws(() => importStudyDrafts(db, [draft], { apply: true }), /changed/);
  assert.equal(db.prepare('select count(*) as count from content_items').get().count, 1);
  db.close();
});

test('normalizes title, summary and repeated course headings without changing provenance', () => {
  const original = makeRow({
    title: '生物化学（甲）课程介绍',
    body: '# BIO2011F（071B0051）生物化学（甲）\n\n## 课程介绍（陈老师） by 23级 张同学\n\n### 课程简介\n\n正文',
  });
  const [draft] = prepareStudyDrafts(JSON.stringify(original));
  assert.equal(draft.title, '资源楼（陈老师）');
  assert.equal(draft.summary, 'CC98 资源楼 5L。');
  assert.equal(draft.body, '### 课程简介\n\n正文');
  assert.equal(prepareStudyDrafts(JSON.stringify({ ...original, teacher: '' }))[0].title, '资源楼');
});

test('revises only unchanged imported drafts and remains idempotent', () => {
  const db = makeDatabase();
  const [draft] = prepareStudyDrafts(JSON.stringify(makeRow()));
  db.prepare(`insert into content_items (id, course_code, type, title, summary, body, status, source_path)
    values ('id-1', ?, 'experience', ?, '资源楼 5L；转载授权未确认，仅供后台审核。', ?, 'draft', ?)`).run(
    draft.courseCode, draft.originalTitle, draft.originalBody, draft.sourcePath,
  );
  assert.equal(reviseStudyDrafts(db, [draft]).drafts[0].action, 'planned');
  assert.equal(reviseStudyDrafts(db, [draft], { apply: true }).revised, 1);
  assert.deepEqual({ ...db.prepare('select title, summary, body, status from content_items').get() }, {
    title: draft.title, summary: draft.summary, body: draft.body, status: 'draft',
  });
  assert.equal(reviseStudyDrafts(db, [draft], { apply: true }).skipped, 1);
  db.prepare('update content_items set body = ?').run('管理员修改过的正文');
  assert.throws(() => reviseStudyDrafts(db, [draft], { apply: true }), /changed/);
  db.close();
});

test('accepts a previously cleaned first heading but preserves unknown body edits', () => {
  const db = makeDatabase();
  const [draft] = prepareStudyDrafts(JSON.stringify(makeRow({
    body: '# BIO2011F 生物化学（甲）\n\n## 课程介绍 by 23级 张同学\n\n正文',
  })));
  db.prepare(`insert into content_items (id, course_code, type, title, summary, body, status, source_path)
    values ('id-2', ?, 'experience', '资源楼', '资源楼 5L', ?, 'draft', ?)`).run(
    draft.courseCode, '## 课程介绍 by 23级 张同学\n\n正文', draft.sourcePath,
  );
  assert.equal(reviseStudyDrafts(db, [draft], { apply: true }).revised, 1);
  assert.equal(db.prepare('select body from content_items').get().body, '正文');
  db.close();
});
