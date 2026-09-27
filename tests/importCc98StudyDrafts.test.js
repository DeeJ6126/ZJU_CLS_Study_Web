import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { importStudyDrafts, prepareStudyDrafts } from '../scripts/import-cc98-study-drafts.mjs';

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
