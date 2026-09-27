import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { validateContentInput } from '../server/content/contentService.js';

const sourcePrefix = 'cc98-bio-resource/v3/';

function stripDuplicateHeadings(body, courseCode) {
  const lines = body.split(/\r?\n/);
  let next = 0;
  if (new RegExp(`^#\\s+${courseCode}(?:\\s|（|\\()`).test(lines[next] ?? '')) {
    next += 1;
    while (!lines[next]?.trim()) next += 1;
  }
  if (/^##\s+课程介绍(?:\s|（|$)/.test(lines[next] ?? '')) next += 1;
  if (next === 0) return body;
  while (!lines[next]?.trim()) next += 1;
  return lines.slice(next).join('\n');
}

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
    const summary = `CC98 资源楼 ${sourceFloor}。`;
    const title = String(row.teacher ?? '').trim() ? `资源楼（${String(row.teacher).trim()}）` : '资源楼';
    const body = stripDuplicateHeadings(row.body, row.courseCode);
    const input = {
      courseCode: row.courseCode,
      type: 'experience',
      title,
      summary,
      author: row.author,
      body,
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
      body,
      sourcePath: `${sourcePrefix}${fingerprint}`,
      sourceFloor,
      originalTitle: row.title,
      originalBody: row.body,
    };
  });
}

export function reviseStudyDrafts(db, drafts, { apply = false } = {}) {
  db.exec('PRAGMA busy_timeout = 5000');
  const find = db.prepare('select id, course_code, type, title, summary, body, status from content_items where source_path = ?');
  const update = apply ? db.prepare(`
    update content_items set title = ?, summary = ?, body = ?, updated_at = ? where id = ?
  `) : null;
  const result = { planned: drafts.length, revised: 0, skipped: 0, drafts: [] };
  if (apply) db.exec('BEGIN IMMEDIATE');
  try {
    for (const draft of drafts) {
      const existing = find.get(draft.sourcePath);
      if (!existing || !['draft', 'published'].includes(existing.status) || existing.course_code !== draft.courseCode || existing.type !== 'experience') {
        throw new Error(`Imported draft missing or changed: ${draft.sourcePath}`);
      }
      const updated = existing.title === draft.title && existing.summary === draft.summary && existing.body === draft.body;
      const knownTitle = [draft.originalTitle, draft.title, '资源楼'].includes(existing.title);
      const knownSummary = [
        `资源楼 ${draft.sourceFloor}；转载授权未确认，仅供后台审核。`,
        `资源楼 ${draft.sourceFloor}`,
        draft.summary,
      ].includes(existing.summary);
      if (!updated && (!knownTitle || !knownSummary || stripDuplicateHeadings(existing.body, draft.courseCode) !== draft.body)) {
        throw new Error(`Existing imported post changed: ${draft.sourcePath}`);
      }
      const action = updated ? 'skipped' : apply ? 'revised' : 'planned';
      if (updated) result.skipped += 1;
      else if (apply) {
        update.run(draft.title, draft.summary, draft.body, new Date().toISOString(), existing.id);
        result.revised += 1;
      }
      result.drafts.push({ id: existing.id, courseCode: draft.courseCode, title: draft.title, status: existing.status, action });
    }
    if (apply) db.exec('COMMIT');
  } catch (error) {
    if (apply) db.exec('ROLLBACK');
    throw error;
  }
  return result;
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
    throw new Error('Usage: node scripts/import-cc98-study-drafts.mjs --file BATCH.jsonl --db CONTENT.sqlite [--apply] [--revise-existing]');
  }
  const drafts = prepareStudyDrafts(readFileSync(args[fileIndex + 1], 'utf8'));
  const db = new DatabaseSync(args[dbIndex + 1], { readOnly: !args.includes('--apply') });
  try {
    const run = args.includes('--revise-existing') ? reviseStudyDrafts : importStudyDrafts;
    console.log(JSON.stringify(run(db, drafts, { apply: args.includes('--apply') })));
  } finally {
    db.close();
  }
}
