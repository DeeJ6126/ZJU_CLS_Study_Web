import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { validateContentInput } from '../server/content/contentService.js';
import { loadServerCourseCatalog } from '../server/account/courseCatalogService.js';

const prefix = 'cc98-bio-resource/docx/';
const normalize = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function prepareDocxNotes(manifest, codes = loadServerCourseCatalog().codes) {
  if (manifest.count !== 33 || manifest.notes?.length !== manifest.count || !/^[a-f0-9]{64}$/.test(manifest.sourceSha256 ?? '')) {
    throw new Error('Expected the reviewed DOCX manifest.');
  }
  const included = [], excluded = [], keys = new Set();
  for (const row of manifest.notes) {
    if (!codes.has(row.courseCode)) { excluded.push({ courseCode: row.courseCode, author: row.author }); continue; }
    const floor = Number(String(row.sourceFloor).replace(/L$/, ''));
    const sourceUrl = `https://www.cc98.org/topic/6003753/${Math.floor((floor - 1) / 10) + 1}#${(floor - 1) % 10 + 1}`;
    if (!Number.isInteger(floor) || floor < 3 || row.cc98Url !== sourceUrl || !row.body?.trim() || !row.plainBody?.trim()) {
      throw new Error(`Missing note body or floor provenance: ${row.courseCode}`);
    }
    const validation = validateContentInput({
      ...row, type: 'experience', title: '资源楼', summary: `CC98 资源楼 ${floor}L`,
      author: normalize(row.author), bodyFormat: 'markdown', gpa: '', gradePercentage: '', year: '', externalUrl: '',
    });
    if (!validation.ok) throw new Error(validation.message);
    const sourcePath = prefix + hash([row.courseCode, floor, normalize(row.author)]).slice(0, 24);
    if (keys.has(sourcePath)) throw new Error(`Duplicate source identity: ${row.courseCode}`);
    keys.add(sourcePath);
    included.push({ ...validation.value, sourcePath, sourceFloor: `${floor}L`, sourceSha256: manifest.sourceSha256 });
  }
  if (included.length !== 30 || excluded.length !== 3) throw new Error('Expected 30 body notes and 3 excluded notes.');
  return { sourceDocument: manifest.sourceDocument, sourceSha256: manifest.sourceSha256, included, excluded };
}

function matchingItem(db, note) {
  const bySource = db.prepare('select * from content_items where source_path = ?').get(note.sourcePath);
  const matches = db.prepare("select * from content_items where course_code = ? and type = 'experience'")
    .all(note.courseCode).filter((item) => {
      if (normalize(item.author) !== normalize(note.author)) return false;
      if (item.cc98_url === note.cc98Url) return true;
      // Older imports used the absolute floor after # on paginated CC98 URLs.
      const floor = Number(note.sourceFloor.replace(/L$/, ''));
      return item.source_path?.startsWith('cc98-bio-resource/v3/')
        && item.cc98_url === `https://www.cc98.org/topic/6003753/${Math.floor((floor - 1) / 10) + 1}#${floor}`;
    });
  if (matches.length > 1 || (bySource && matches.some((item) => item.id !== bySource.id))) {
    throw new Error(`Ambiguous existing posts: ${note.courseCode} ${note.author}`);
  }
  const current = bySource ?? matches[0];
  if (current && (current.owner_id != null || !/^cc98-bio-resource\/(v3|docx)\//.test(current.source_path ?? '')
    || !['draft', 'published'].includes(current.status))) {
    throw new Error(`Existing post requires individual review: ${current.id}`);
  }
  return current ?? null;
}

function fieldsFor(note, current) {
  return { ...note, teacher: note.teacher || current?.teacher || '' };
}

function isUpToDate(current, note) {
  return current?.status === 'published' && current.title === note.title && current.summary === note.summary
    && current.author === note.author && current.body === note.body && current.body_format === note.bodyFormat
    && current.teacher === note.teacher && current.cc98_url === note.cc98Url;
}

