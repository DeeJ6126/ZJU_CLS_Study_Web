import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createAuthStore({ filename = 'server/data/auth.sqlite' } = {}) {
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);

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
    },

    seedVerificationCodes(codes) {
      const statement = db.prepare(`
        insert into verification_codes (code, cc98_name)
        values (?, ?)
        on conflict(code) do nothing
      `);
      for (const item of codes) {
        statement.run(item.code, item.cc98Name ?? null);
      }
    },

    findVerificationCode(code) {
      return db.prepare('select code, cc98_name as cc98Name, used_by_user_id as usedByUserId from verification_codes where code = ?').get(code);
    },

    consumeVerificationCode(code, userId) {
      db.prepare('update verification_codes set used_by_user_id = ?, used_at = ? where code = ?')
        .run(userId, new Date().toISOString(), code);
    },

    findUserByCc98Name(cc98Name) {
      return db.prepare('select id, cc98_name as cc98Name, password_hash as passwordHash from users where cc98_name = ?').get(cc98Name);
    },

    findUserById(id) {
      return db.prepare('select id, cc98_name as cc98Name, password_hash as passwordHash from users where id = ?').get(id);
    },

    createUser({ cc98Name, passwordHash }) {
      const result = db.prepare('insert into users (cc98_name, password_hash, created_at) values (?, ?, ?)')
        .run(cc98Name, passwordHash, new Date().toISOString());
      return this.findUserById(result.lastInsertRowid);
    },

    createSession({ id, userId }) {
      db.prepare('insert into sessions (id, user_id, created_at) values (?, ?, ?)')
        .run(id, userId, new Date().toISOString());
    },

    findSession(id) {
      return db.prepare('select id, user_id as userId from sessions where id = ?').get(id);
    },

    deleteSession(id) {
      db.prepare('delete from sessions where id = ?').run(id);
    },
  };
}
