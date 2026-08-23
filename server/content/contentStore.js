import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function mapItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    routeId: row.routeId || row.id,
    courseCode: row.courseCode,
    type: row.type,
    title: row.title,
    summary: row.summary,
    author: row.author,
    body: row.body,
    externalUrl: row.externalUrl,
    cc98Url: row.cc98Url,
    gpa: row.gpa,
    year: row.year,
    teacher: row.teacher,
    status: row.status,
    sourcePath: row.sourcePath,
    ownerId: row.ownerId,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    file: row.fileUrl ? {
      fileName: row.fileName,
      storedName: row.storedName,
      mimeType: row.mimeType,
      size: row.fileSize,
      url: row.fileUrl,
    } : null,
  };
}

function mapComment(row) {
  if (!row) return null;
  return {
    id: row.id,
    contentId: row.contentId,
    authorId: row.authorId,
    parentCommentId: row.parentCommentId,
    body: row.deletedAt ? '该评论已删除' : row.body,
    deleted: Boolean(row.deletedAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    summary: row.summary,
    body: row.body,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    status: row.status,
    featured: Boolean(row.featured),
    displayOrder: row.displayOrder,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const selectColumns = `
  id,
  route_id as routeId,
  course_code as courseCode,
  type,
  title,
  summary,
  author,
  body,
  external_url as externalUrl,
  cc98_url as cc98Url,
  gpa,
  academic_year as year,
  teacher,
  status,
  source_path as sourcePath,
  owner_id as ownerId,
  created_by as createdBy,
  updated_by as updatedBy,
  created_at as createdAt,
  updated_at as updatedAt,
  file_name as fileName,
  stored_name as storedName,
  mime_type as mimeType,
  file_size as fileSize,
  file_url as fileUrl
`;

const activitySelectColumns = `
  id,
  slug,
  title,
  category,
  summary,
  body,
  image_url as imageUrl,
  image_alt as imageAlt,
  status,
  featured,
  display_order as displayOrder,
  created_by as createdBy,
  updated_by as updatedBy,
  created_at as createdAt,
  updated_at as updatedAt
`;

export function createContentStore({ filename = 'server/data/content.sqlite' } = {}) {
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true });
  }
  const db = new DatabaseSync(filename);

  return {
    initialize() {
      db.exec(`
        create table if not exists content_items (
          id text primary key,
          route_id text not null default '',
          course_code text not null,
          type text not null check(type in ('experience', 'material', 'paper')),
          title text not null,
          summary text not null default '',
          author text not null default '',
          body text not null default '',
          external_url text not null default '',
          cc98_url text not null default '',
          gpa text not null default '',
          academic_year text not null default '',
          teacher text not null default '',
          status text not null default 'draft' check(status in ('draft', 'published', 'archived')),
          source_path text unique,
          owner_id integer,
          created_by integer,
          updated_by integer,
          created_at text not null,
          updated_at text not null,
          file_name text not null default '',
          stored_name text not null default '',
          mime_type text not null default '',
          file_size integer not null default 0,
          file_url text not null default ''
        );
        create index if not exists content_course_status_idx
          on content_items(course_code, status, type, created_at);
        create table if not exists content_submissions (
          id text primary key,
          course_code text not null,
          type text not null check(type in ('experience', 'material', 'paper')),
          title text not null,
          summary text not null default '',
          author text not null default '',
          body text not null default '',
          external_url text not null default '',
          cc98_url text not null default '',
          gpa text not null default '',
          academic_year text not null default '',
          teacher text not null default '',
          image_name text not null default '',
          status text not null default 'pending' check(status in ('pending', 'approved', 'rejected')),
          submitter_id integer not null,
          submitter_name text not null,
          reviewed_by integer,
          reviewer_name text not null default '',
          review_note text not null default '',
          approved_content_id text not null default '',
          submission_kind text not null default 'create',
          target_content_id text not null default '',
          base_target_updated_at text not null default '',
          created_at text not null,
          updated_at text not null,
          reviewed_at text not null default '',
          withdrawn_at text not null default '',
          file_name text not null default '',
          stored_name text not null default '',
          mime_type text not null default '',
          file_size integer not null default 0
        );
        create index if not exists submission_status_idx
          on content_submissions(status, created_at);
        create table if not exists content_likes (
          content_id text not null,
          visitor_id text not null,
          created_at text not null,
          primary key (content_id, visitor_id),
          foreign key (content_id) references content_items(id) on delete cascade
        );
        create table if not exists audit_logs (
          id text primary key,
          action text not null,
          entity_type text not null,
          entity_id text not null,
          target_title text not null default '',
          course_code text not null default '',
          actor_id integer,
          actor_name text not null default '',
          detail text not null default '',
          created_at text not null
        );
        create index if not exists audit_created_idx on audit_logs(created_at desc);
        create table if not exists content_comments (
          id text primary key,
          content_id text not null,
          author_id integer not null,
          parent_comment_id text not null default '',
          body text not null,
          created_at text not null,
          updated_at text not null,
          deleted_at text not null default ''
        );
        create index if not exists comment_content_idx on content_comments(content_id, created_at);
        create index if not exists comment_author_idx on content_comments(author_id, updated_at desc);
        create table if not exists activity_items (
          id text primary key,
          slug text not null unique,
          title text not null,
          category text not null check(category in ('frontier', 'learning', 'community', 'exchange')),
          summary text not null default '',
          body text not null default '',
          image_url text not null default '',
          image_alt text not null default '',
          status text not null default 'draft' check(status in ('draft', 'published', 'archived')),
          featured integer not null default 0,
          display_order integer not null default 100,
          created_by integer,
          updated_by integer,
          created_at text not null,
          updated_at text not null
        );
        create index if not exists activity_public_idx
          on activity_items(status, featured, display_order, updated_at desc);
      `);
      const columns = db.prepare('pragma table_info(content_items)').all();
      if (!columns.some((column) => column.name === 'route_id')) {
        db.exec("alter table content_items add column route_id text not null default ''");
      }
      if (!columns.some((column) => column.name === 'cc98_url')) {
        db.exec("alter table content_items add column cc98_url text not null default ''");
      }
      if (!columns.some((column) => column.name === 'gpa')) {
        db.exec("alter table content_items add column gpa text not null default ''");
      }
      if (!columns.some((column) => column.name === 'owner_id')) {
        db.exec('alter table content_items add column owner_id integer');
      }
      const submissionColumns = db.prepare('pragma table_info(content_submissions)').all();
      if (!submissionColumns.some((column) => column.name === 'submission_kind')) {
        db.exec("alter table content_submissions add column submission_kind text not null default 'create'");
      }
      if (!submissionColumns.some((column) => column.name === 'target_content_id')) {
        db.exec("alter table content_submissions add column target_content_id text not null default ''");
      }
      if (!submissionColumns.some((column) => column.name === 'base_target_updated_at')) {
        db.exec("alter table content_submissions add column base_target_updated_at text not null default ''");
      }
      if (!submissionColumns.some((column) => column.name === 'withdrawn_at')) {
        db.exec("alter table content_submissions add column withdrawn_at text not null default ''");
      }
      db.exec(`
        update content_items
        set owner_id = (
          select submitter_id from content_submissions
          where approved_content_id = content_items.id and status = 'approved'
          limit 1
        )
        where owner_id is null and exists (
          select 1 from content_submissions
          where approved_content_id = content_items.id and status = 'approved'
        )
      `);
    },

    createItem(input) {
      const id = input.id ?? randomUUID();
      const now = input.createdAt ?? new Date().toISOString();
      db.prepare(`
        insert into content_items (
          id, route_id, course_code, type, title, summary, author, body, external_url, cc98_url, gpa,
          academic_year, teacher, status, source_path, owner_id, created_by, updated_by,
          created_at, updated_at, file_name, stored_name, mime_type, file_size, file_url
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.routeId ?? id, input.courseCode, input.type, input.title, input.summary ?? '', input.author ?? '',
        input.body ?? '', input.externalUrl ?? '', input.cc98Url ?? '', input.gpa ?? '', input.year ?? '', input.teacher ?? '',
        input.status ?? 'draft', input.sourcePath ?? null, input.ownerId ?? null, input.createdBy ?? null,
        input.updatedBy ?? input.createdBy ?? null, now, input.updatedAt ?? now,
        input.file?.fileName ?? '', input.file?.storedName ?? '', input.file?.mimeType ?? '',
        input.file?.size ?? 0, input.file?.url ?? '',
      );
      return this.findById(id);
    },

    findById(id) {
      return mapItem(db.prepare(`select ${selectColumns} from content_items where id = ?`).get(id));
    },

    findBySourcePath(sourcePath) {
      return mapItem(db.prepare(`select ${selectColumns} from content_items where source_path = ?`).get(sourcePath));
    },

    updateItem(id, changes) {
      const current = this.findById(id);
      if (!current) {
        return null;
      }
      const next = { ...current, ...changes, updatedAt: new Date().toISOString() };
      db.prepare(`
        update content_items set
          title = ?, summary = ?, author = ?, body = ?, external_url = ?, cc98_url = ?, gpa = ?,
          academic_year = ?, teacher = ?, updated_by = ?, updated_at = ?
        where id = ?
      `).run(
        next.title, next.summary, next.author, next.body, next.externalUrl, next.cc98Url, next.gpa,
        next.year, next.teacher, next.updatedBy ?? null, next.updatedAt, id,
      );
      return this.findById(id);
    },

    setStatus(id, status, updatedBy) {
      db.prepare('update content_items set status = ?, updated_by = ?, updated_at = ? where id = ?')
        .run(status, updatedBy ?? null, new Date().toISOString(), id);
      return this.findById(id);
    },

    attachFile(id, file, updatedBy) {
      db.prepare(`
        update content_items set file_name = ?, stored_name = ?, mime_type = ?,
          file_size = ?, file_url = ?, updated_by = ?, updated_at = ? where id = ?
      `).run(
        file.fileName, file.storedName ?? '', file.mimeType, file.size, file.url,
        updatedBy ?? null, new Date().toISOString(), id,
      );
      return this.findById(id);
    },

    removeFile(id, updatedBy) {
      db.prepare(`
        update content_items set file_name = '', stored_name = '', mime_type = '',
          file_size = 0, file_url = '', updated_by = ?, updated_at = ? where id = ?
      `).run(updatedBy ?? null, new Date().toISOString(), id);
      return this.findById(id);
    },

    listPublishedByCourse(courseCode) {
      return db.prepare(`
        select ${selectColumns} from content_items
        where course_code = ? and status = 'published'
        order by type, created_at, id
      `).all(courseCode).map(mapItem);
    },

    listPublishedByOwner(ownerId) {
      return db.prepare(`
        select ${selectColumns} from content_items
        where owner_id = ? and status = 'published'
        order by created_at desc, id
      `).all(ownerId).map(mapItem);
    },

    listByOwner(ownerId) {
      return db.prepare(`
        select ${selectColumns} from content_items
        where owner_id = ? order by updated_at desc, id
      `).all(ownerId).map(mapItem);
    },

    listAdmin({ courseCode = '', type = '', status = '' } = {}) {
      const clauses = [];
      const values = [];
      if (courseCode) {
        clauses.push('course_code = ?');
        values.push(courseCode);
      }
      if (type) {
        clauses.push('type = ?');
        values.push(type);
      }
      if (status) {
        clauses.push('status = ?');
        values.push(status);
      }
      const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
      return db.prepare(`
        select ${selectColumns} from content_items ${where}
        order by updated_at desc, id
      `).all(...values).map(mapItem);
    },

    createActivity(input) {
      const id = input.id ?? randomUUID();
      const now = input.createdAt ?? new Date().toISOString();
      db.prepare(`
        insert into activity_items (
          id, slug, title, category, summary, body, image_url, image_alt, status,
          featured, display_order, created_by, updated_by, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.slug, input.title, input.category, input.summary ?? '', input.body ?? '',
        input.imageUrl ?? '', input.imageAlt ?? '', input.status ?? 'draft', input.featured ? 1 : 0,
        input.displayOrder ?? 100, input.createdBy ?? null, input.updatedBy ?? input.createdBy ?? null,
        now, input.updatedAt ?? now,
      );
      return this.findActivityById(id);
    },

    findActivityById(id) {
      return mapActivity(db.prepare(`select ${activitySelectColumns} from activity_items where id = ?`).get(id));
    },

    findActivityBySlug(slug) {
      return mapActivity(db.prepare(`select ${activitySelectColumns} from activity_items where slug = ?`).get(slug));
    },

    updateActivity(id, changes) {
      const current = this.findActivityById(id);
      if (!current) return null;
      const next = { ...current, ...changes, updatedAt: new Date().toISOString() };
      db.prepare(`
        update activity_items set slug = ?, title = ?, category = ?, summary = ?, body = ?,
          image_url = ?, image_alt = ?, featured = ?, display_order = ?, updated_by = ?, updated_at = ?
        where id = ?
      `).run(
        next.slug, next.title, next.category, next.summary, next.body, next.imageUrl, next.imageAlt,
        next.featured ? 1 : 0, next.displayOrder, next.updatedBy ?? null, next.updatedAt, id,
      );
      return this.findActivityById(id);
    },

    setActivityStatus(id, status, updatedBy) {
      db.prepare('update activity_items set status = ?, updated_by = ?, updated_at = ? where id = ?')
        .run(status, updatedBy ?? null, new Date().toISOString(), id);
      return this.findActivityById(id);
    },

    listPublishedActivities({ featuredOnly = false } = {}) {
      const featuredClause = featuredOnly ? 'and featured = 1' : '';
      return db.prepare(`
        select ${activitySelectColumns} from activity_items
        where status = 'published' ${featuredClause}
        order by display_order, updated_at desc, id
      `).all().map(mapActivity);
    },

    listAdminActivities({ status = '', category = '', query = '' } = {}) {
      const clauses = [];
      const values = [];
      if (status) { clauses.push('status = ?'); values.push(status); }
      if (category) { clauses.push('category = ?'); values.push(category); }
      if (query) {
        clauses.push('(lower(title) like ? or lower(summary) like ?)');
        const pattern = `%${query.toLowerCase()}%`;
        values.push(pattern, pattern);
      }
      const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
      return db.prepare(`
        select ${activitySelectColumns} from activity_items ${where}
        order by display_order, updated_at desc, id
      `).all(...values).map(mapActivity);
    },

    createSubmission(input) {
      const id = input.id ?? randomUUID();
      const now = input.createdAt ?? new Date().toISOString();
      db.prepare(`
        insert into content_submissions (
          id, course_code, type, title, summary, author, body, external_url, cc98_url, gpa,
          academic_year, teacher, image_name, status, submitter_id, submitter_name,
          submission_kind, target_content_id, base_target_updated_at, created_at, updated_at,
          file_name, stored_name, mime_type, file_size
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.courseCode, input.type, input.title, input.summary ?? '', input.author ?? '',
        input.body ?? '', input.externalUrl ?? '', input.cc98Url ?? '', input.gpa ?? '', input.year ?? '',
        input.teacher ?? '', input.imageName ?? '', input.submitterId, input.submitterName ?? '',
        input.submissionKind ?? 'create', input.targetContentId ?? '', input.baseTargetUpdatedAt ?? '', now, now,
        input.file?.fileName ?? '', input.file?.storedName ?? '', input.file?.mimeType ?? '', input.file?.size ?? 0,
      );
      return this.findSubmissionById(id);
    },

    findSubmissionById(id) {
      const row = db.prepare(`
        select id, course_code as courseCode, type, title, summary, author, body,
          external_url as externalUrl, cc98_url as cc98Url, gpa, academic_year as year,
          teacher, image_name as imageName, status, submitter_id as submitterId,
          submitter_name as submitterName, reviewed_by as reviewedBy,
          reviewer_name as reviewerName, review_note as reviewNote,
          approved_content_id as approvedContentId, submission_kind as submissionKind,
          target_content_id as targetContentId, base_target_updated_at as baseTargetUpdatedAt,
          created_at as createdAt,
          updated_at as updatedAt, reviewed_at as reviewedAt, withdrawn_at as withdrawnAt,
          file_name as fileName,
          stored_name as storedName, mime_type as mimeType, file_size as fileSize
        from content_submissions where id = ?
      `).get(id);
      if (!row) return null;
      return {
        ...row,
        status: row.withdrawnAt && row.status === 'pending' ? 'withdrawn' : row.status,
        file: row.storedName ? {
          fileName: row.fileName, storedName: row.storedName, mimeType: row.mimeType, size: row.fileSize,
        } : null,
      };
    },

    updateSubmission(id, changes) {
      const current = this.findSubmissionById(id);
      if (!current) return null;
      const next = { ...current, ...changes };
      db.prepare(`
        update content_submissions set title = ?, summary = ?, author = ?, body = ?, external_url = ?,
          cc98_url = ?, gpa = ?, academic_year = ?, teacher = ?, image_name = ?, updated_at = ?
        where id = ?
      `).run(
        next.title, next.summary, next.author, next.body, next.externalUrl, next.cc98Url, next.gpa,
        next.year, next.teacher, next.imageName, new Date().toISOString(), id,
      );
      return this.findSubmissionById(id);
    },

    setSubmissionStatus(id, status, actor, { note = '', approvedContentId = '' } = {}) {
      const now = new Date().toISOString();
      if (status === 'withdrawn') {
        db.prepare('update content_submissions set withdrawn_at = ?, updated_at = ? where id = ?')
          .run(now, now, id);
        return this.findSubmissionById(id);
      }
      db.prepare(`
        update content_submissions set status = ?, reviewed_by = ?, reviewer_name = ?, review_note = ?,
          approved_content_id = ?, reviewed_at = ?, updated_at = ? where id = ?
      `).run(status, actor?.id ?? null, actor?.cc98Nickname ?? '', note, approvedContentId, now, now, id);
      return this.findSubmissionById(id);
    },

    attachSubmissionFile(id, file) {
      db.prepare(`
        update content_submissions set file_name = ?, stored_name = ?, mime_type = ?, file_size = ?, updated_at = ?
        where id = ?
      `).run(file.fileName, file.storedName, file.mimeType, file.size, new Date().toISOString(), id);
      return this.findSubmissionById(id);
    },

    listSubmissions({ courseCode = '', type = '', status = '', query = '' } = {}) {
      const clauses = [];
      const values = [];
      if (courseCode) { clauses.push('course_code = ?'); values.push(courseCode); }
      if (type) { clauses.push('type = ?'); values.push(type); }
      if (status) {
        clauses.push('status = ?'); values.push(status);
        if (status === 'pending') clauses.push("withdrawn_at = ''");
      }
      if (query) {
        clauses.push('(title like ? or summary like ? or author like ? or submitter_name like ?)');
        const pattern = `%${query}%`;
        values.push(pattern, pattern, pattern, pattern);
      }
      const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
      const ids = db.prepare(`select id from content_submissions ${where} order by created_at desc`).all(...values);
      return ids.map(({ id }) => this.findSubmissionById(id));
    },

    listSubmissionsBySubmitter(submitterId) {
      return db.prepare(`
        select id from content_submissions where submitter_id = ? order by updated_at desc
      `).all(submitterId).map(({ id }) => this.findSubmissionById(id));
    },

    deleteSubmission(id) {
      const current = this.findSubmissionById(id);
      if (!current) return null;
      db.prepare('delete from content_submissions where id = ?').run(id);
      return current;
    },

    toggleLike(contentId, visitorId) {
      const existing = db.prepare('select 1 from content_likes where content_id = ? and visitor_id = ?').get(contentId, visitorId);
      if (existing) {
        db.prepare('delete from content_likes where content_id = ? and visitor_id = ?').run(contentId, visitorId);
      } else {
        db.prepare('insert into content_likes (content_id, visitor_id, created_at) values (?, ?, ?)')
          .run(contentId, visitorId, new Date().toISOString());
      }
      return this.getLikeState(contentId, visitorId);
    },

    getLikeState(contentId, visitorId = '') {
      const likeCount = db.prepare('select count(*) as count from content_likes where content_id = ?').get(contentId)?.count ?? 0;
      const liked = visitorId
        ? Boolean(db.prepare('select 1 from content_likes where content_id = ? and visitor_id = ?').get(contentId, visitorId))
        : false;
      return { liked, likeCount };
    },

    createComment(input) {
      const id = input.id ?? randomUUID();
      const now = input.createdAt ?? new Date().toISOString();
      db.prepare(`
        insert into content_comments (
          id, content_id, author_id, parent_comment_id, body, created_at, updated_at, deleted_at
        ) values (?, ?, ?, ?, ?, ?, ?, '')
      `).run(id, input.contentId, input.authorId, input.parentCommentId ?? '', input.body, now, now);
      return this.findCommentById(id);
    },

    findCommentById(id) {
      return mapComment(db.prepare(`
        select id, content_id as contentId, author_id as authorId,
          parent_comment_id as parentCommentId, body, created_at as createdAt,
          updated_at as updatedAt, deleted_at as deletedAt
        from content_comments where id = ?
      `).get(id));
    },

    listComments(contentId) {
      return db.prepare(`
        select id, content_id as contentId, author_id as authorId,
          parent_comment_id as parentCommentId, body, created_at as createdAt,
          updated_at as updatedAt, deleted_at as deletedAt
        from content_comments where content_id = ? order by created_at, id
      `).all(contentId).map(mapComment);
    },

    listCommentsByAuthor(authorId) {
      return db.prepare(`
        select id, content_id as contentId, author_id as authorId,
          parent_comment_id as parentCommentId, body, created_at as createdAt,
          updated_at as updatedAt, deleted_at as deletedAt
        from content_comments where author_id = ? order by updated_at desc, id
      `).all(authorId).map(mapComment);
    },

    updateComment(id, body) {
      db.prepare("update content_comments set body = ?, updated_at = ? where id = ? and deleted_at = ''")
        .run(body, new Date().toISOString(), id);
      return this.findCommentById(id);
    },

    softDeleteComment(id) {
      const now = new Date().toISOString();
      db.prepare("update content_comments set deleted_at = ?, updated_at = ? where id = ? and deleted_at = ''")
        .run(now, now, id);
      return this.findCommentById(id);
    },

    hasRecentDuplicateComment(authorId, contentId, body, seconds = 30) {
      const since = new Date(Date.now() - seconds * 1000).toISOString();
      return Boolean(db.prepare(`
        select 1 from content_comments where author_id = ? and content_id = ? and body = ?
          and created_at >= ? and deleted_at = '' limit 1
      `).get(authorId, contentId, body, since));
    },

    countRecentComments(authorId, seconds = 60) {
      const since = new Date(Date.now() - seconds * 1000).toISOString();
      return db.prepare(`
        select count(*) as count from content_comments
        where author_id = ? and created_at >= ? and deleted_at = ''
      `).get(authorId, since)?.count ?? 0;
    },

    createAuditLog(input) {
      const id = randomUUID();
      db.prepare(`
        insert into audit_logs (id, action, entity_type, entity_id, target_title, course_code,
          actor_id, actor_name, detail, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, input.action, input.entityType, input.entityId, input.targetTitle ?? '', input.courseCode ?? '',
        input.actorId ?? null, input.actorName ?? '', input.detail ?? '', input.createdAt ?? new Date().toISOString(),
      );
      return id;
    },

    listAuditLogs({ action = '', courseCode = '', query = '', limit = 200 } = {}) {
      const clauses = [];
      const values = [];
      if (action) { clauses.push('action = ?'); values.push(action); }
      if (courseCode) { clauses.push('course_code = ?'); values.push(courseCode); }
      if (query) {
        clauses.push('(target_title like ? or actor_name like ? or detail like ?)');
        const pattern = `%${query}%`;
        values.push(pattern, pattern, pattern);
      }
      const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
      return db.prepare(`
        select id, action, entity_type as entityType, entity_id as entityId,
          target_title as targetTitle, course_code as courseCode, actor_id as actorId,
          actor_name as actorName, detail, created_at as createdAt
        from audit_logs ${where} order by created_at desc limit ?
      `).all(...values, Math.max(1, Math.min(Number(limit) || 200, 500)));
    },

    close() {
      db.close();
    },
  };
}
