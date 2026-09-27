import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { validateContentInput } from '../server/content/contentService.js';

const sourcePrefix = 'cc98-bio-resource/v3/';

export function prepareStudyDrafts(jsonl) {
  const lines = jsonl.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 1 || lines.length > 10) {
    throw new Error('Expected one reviewed batch of 1-10 study notes.');
  }

  return lines.map((line, index) => {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      throw new Error(`Line ${index + 1} is not valid JSON.`);
    }
    if (row.publishReady !== false || row.permissionStatus !== '未确认'
      || row.boundaryStatus !== '已确认' || row.textStatus !== 'complete'
      || row.bodyFormat !== 'markdown' || !String(row.body ?? '').trim()) {
      throw new Error(`Line ${index + 1} is not a complete, unpublished reviewed note.`);
    }
    if (!/^BIO[A-Z0-9-]*$/.test(row.courseCode) && row.courseCode !== 'CAB2001F') {
      throw new Error(`Line ${index + 1} is outside the site course catalog.`);
    }
    const sourceFloor = String(row.sourceFloor ?? '').trim();
    if (!/^\d+L$/.test(sourceFloor) || !String(row.cc98Url ?? '').startsWith('https://www.cc98.org/topic/6003753/')) {
      throw new Error(`Line ${index + 1} has no resource-floor provenance.`);
    }
    const summary = `资源楼 ${sourceFloor}；转载授权未确认，仅供后台审核。`;
    const input = {
      courseCode: row.courseCode,
      type: 'experience',
      title: row.title,
      summary,
      author: row.author,
      body: row.body,
      bodyFormat: 'markdown',
      cc98Url: row.cc98Url,
      gradePercentage: row.gradePercentage,
      teacher: row.teacher,
    };
    const validation = validateContentInput(input);
    if (!validation.ok || !validation.value.author) {
      throw new Error(`Line ${index + 1} failed content validation: ${validation.message ?? 'missing author'}`);
    }
    const fingerprint = createHash('sha256').update(JSON.stringify([
      row.courseCode, row.title, row.author, row.cc98Url,
    ])).digest('hex').slice(0, 24);
    return {
      ...validation.value,
      body: row.body,
      sourcePath: `${sourcePrefix}${fingerprint}`,
      sourceFloor,
    };
  });
}

export function importStudyDrafts(db, drafts, { apply = false } = {}) {
  db.exec('PRAGMA busy_timeout = 5000');
  const existingBySource = db.prepare('select id, status, body from content_items where source_path = ?');
  const existingByContent = db.prepare(`
    select id from content_items
    where course_code = ? and type = 'experience' and title = ? and author = ? and cc98_url = ?
    limit 1
  `);
  const result = { planned: drafts.length, created: 0, skipped: 0, drafts: [] };
  const insert = apply ? db.prepare(`
    insert into content_items (
      id, route_id, course_code, type, title, summary, author, body, body_format,
      cc98_url, grade_percentage, teacher, status, source_path, created_at, updated_at
    ) values (?, ?, ?, 'experience', ?, ?, ?, ?, 'markdown', ?, ?, ?, 'draft', ?, ?, ?)
  `) : null;
  const audit = apply ? db.prepare(`
    insert into audit_logs (
      id, action, entity_type, entity_id, target_title, course_code,
      actor_name, detail, created_at
    ) values (?, 'content.create', 'content', ?, ?, ?, 'CC98 批量导入', ?, ?)
  `) : null;

  if (apply) db.exec('BEGIN IMMEDIATE');
  try {
    for (const draft of drafts) {
      const existing = existingBySource.get(draft.sourcePath);
      if (existing) {
        if (existing.status !== 'draft' || existing.body !== draft.body) {
          throw new Error(`Existing imported post changed: ${draft.sourcePath}`);
        }
        result.skipped += 1;
        result.drafts.push({ id: existing.id, courseCode: draft.courseCode, title: draft.title, status: 'draft', action: 'skipped' });
        continue;
      }
      if (existingByContent.get(draft.courseCode, draft.title, draft.author, draft.cc98Url)) {
        throw new Error(`Possible duplicate post: ${draft.courseCode} ${draft.title}`);
      }
      if (!apply) {
        result.drafts.push({ courseCode: draft.courseCode, title: draft.title, status: 'draft', action: 'planned' });
        continue;
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      insert.run(id, id, draft.courseCode, draft.title, draft.summary, draft.author,
        draft.body, draft.cc98Url, draft.gradePercentage, draft.teacher,
        draft.sourcePath, now, now);
      audit.run(randomUUID(), id, draft.title, draft.courseCode,
        `资源楼 ${draft.sourceFloor}；转载授权未确认；仅建立未发布草稿。`, now);
      result.created += 1;
      result.drafts.push({ id, courseCode: draft.courseCode, title: draft.title, status: 'draft', action: 'created' });
    }
    if (apply) db.exec('COMMIT');
  } catch (error) {
    if (apply) db.exec('ROLLBACK');
    throw error;
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const dbIndex = args.indexOf('--db');
  if (fileIndex < 0 || dbIndex < 0 || !args[fileIndex + 1] || !args[dbIndex + 1]) {
    throw new Error('Usage: node scripts/import-cc98-study-drafts.mjs --file BATCH.jsonl --db CONTENT.sqlite [--apply]');
  }
  const drafts = prepareStudyDrafts(readFileSync(args[fileIndex + 1], 'utf8'));
  const db = new DatabaseSync(args[dbIndex + 1], { readOnly: !args.includes('--apply') });
  try {
    console.log(JSON.stringify(importStudyDrafts(db, drafts, { apply: args.includes('--apply') })));
  } finally {
    db.close();
  }
}
