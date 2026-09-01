import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function normalizeIdentity(provider, value) {
  const clean = String(value ?? '').trim();
  return provider === 'email' ? clean.toLowerCase() : clean.toLowerCase();
}

function normalizeNickname(value) {
  return String(value ?? '').trim().toLocaleLowerCase('zh-CN');
}

export function createAuthStore({ filename = 'server/data/auth.sqlite' } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);

  function mapUser(row) {
    if (!row) return null;
    const identities = db.prepare(`
      select provider, identifier, display_value as displayValue, verified_at as verifiedAt
      from user_identities where user_id = ?
    `).all(row.id);
    const cc98 = identities.find((identity) => identity.provider === 'cc98');
    const email = identities.find((identity) => identity.provider === 'email');
    return {
      id: row.id,
      passwordHash: row.passwordHash,
      role: row.role,
      nickname: row.nickname || cc98?.displayValue || email?.displayValue?.split('@')[0] || '学生',
      publicId: row.publicId,
      avatarStoredName: row.avatarStoredName ?? '',
      avatarMimeType: row.avatarMimeType ?? '',
      grade: row.grade ?? null,
      cc98Name: cc98?.displayValue ?? '',
      email: email?.displayValue ?? '',
      identities,
    };
  }

  return {
    initialize() {
      db.exec(`
        create table if not exists users (
          id integer primary key autoincrement,
          cc98_name text unique not null,
          password_hash text not null,
          created_at text not null
        );
        create table if not exists verification_codes (
          code text primary key,
          cc98_name text,
          used_by_user_id integer,
          used_at text
        );
        create table if not exists sessions (
          id text primary key,
          user_id integer,
          created_at text not null
        );
      `);
      const userColumns = db.prepare('pragma table_info(users)').all();
      if (!userColumns.some((column) => column.name === 'role')) {
        db.exec("alter table users add column role text not null default 'student'");
      }
      if (!userColumns.some((column) => column.name === 'nickname')) {
        db.exec("alter table users add column nickname text not null default ''");
      }
      if (!userColumns.some((column) => column.name === 'public_id')) {
        db.exec("alter table users add column public_id text not null default ''");
      }
      if (!userColumns.some((column) => column.name === 'nickname_normalized')) {
        db.exec("alter table users add column nickname_normalized text not null default ''");
      }
      if (!userColumns.some((column) => column.name === 'avatar_stored_name')) {
        db.exec("alter table users add column avatar_stored_name text not null default ''");
      }
      if (!userColumns.some((column) => column.name === 'avatar_mime_type')) {
        db.exec("alter table users add column avatar_mime_type text not null default ''");
      }
      if (!userColumns.some((column) => column.name === 'grade')) {
        db.exec('alter table users add column grade integer');
      }
      const sessionColumns = db.prepare('pragma table_info(sessions)').all();
      if (!sessionColumns.some((column) => column.name === 'expires_at')) {
        db.exec("alter table sessions add column expires_at text not null default ''");
      }
      db.exec(`
        create table if not exists user_identities (
          id integer primary key autoincrement,
          user_id integer not null,
          provider text not null check(provider in ('cc98', 'email')),
          identifier text not null,
          display_value text not null,
          verified_at text not null,
          unique(provider, identifier),
          unique(user_id, provider)
        );
        create index if not exists identity_user_idx on user_identities(user_id);
        create table if not exists email_verification_codes (
          id text primary key,
          email text not null,
          purpose text not null check(purpose in ('register', 'bind', 'password-reset')),
          code_hash text not null,
          salt text not null,
          expires_at text not null,
          attempts_left integer not null default 5,
          consumed_at text not null default '',
          requested_at text not null,
          request_ip_hash text not null default ''
        );
        create index if not exists email_code_lookup_idx
          on email_verification_codes(email, purpose, requested_at desc);
        create table if not exists user_courses (
          user_id integer not null,
          course_code text not null,
          course_name text not null,
          teacher_name text not null default '',
          term text not null default '',
          class_time text not null default '',
          class_location text not null default '',
          imported_at text not null,
          primary key (user_id, course_code)
        );
        create table if not exists user_favorites (
          user_id integer not null,
          content_id text not null,
          created_at text not null,
          primary key (user_id, content_id)
        );
        create table if not exists notifications (
          id text primary key,
          user_id integer not null,
          type text not null,
          actor_id integer,
          content_id text not null default '',
          comment_id text not null default '',
          submission_id text not null default '',
          title text not null,
          body text not null,
          created_at text not null,
          read_at text not null default ''
        );
        create index if not exists notification_user_idx on notifications(user_id, created_at desc);
      `);
      const legacyUsers = db.prepare(`
        select id, cc98_name as cc98Name, nickname from users
        where cc98_name not like '__email__:%'
      `).all();
      const insertIdentity = db.prepare(`
        insert into user_identities (user_id, provider, identifier, display_value, verified_at)
        values (?, 'cc98', ?, ?, ?)
        on conflict(provider, identifier) do nothing
      `);
      for (const user of legacyUsers) {
        insertIdentity.run(user.id, normalizeIdentity('cc98', user.cc98Name), user.cc98Name, new Date().toISOString());
        if (!user.nickname) db.prepare('update users set nickname = ? where id = ?').run(user.cc98Name, user.id);
      }
      const users = db.prepare(`
        select id, cc98_name as cc98Name, nickname, public_id as publicId,
          nickname_normalized as nicknameNormalized
        from users order by id
      `).all();
      const usedNicknames = new Set();
      const updateProfileIdentity = db.prepare(`
        update users set public_id = ?, nickname = ?, nickname_normalized = ? where id = ?
      `);
      for (const user of users) {
        let nickname = String(user.nickname || '').trim();
        if (!nickname || nickname.startsWith('__email__:')) nickname = `学生${user.id}`;
        let nicknameNormalized = normalizeNickname(nickname);
        if (!nicknameNormalized || usedNicknames.has(nicknameNormalized)) {
          nickname = `${nickname.slice(0, 16) || '学生'}-${user.id}`;
          nicknameNormalized = normalizeNickname(nickname);
        }
        usedNicknames.add(nicknameNormalized);
        updateProfileIdentity.run(user.publicId || randomUUID(), nickname, nicknameNormalized, user.id);
      }
      db.exec(`
        create unique index if not exists users_public_id_unique on users(public_id);
        create unique index if not exists users_nickname_unique on users(nickname_normalized);
      `);
    },

    seedVerificationCodes(codes) {
      const statement = db.prepare(`
        insert into verification_codes (code, cc98_name) values (?, ?) on conflict(code) do nothing
      `);
      for (const item of codes) statement.run(item.code, item.cc98Name ?? null);
    },

    findVerificationCode(code) {
      return db.prepare('select code, cc98_name as cc98Name, used_by_user_id as usedByUserId from verification_codes where code = ?').get(code);
    },

    consumeVerificationCode(code, userId) {
      db.prepare('update verification_codes set used_by_user_id = ?, used_at = ? where code = ?')
        .run(userId, new Date().toISOString(), code);
    },

    findUserByIdentity(provider, identifier) {
      const row = db.prepare(`
        select u.id, u.password_hash as passwordHash, u.role, u.nickname,
          u.public_id as publicId, u.avatar_stored_name as avatarStoredName,
          u.avatar_mime_type as avatarMimeType, u.grade
        from users u join user_identities i on i.user_id = u.id
        where i.provider = ? and i.identifier = ?
      `).get(provider, normalizeIdentity(provider, identifier));
      return mapUser(row);
    },

    findUserByCc98Name(cc98Name) {
      return this.findUserByIdentity('cc98', cc98Name);
    },

    findUserByEmail(email) {
      return this.findUserByIdentity('email', email);
    },

    findUserById(id) {
      return mapUser(db.prepare(`
        select id, password_hash as passwordHash, role, nickname, public_id as publicId,
          avatar_stored_name as avatarStoredName, avatar_mime_type as avatarMimeType, grade
        from users where id = ?
      `).get(id));
    },

    findUserByPublicId(publicId) {
      return mapUser(db.prepare(`
        select id, password_hash as passwordHash, role, nickname, public_id as publicId,
          avatar_stored_name as avatarStoredName, avatar_mime_type as avatarMimeType, grade
        from users where public_id = ?
      `).get(String(publicId ?? '').trim()));
    },

    findUserByNickname(nickname) {
      return mapUser(db.prepare(`
        select id, password_hash as passwordHash, role, nickname, public_id as publicId,
          avatar_stored_name as avatarStoredName, avatar_mime_type as avatarMimeType, grade
        from users where nickname_normalized = ?
      `).get(normalizeNickname(nickname)));
    },

    searchUsersByNickname(query, limit = 8) {
      const normalized = normalizeNickname(query);
      if (!normalized) return [];
      return db.prepare(`
        select id, password_hash as passwordHash, role, nickname, public_id as publicId,
          avatar_stored_name as avatarStoredName, avatar_mime_type as avatarMimeType, grade
        from users where nickname_normalized like ? order by nickname_normalized limit ?
      `).all(`%${normalized}%`, Math.max(1, Math.min(20, Number(limit) || 8))).map(mapUser);
    },

    createUser({ cc98Name = '', email = '', nickname = '', passwordHash, role = 'student', grade = null }) {
      const legacyName = cc98Name || `__email__:${randomUUID()}`;
      const displayNickname = String(nickname || cc98Name || email.split('@')[0] || '学生').trim();
      const result = db.prepare(`
        insert into users (
          cc98_name, password_hash, role, nickname, nickname_normalized, public_id, grade, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        legacyName,
        passwordHash,
        role,
        displayNickname,
        normalizeNickname(displayNickname),
        randomUUID(),
        grade == null ? null : Number(grade),
        new Date().toISOString(),
      );
      const userId = Number(result.lastInsertRowid);
      if (cc98Name) this.addIdentity(userId, 'cc98', cc98Name);
      if (email) this.addIdentity(userId, 'email', email);
      return this.findUserById(userId);
    },

    updateProfile(userId, { nickname }) {
      const displayNickname = String(nickname ?? '').trim();
      db.prepare('update users set nickname = ?, nickname_normalized = ? where id = ?')
        .run(displayNickname, normalizeNickname(displayNickname), userId);
      return this.findUserById(userId);
    },

    updateGrade(userId, grade) {
      const next = grade == null || grade === '' ? null : Number(grade);
      db.prepare('update users set grade = ? where id = ?').run(next, userId);
      return this.findUserById(userId);
    },

    updateAvatar(userId, { storedName = '', mimeType = '' }) {
      db.prepare('update users set avatar_stored_name = ?, avatar_mime_type = ? where id = ?')
        .run(storedName, mimeType, userId);
      return this.findUserById(userId);
    },

    addIdentity(userId, provider, displayValue) {
      db.prepare(`
        insert into user_identities (user_id, provider, identifier, display_value, verified_at)
        values (?, ?, ?, ?, ?)
      `).run(userId, provider, normalizeIdentity(provider, displayValue), String(displayValue).trim(), new Date().toISOString());
      return this.findUserById(userId);
    },

    replaceCc98Identity(userId, cc98Name, verificationCode) {
      const displayName = String(cc98Name ?? '').trim();
      db.exec('begin immediate');
      try {
        const codeResult = db.prepare(`
          update verification_codes set used_by_user_id = ?, used_at = ?
          where code = ? and used_by_user_id is null
        `).run(userId, new Date().toISOString(), verificationCode);
        if (Number(codeResult.changes) !== 1) {
          throw new Error('verification-code-unavailable');
        }
        db.prepare("delete from user_identities where user_id = ? and provider = 'cc98'").run(userId);
        db.prepare(`
          insert into user_identities (user_id, provider, identifier, display_value, verified_at)
          values (?, 'cc98', ?, ?, ?)
        `).run(
          userId,
          normalizeIdentity('cc98', displayName),
          displayName,
          new Date().toISOString(),
        );
        db.prepare(`
          update users set cc98_name = ?, nickname = ?, nickname_normalized = ? where id = ?
        `).run(displayName, displayName, normalizeNickname(displayName), userId);
        db.exec('commit');
      } catch (error) {
        db.exec('rollback');
        throw error;
      }
      return this.findUserById(userId);
    },

    promoteAdminByCc98Name(cc98Name) {
      const user = this.findUserByCc98Name(cc98Name);
      if (!user) return null;
      db.prepare("update users set role = 'admin' where id = ?").run(user.id);
      return this.findUserById(user.id);
    },

    updatePassword(userId, passwordHash) {
      db.prepare('update users set password_hash = ? where id = ?').run(passwordHash, userId);
      db.prepare('delete from sessions where user_id = ?').run(userId);
      return this.findUserById(userId);
    },

    createEmailCode(input) {
      db.prepare(`
        insert into email_verification_codes (
          id, email, purpose, code_hash, salt, expires_at, attempts_left,
          consumed_at, requested_at, request_ip_hash
        ) values (?, ?, ?, ?, ?, ?, 5, '', ?, ?)
      `).run(
        input.id, normalizeIdentity('email', input.email), input.purpose, input.codeHash,
        input.salt, input.expiresAt, input.requestedAt, input.requestIpHash ?? '',
      );
      return this.findEmailCodeById(input.id);
    },

    findEmailCodeById(id) {
      return db.prepare(`
        select id, email, purpose, code_hash as codeHash, salt, expires_at as expiresAt,
          attempts_left as attemptsLeft, consumed_at as consumedAt, requested_at as requestedAt
        from email_verification_codes where id = ?
      `).get(id);
    },

    findLatestEmailCode(email, purpose) {
      return db.prepare(`
        select id, email, purpose, code_hash as codeHash, salt, expires_at as expiresAt,
          attempts_left as attemptsLeft, consumed_at as consumedAt, requested_at as requestedAt
        from email_verification_codes where email = ? and purpose = ? order by requested_at desc limit 1
      `).get(normalizeIdentity('email', email), purpose);
    },

    failEmailCode(id) {
      db.prepare('update email_verification_codes set attempts_left = max(0, attempts_left - 1) where id = ?').run(id);
      return this.findEmailCodeById(id);
    },

    consumeEmailCode(id, consumedAt) {
      db.prepare('update email_verification_codes set consumed_at = ? where id = ?').run(consumedAt, id);
    },

    deleteEmailCode(id) {
      db.prepare('delete from email_verification_codes where id = ?').run(id);
    },

    countEmailCodesSince(email, since) {
      return db.prepare(`select count(*) as count from email_verification_codes where email = ? and requested_at >= ?`)
        .get(normalizeIdentity('email', email), since)?.count ?? 0;
    },

    countEmailCodesByIpSince(requestIpHash, since) {
      if (!requestIpHash) return 0;
      return db.prepare(`select count(*) as count from email_verification_codes where request_ip_hash = ? and requested_at >= ?`)
        .get(requestIpHash, since)?.count ?? 0;
    },

    countAllEmailCodesSince(since) {
      return db.prepare('select count(*) as count from email_verification_codes where requested_at >= ?')
        .get(since)?.count ?? 0;
    },

    listUserCourses(userId) {
      return db.prepare(`
        select course_code as courseCode, course_name as courseName, teacher_name as teacherName,
          term, class_time as classTime, class_location as classLocation, imported_at as importedAt
        from user_courses where user_id = ? order by course_code
      `).all(userId);
    },

    replaceUserCourses(userId, courses) {
      const now = new Date().toISOString();
      db.exec('begin immediate');
      try {
        db.prepare('delete from user_courses where user_id = ?').run(userId);
        const insert = db.prepare(`
          insert into user_courses (
            user_id, course_code, course_name, teacher_name, term, class_time, class_location, imported_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const course of courses) {
          insert.run(
            userId, String(course.courseCode).toUpperCase(), course.courseName, course.teacherName ?? '',
            course.term ?? '', course.classTime ?? '', course.classLocation ?? '', now,
          );
        }
        db.exec('commit');
      } catch (error) {
        db.exec('rollback');
        throw error;
      }
      return this.listUserCourses(userId);
    },

    upsertUserCourse(userId, course) {
      db.prepare(`
        insert into user_courses (
          user_id, course_code, course_name, teacher_name, term, class_time, class_location, imported_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(user_id, course_code) do update set course_name = excluded.course_name,
          teacher_name = excluded.teacher_name, term = excluded.term, class_time = excluded.class_time,
          class_location = excluded.class_location, imported_at = excluded.imported_at
      `).run(
        userId, String(course.courseCode).toUpperCase(), course.courseName, course.teacherName ?? '',
        course.term ?? '', course.classTime ?? '', course.classLocation ?? '', new Date().toISOString(),
      );
      return this.listUserCourses(userId);
    },

    removeUserCourse(userId, courseCode) {
      db.prepare('delete from user_courses where user_id = ? and course_code = ?')
        .run(userId, String(courseCode).toUpperCase());
      return this.listUserCourses(userId);
    },

    listFavoriteIds(userId) {
      return db.prepare('select content_id as contentId from user_favorites where user_id = ? order by created_at desc')
        .all(userId).map((row) => row.contentId);
    },

    addFavorite(userId, contentId) {
      db.prepare(`
        insert into user_favorites (user_id, content_id, created_at) values (?, ?, ?)
        on conflict(user_id, content_id) do nothing
      `).run(userId, contentId, new Date().toISOString());
      return this.listFavoriteIds(userId);
    },

    removeFavorite(userId, contentId) {
      db.prepare('delete from user_favorites where user_id = ? and content_id = ?').run(userId, contentId);
      return this.listFavoriteIds(userId);
    },

    createNotification(input) {
      const id = input.id ?? randomUUID();
      db.prepare(`
        insert into notifications (
          id, user_id, type, actor_id, content_id, comment_id, submission_id,
          title, body, created_at, read_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')
      `).run(
        id, input.userId, input.type, input.actorId ?? null, input.contentId ?? '',
        input.commentId ?? '', input.submissionId ?? '', input.title, input.body,
        input.createdAt ?? new Date().toISOString(),
      );
      return this.findNotificationById(id);
    },

    findNotificationById(id) {
      return db.prepare(`
        select id, user_id as userId, type, actor_id as actorId, content_id as contentId,
          comment_id as commentId, submission_id as submissionId, title, body,
          created_at as createdAt, read_at as readAt from notifications where id = ?
      `).get(id);
    },

    listNotifications(userId, limit = 50) {
      return db.prepare(`
        select id, user_id as userId, type, actor_id as actorId, content_id as contentId,
          comment_id as commentId, submission_id as submissionId, title, body,
          created_at as createdAt, read_at as readAt from notifications
        where user_id = ? order by created_at desc limit ?
      `).all(userId, Math.max(1, Math.min(Number(limit) || 50, 100)));
    },

    countUnreadNotifications(userId) {
      return db.prepare("select count(*) as count from notifications where user_id = ? and read_at = ''")
        .get(userId)?.count ?? 0;
    },

    markNotificationRead(userId, id) {
      db.prepare("update notifications set read_at = ? where id = ? and user_id = ? and read_at = ''")
        .run(new Date().toISOString(), id, userId);
      return this.findNotificationById(id);
    },

    markAllNotificationsRead(userId) {
      db.prepare("update notifications set read_at = ? where user_id = ? and read_at = ''")
        .run(new Date().toISOString(), userId);
      return this.countUnreadNotifications(userId);
    },

    createSession({ id, userId, expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }) {
      db.prepare('insert into sessions (id, user_id, created_at, expires_at) values (?, ?, ?, ?)')
        .run(id, userId, new Date().toISOString(), expiresAt);
    },
    findSession(id) {
      const session = db.prepare('select id, user_id as userId, expires_at as expiresAt from sessions where id = ?').get(id);
      if (!session) return undefined;
      if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
        db.prepare('delete from sessions where id = ?').run(id);
        return undefined;
      }
      return session;
    },
    deleteSession(id) {
      db.prepare('delete from sessions where id = ?').run(id);
    },
    deleteOtherSessions(userId, currentSessionId) {
      db.prepare('delete from sessions where user_id = ? and id <> ?').run(userId, currentSessionId);
    },
    close() {
      db.close();
    },
  };
}