export function publishDocxNotes(db, notes, { apply = false, actor, expectedPlan } = {}) {
  if (notes.length !== 30 || !Number.isInteger(actor?.id) || !actor?.name) throw new Error('Reviewed batch and administrator actor required.');
  if (new Set(notes.map((note) => note.sourcePath)).size !== notes.length) throw new Error('Duplicate import identities.');
  const codes = loadServerCourseCatalog().codes;
  for (const note of notes) {
    const result = validateContentInput(note);
    if (!result.ok || !note.body || !codes.has(note.courseCode)
      || !note.sourcePath?.startsWith(prefix) || note.type !== 'experience' || note.title !== '资源楼') throw new Error('Invalid publication input.');
  }
  db.exec('PRAGMA busy_timeout = 5000');
  if (apply) db.exec('BEGIN IMMEDIATE');
  try {
    const planned = notes.map((note) => {
      const current = matchingItem(db, note);
      const fields = fieldsFor(note, current);
      return { note: fields, current, sourcePath: note.sourcePath, fingerprint: hash(current), action: isUpToDate(current, fields) ? 'skipped' : current ? 'updated' : 'created' };
    });
    if (expectedPlan && planned.some((item, index) => item.sourcePath !== expectedPlan[index]?.sourcePath || item.fingerprint !== expectedPlan[index]?.fingerprint)) {
      throw new Error('Online posts changed since the reviewed dry run.');
    }
    const report = { planned: notes.length, created: 0, updated: 0, skipped: 0, items: [] };
    const insert = db.prepare(`insert into content_items
      (id, route_id, course_code, type, title, summary, author, body, body_format, cc98_url,
       teacher, status, source_path, created_by, updated_by, created_at, updated_at)
      values (?, ?, ?, 'experience', ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`);
    const update = db.prepare(`update content_items set title = ?, summary = ?, author = ?, body = ?,
      body_format = ?, cc98_url = ?, teacher = ?, status = 'published', updated_by = ?, updated_at = ? where id = ?`);
    const audit = db.prepare(`insert into audit_logs
      (id, action, entity_type, entity_id, target_title, course_code, actor_id, actor_name, detail, created_at)
      values (?, ?, 'content', ?, ?, ?, ?, ?, ?, ?)`);
    for (const entry of planned) {
      const { note, current, action } = entry;
      let id = current?.id ?? '';
      if (action === 'skipped') report.skipped++;
      else if (apply) {
        const now = new Date().toISOString();
        id ||= randomUUID();
        if (current) update.run(note.title, note.summary, note.author, note.body, note.bodyFormat,
          note.cc98Url, note.teacher, actor.id, now, id);
        else insert.run(id, id, note.courseCode, note.title, note.summary, note.author, note.body, note.bodyFormat,
          note.cc98Url, note.teacher, note.sourcePath, actor.id, actor.id, now, now);
        report[action]++;
        const detail = JSON.stringify({ sourceDocument: '生命科学学院资源楼.docx', sourceFloor: note.sourceFloor,
          sourceSha256: note.sourceSha256, userApproved: true, previousStatus: current?.status ?? null });
        for (const step of [current ? 'content.update' : 'content.create', 'content.review', 'content.publish']) {
          audit.run(randomUUID(), step, id, note.title, note.courseCode, actor.id, actor.name, detail, now);
        }
      }
      report.items.push({ sourcePath: entry.sourcePath, fingerprint: entry.fingerprint, id, courseCode: note.courseCode,
        author: note.author, teacher: note.teacher, status: 'published', action, bodyChars: note.body.length, cc98Url: note.cc98Url });
    }
    if (apply) db.exec('COMMIT');
    return report;
  } catch (error) {
    if (apply) db.exec('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  if (!args.includes('--file')) throw new Error('Use --file with the extracted or prepared JSON manifest.');
  const input = JSON.parse(readFileSync(value('--file'), 'utf8').replace(/^\uFEFF/, ''));
  if (args.includes('--prepare')) {
    if (!value('--out')) throw new Error('Use --out for the prepared manifest.');
    const prepared = prepareDocxNotes(input);
    writeFileSync(value('--out'), JSON.stringify(prepared, null, 2) + '\n');
    console.log(JSON.stringify({ included: prepared.included.length, excluded: prepared.excluded }));
  } else {
    if (!args.includes('--db') || !args.includes('--auth-db') || !args.includes('--actor-student-id')) throw new Error('Use --db, --auth-db, --actor-student-id and optionally --apply --plan.');
    const auth = new DatabaseSync(value('--auth-db'), { readOnly: true });
    const admin = auth.prepare(`select u.id, u.nickname from users u join user_identities i on i.user_id = u.id
      where i.provider = 'email' and i.identifier = ? and u.role = 'admin'`).get(`${value('--actor-student-id')}@zju.edu.cn`);
    auth.close();
    if (!admin) throw new Error('Requested verified administrator not found.');
    const db = new DatabaseSync(value('--db'), { readOnly: !args.includes('--apply') });
    try {
      const report = publishDocxNotes(db, input.included, { apply: args.includes('--apply'), actor: { id: admin.id, name: admin.nickname },
        expectedPlan: args.includes('--plan') ? JSON.parse(readFileSync(value('--plan'), 'utf8')).items : undefined });
      if (args.includes('--out')) writeFileSync(value('--out'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify(report));
    } finally { db.close(); }
  }
}
