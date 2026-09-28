import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createConsultationStore({ filename = 'server/data/consultation.sqlite' } = {}) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);

  function mapSession(row) {
    return row ? {
      id: row.id, mentorUserId: row.mentorUserId, startsAt: row.startsAt,
      endsAt: row.endsAt, closedAt: row.closedAt,
    } : null;
  }

  function mapConversation(row) {
    return row ? {
      id: row.id, sessionId: row.sessionId, visitorUserId: row.visitorUserId,
      participantName: row.participantName, createdAt: row.createdAt,
      updatedAt: row.updatedAt, unreadCount: row.unreadCount ?? 0,
      latestMessageId: row.latestMessageId ?? null,
    } : null;
  }

  function mapMessage(row) {
    return row ? {
      id: row.id, conversationId: row.conversationId, sender: row.sender,
      text: row.text, createdAt: row.createdAt,
    } : null;
  }

  return {
    initialize() {
      db.exec(`
        create table if not exists consultation_sessions (
          id integer primary key autoincrement,
          mentor_user_id integer not null,
          starts_at text not null,
          ends_at text not null,
          closed_at text not null default '',
          created_at text not null
        );
        create table if not exists consultation_conversations (
          id text primary key,
          session_id integer not null references consultation_sessions(id),
          visitor_user_id integer,
          guest_token_hash text,
          participant_name text not null,
          created_at text not null,
          updated_at text not null
        );
        create unique index if not exists consultation_user_unique
          on consultation_conversations(session_id, visitor_user_id)
          where visitor_user_id is not null;
        create unique index if not exists consultation_guest_unique
          on consultation_conversations(session_id, guest_token_hash)
          where guest_token_hash is not null;
        create index if not exists consultation_inbox_idx
          on consultation_conversations(session_id, updated_at desc);
        create table if not exists consultation_guest_sessions (
          token_hash text primary key,
          created_at text not null
        );
        create table if not exists consultation_messages (
          id text primary key,
          conversation_id text not null references consultation_conversations(id),
          sender text not null check(sender in ('visitor', 'mentor')),
          text text not null,
          created_at text not null,
          mentor_read_at text not null default ''
        );
        create index if not exists consultation_messages_idx
          on consultation_messages(conversation_id, created_at);
      `);
    },

    latestSession() {
      return mapSession(db.prepare(`
        select id, mentor_user_id as mentorUserId, starts_at as startsAt,
          ends_at as endsAt, closed_at as closedAt
        from consultation_sessions order by id desc limit 1
      `).get());
    },

    replaceSession({ mentorUserId, startsAt, endsAt, now }) {
      db.exec('begin immediate');
      try {
        db.prepare("update consultation_sessions set closed_at = ? where closed_at = ''")
          .run(now);
        const result = db.prepare(`
          insert into consultation_sessions (mentor_user_id, starts_at, ends_at, created_at)
          values (?, ?, ?, ?)
        `).run(mentorUserId, startsAt, endsAt, now);
        db.exec('commit');
        return this.latestSession() ?? { id: Number(result.lastInsertRowid) };
      } catch (error) {
        db.exec('rollback');
        throw error;
      }
    },

    closeSession(now) {
      const session = this.latestSession();
      if (!session || session.closedAt) return session;
      db.prepare('update consultation_sessions set closed_at = ? where id = ?').run(now, session.id);
      return this.latestSession();
    },

    hasGuestSession(tokenHash) {
      return Boolean(db.prepare('select 1 from consultation_guest_sessions where token_hash = ?').get(tokenHash));
    },

    createGuestSession(tokenHash, now) {
      db.prepare('insert into consultation_guest_sessions (token_hash, created_at) values (?, ?)')
        .run(tokenHash, now);
    },

    findConversationForIdentity({ sessionId, visitorUserId, guestTokenHash }) {
      const row = visitorUserId
        ? db.prepare(`
          select id, session_id as sessionId, visitor_user_id as visitorUserId,
            participant_name as participantName, created_at as createdAt, updated_at as updatedAt
          from consultation_conversations where session_id = ? and visitor_user_id = ?
        `).get(sessionId, visitorUserId)
        : guestTokenHash ? db.prepare(`
          select id, session_id as sessionId, visitor_user_id as visitorUserId,
            participant_name as participantName, created_at as createdAt, updated_at as updatedAt
          from consultation_conversations where session_id = ? and guest_token_hash = ?
        `).get(sessionId, guestTokenHash) : null;
      return mapConversation(row);
    },

    createOrFindConversation({ sessionId, visitorUserId = null, guestTokenHash = null, participantName, now }) {
      const existing = this.findConversationForIdentity({ sessionId, visitorUserId, guestTokenHash });
      if (existing) return existing;
      const id = randomUUID();
      db.prepare(`
        insert into consultation_conversations
          (id, session_id, visitor_user_id, guest_token_hash, participant_name, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?)
      `).run(id, sessionId, visitorUserId, guestTokenHash, participantName, now, now);
      return this.findConversation(id);
    },

    findConversation(id) {
      return mapConversation(db.prepare(`
        select id, session_id as sessionId, visitor_user_id as visitorUserId,
          participant_name as participantName, created_at as createdAt, updated_at as updatedAt
        from consultation_conversations where id = ?
      `).get(id));
    },

    isGuestConversationOwner(id, guestTokenHash) {
      if (!guestTokenHash) return false;
      return Boolean(db.prepare(`
        select 1 from consultation_conversations
        where id = ? and visitor_user_id is null and guest_token_hash = ?
      `).get(id, guestTokenHash));
    },

    listMentorConversations(sessionId) {
      return db.prepare(`
        select c.id, c.session_id as sessionId, c.visitor_user_id as visitorUserId,
          c.participant_name as participantName, c.created_at as createdAt,
          c.updated_at as updatedAt,
          (select count(*) from consultation_messages m
            where m.conversation_id = c.id and m.sender = 'visitor' and m.mentor_read_at = '') as unreadCount,
          (select m.id from consultation_messages m where m.conversation_id = c.id
            order by m.rowid desc limit 1) as latestMessageId
        from consultation_conversations c where c.session_id = ?
        order by c.updated_at desc, c.rowid desc
      `).all(sessionId).map(mapConversation);
    },

    listMessages(conversationId) {
      return db.prepare(`
        select id, conversation_id as conversationId, sender, text, created_at as createdAt
        from consultation_messages where conversation_id = ? order by rowid
      `).all(conversationId).map(mapMessage);
    },

    markMentorRead(conversationId, now) {
      db.prepare(`
        update consultation_messages set mentor_read_at = ?
        where conversation_id = ? and sender = 'visitor' and mentor_read_at = ''
      `).run(now, conversationId);
    },

    latestMessage(conversationId) {
      return db.prepare(`
        select sender, created_at as createdAt from consultation_messages
        where conversation_id = ? order by rowid desc limit 1
      `).get(conversationId);
    },

    countMessagesSince(conversationId, sender, since) {
      return db.prepare(`
        select count(*) as count from consultation_messages
        where conversation_id = ? and sender = ? and created_at >= ?
      `).get(conversationId, sender, since).count;
    },

    addMessage({ conversationId, sender, text, now }) {
      const id = randomUUID();
      db.exec('begin immediate');
      try {
        db.prepare(`
          insert into consultation_messages (id, conversation_id, sender, text, created_at)
          values (?, ?, ?, ?, ?)
        `).run(id, conversationId, sender, text, now);
        db.prepare('update consultation_conversations set updated_at = ? where id = ?')
          .run(now, conversationId);
        db.exec('commit');
      } catch (error) {
        db.exec('rollback');
        throw error;
      }
      return mapMessage({ id, conversationId, sender, text, createdAt: now });
    },
  };
}
