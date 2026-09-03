import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function mapHomepage(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    href: row.href,
    sortOrder: row.sortOrder,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    href: row.href,
    applicantId: row.applicantId,
    applicantNickname: row.applicantNickname,
    note: row.note,
    status: row.status,
    createdAt: row.createdAt,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
  };
}

export function createStudentHomepageStore({ filename = 'server/data/student-homepages.sqlite' } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);

  return {
    initialize() {
      db.exec(`
        create table if not exists student_homepages (
          id text primary key,
          name text not null,
          href text not null,
          sort_order integer not null default 0,
          created_by integer,
          updated_by integer,
          created_at text not null,
          updated_at text not null
        );
        create index if not exists student_homepages_order_idx
          on student_homepages(sort_order, created_at);
        create table if not exists student_homepage_applications (
          id text primary key,
          name text not null,
          href text not null,
          applicant_id integer,
          applicant_nickname text not null default '',
          note text not null default '',
          status text not null default 'pending',
          created_at text not null,
          decided_by integer,
          decided_at text,
          decision_note text not null default ''
        );
        create index if not exists student_homepage_applications_status_idx
          on student_homepage_applications(status, created_at desc);
      `);
    },

    seedHomepages(entries) {
      const insert = db.prepare(`
        insert into student_homepages (id, name, href, sort_order, created_by, updated_by, created_at, updated_at)
        values (?, ?, ?, ?, null, null, ?, ?)
        on conflict(id) do nothing
      `);
      const now = new Date().toISOString();
      for (const entry of entries) {
        insert.run(
          entry.id ?? randomUUID(),
          entry.name,
          entry.href,
          Number(entry.sortOrder ?? 0),
          now,
          now,
        );
      }
    },

    listHomepages() {
      return db.prepare(`
        select id, name, href, sort_order as sortOrder, created_by as createdBy,
          updated_by as updatedBy, created_at as createdAt, updated_at as updatedAt
        from student_homepages
        order by sort_order asc, created_at asc
      `).all().map(mapHomepage);
    },

    findHomepageById(id) {
      return mapHomepage(db.prepare(`
        select id, name, href, sort_order as sortOrder, created_by as createdBy,
          updated_by as updatedBy, created_at as createdAt, updated_at as updatedAt
        from student_homepages where id = ?
      `).get(id));
    },

    createHomepage({ name, href, sortOrder = 0 }) {
      const now = new Date().toISOString();
      const id = randomUUID();
      db.prepare(`
        insert into student_homepages (id, name, href, sort_order, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?)
      `).run(id, name, href, Number(sortOrder) || 0, now, now);
      return this.findHomepageById(id);
    },

    updateHomepage(id, { name, href, sortOrder }) {
      const existing = this.findHomepageById(id);
      if (!existing) return null;
      const next = {
        name: name ?? existing.name,
        href: href ?? existing.href,
        sortOrder: sortOrder == null ? existing.sortOrder : Number(sortOrder) || 0,
      };
      db.prepare(`
        update student_homepages
        set name = ?, href = ?, sort_order = ?, updated_at = ?
        where id = ?
      `).run(next.name, next.href, next.sortOrder, new Date().toISOString(), id);
      return this.findHomepageById(id);
    },

    deleteHomepage(id) {
      const existing = this.findHomepageById(id);
      if (!existing) return null;
      db.prepare('delete from student_homepages where id = ?').run(id);
      return existing;
    },

    createApplication({ name, href, applicantId = null, applicantNickname = '', note = '' }) {
      const now = new Date().toISOString();
      const id = randomUUID();
      db.prepare(`
        insert into student_homepage_applications (
          id, name, href, applicant_id, applicant_nickname, note,
          status, created_at
        ) values (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        id, name, href,
        applicantId == null ? null : Number(applicantId),
        applicantNickname, note,
        now,
      );
      return this.findApplicationById(id);
    },

    findApplicationById(id) {
      return mapApplication(db.prepare(`
        select id, name, href, applicant_id as applicantId,
          applicant_nickname as applicantNickname, note, status,
          created_at as createdAt, decided_by as decidedBy,
          decided_at as decidedAt, decision_note as decisionNote
        from student_homepage_applications where id = ?
      `).get(id));
    },

    listApplications({ status = '' } = {}) {
      const filter = status ? 'where status = ?' : '';
      const params = status ? [status] : [];
      return db.prepare(`
        select id, name, href, applicant_id as applicantId,
          applicant_nickname as applicantNickname, note, status,
          created_at as createdAt, decided_by as decidedBy,
          decided_at as decidedAt, decision_note as decisionNote
        from student_homepage_applications
        ${filter}
        order by created_at desc
      `).all(...params).map(mapApplication);
    },

    countPendingApplications() {
      return db.prepare(`select count(*) as count from student_homepage_applications where status = 'pending'`)
        .get()?.count ?? 0;
    },

    decideApplication(id, { status, decidedBy, decisionNote = '' }) {
      const existing = this.findApplicationById(id);
      if (!existing) return null;
      db.prepare(`
        update student_homepage_applications
        set status = ?, decided_by = ?, decided_at = ?, decision_note = ?
        where id = ?
      `).run(status, decidedBy == null ? null : Number(decidedBy), new Date().toISOString(), decisionNote, id);
      return this.findApplicationById(id);
    },

    deleteApplication(id) {
      const existing = this.findApplicationById(id);
      if (!existing) return null;
      db.prepare('delete from student_homepage_applications where id = ?').run(id);
      return existing;
    },
  };
}
