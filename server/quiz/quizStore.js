import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function jsonStringify(value) {
  return JSON.stringify(value ?? null);
}

function jsonParse(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return JSON.parse(value);
}

function toCollection(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    courseCode: row.courseCode,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sourceVersion: row.sourceVersion,
    categoryCount: row.categoryCount,
    questionCount: row.questionCount,
    isEnabled: Boolean(row.isEnabled),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCategory(row) {
  return {
    id: row.id,
    collectionId: row.collectionId,
    sourceId: row.sourceId,
    title: row.title,
    parentTitle: row.parentTitle,
    type: row.type,
    sortOrder: row.sortOrder,
    questionCount: row.questionCount,
  };
}

function toSafeQuestion(row) {
  return {
    id: row.id,
    collectionId: row.collectionId,
    categoryId: row.categoryId,
    sourceQuestionId: row.sourceQuestionId,
    type: row.type,
    prompt: row.prompt,
    body: jsonParse(row.bodyJson, {}),
    explanation: jsonParse(row.explanationJson, null),
    source: jsonParse(row.sourceJson, {}),
    sortOrder: row.sortOrder,
  };
}

function toEvaluationQuestion(row) {
  if (!row) {
    return null;
  }

  return {
    ...toSafeQuestion(row),
    answer: jsonParse(row.answerJson, {}),
  };
}

function toSessionAnswer(row) {
  if (!row) {
    return null;
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    collectionId: row.collectionId,
    questionId: row.questionId,
    sourceQuestionId: row.sourceQuestionId,
    answer: jsonParse(row.answerJson, {}),
    isCorrect: row.isCorrect === null || row.isCorrect === undefined ? null : Boolean(row.isCorrect),
    gradingMode: row.gradingMode,
    answeredAt: row.answeredAt,
  };
}

function toSessionReveal(row) {
  if (!row) {
    return null;
  }

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    collectionId: row.collectionId,
    questionId: row.questionId,
    sourceQuestionId: row.sourceQuestionId,
    revealedAt: row.revealedAt,
  };
}

export function createQuizStore({ filename = 'server/data/auth.sqlite' } = {}) {
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);

  return {
    initialize() {
      db.exec(`
        create table if not exists quiz_collections (
          id integer primary key autoincrement,
          course_code text not null,
          slug text unique not null,
          title text not null,
          description text not null default '',
          source_version text not null default '',
          category_count integer not null default 0,
          question_count integer not null default 0,
          is_enabled integer not null default 1,
          created_at text not null,
          updated_at text not null
        );

        create table if not exists quiz_categories (
          id integer primary key autoincrement,
          collection_id integer not null,
          source_id text not null,
          title text not null,
          parent_title text not null default '',
          type text not null,
          sort_order integer not null,
          question_count integer not null default 0,
          unique(collection_id, source_id)
        );

        create table if not exists quiz_questions (
          id integer primary key autoincrement,
          collection_id integer not null,
          category_id integer not null,
          source_question_id text not null,
          type text not null,
          prompt text not null,
          body_json text not null,
          answer_json text not null,
          explanation_json text,
          source_json text not null,
          sort_order integer not null,
          is_active integer not null default 1,
          unique(collection_id, source_question_id)
        );

        create table if not exists quiz_import_runs (
          id integer primary key autoincrement,
          collection_slug text not null,
          source_path text not null,
          source_hash text not null,
          status text not null,
          imported_counts_json text not null,
          message text not null default '',
          created_at text not null
        );

        create table if not exists quiz_sessions (
          id text primary key,
          user_id integer not null,
          collection_id integer not null,
          mode text not null,
          selected_category_source_ids_json text not null,
          question_order_json text not null,
          current_index integer not null default 0,
          started_at text not null,
          completed_at text
        );

        create table if not exists quiz_answers (
          id integer primary key autoincrement,
          session_id text not null,
          user_id integer not null,
          collection_id integer not null,
          question_id integer not null,
          answer_json text not null,
          is_correct integer,
          grading_mode text not null,
          answered_at text not null,
          unique(session_id, question_id)
        );

        create table if not exists quiz_mistakes (
          id integer primary key autoincrement,
          user_id integer not null,
          collection_id integer not null,
          question_id integer not null,
          wrong_count integer not null default 1,
          last_answer_json text not null,
          correct_display text not null,
          last_answered_at text not null,
          resolved_at text,
          unique(user_id, collection_id, question_id)
        );

        create table if not exists quiz_reveals (
          id integer primary key autoincrement,
          session_id text not null,
          user_id integer not null,
          collection_id integer not null,
          question_id integer not null,
          revealed_at text not null,
          unique(session_id, question_id)
        );
      `);
    },

    replaceCollection(collection, categories, questions, importRun) {
      const now = new Date().toISOString();
      const existing = this.findCollectionBySlug(collection.slug);

      if (existing) {
        db.prepare(`
          update quiz_collections
          set course_code = ?, title = ?, description = ?, source_version = ?,
              category_count = ?, question_count = ?, is_enabled = ?, updated_at = ?
          where slug = ?
        `).run(
          collection.courseCode,
          collection.title,
          collection.description ?? '',
          collection.sourceVersion ?? '',
          categories.length,
          questions.length,
          collection.isEnabled === false ? 0 : 1,
          now,
          collection.slug,
        );
        db.prepare('delete from quiz_questions where collection_id = ?').run(existing.id);
        db.prepare('delete from quiz_categories where collection_id = ?').run(existing.id);
      } else {
        db.prepare(`
          insert into quiz_collections (
            course_code, slug, title, description, source_version,
            category_count, question_count, is_enabled, created_at, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          collection.courseCode,
          collection.slug,
          collection.title,
          collection.description ?? '',
          collection.sourceVersion ?? '',
          categories.length,
          questions.length,
          collection.isEnabled === false ? 0 : 1,
          now,
          now,
        );
      }

      const savedCollection = this.findCollectionBySlug(collection.slug);
      const categoryStatement = db.prepare(`
        insert into quiz_categories (
          collection_id, source_id, title, parent_title, type, sort_order, question_count
        )
        values (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const category of categories) {
        categoryStatement.run(
          savedCollection.id,
          category.sourceId,
          category.title,
          category.parentTitle ?? '',
          category.type,
          category.sortOrder,
          category.questionCount,
        );
      }

      const categoriesBySourceId = new Map(
        this.listCategories(savedCollection.id).map((category) => [category.sourceId, category]),
      );
      const questionStatement = db.prepare(`
        insert into quiz_questions (
          collection_id, category_id, source_question_id, type, prompt, body_json,
          answer_json, explanation_json, source_json, sort_order, is_active
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const question of questions) {
        const category = categoriesBySourceId.get(question.categorySourceId);
        if (!category) {
          throw new Error(`Missing quiz category ${question.categorySourceId} for ${question.sourceQuestionId}`);
        }

        questionStatement.run(
          savedCollection.id,
          category.id,
          question.sourceQuestionId,
          question.type,
          question.prompt,
          jsonStringify(question.body),
          jsonStringify(question.answer),
          jsonStringify(question.explanation),
          jsonStringify(question.source),
          question.sortOrder,
          question.isActive === false ? 0 : 1,
        );
      }

      db.prepare(`
        insert into quiz_import_runs (
          collection_slug, source_path, source_hash, status,
          imported_counts_json, message, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?)
      `).run(
        importRun.collectionSlug,
        importRun.sourcePath,
        importRun.sourceHash,
        importRun.status,
        jsonStringify(importRun.importedCounts),
        importRun.message ?? '',
        now,
      );

      return this.findCollectionBySlug(collection.slug);
    },

    listCollections() {
      return db.prepare(`
        select
          id,
          course_code as courseCode,
          slug,
          title,
          description,
          source_version as sourceVersion,
          category_count as categoryCount,
          question_count as questionCount,
          is_enabled as isEnabled,
          created_at as createdAt,
          updated_at as updatedAt
        from quiz_collections
        order by id
      `).all().map(toCollection);
    },

    findCollectionBySlug(slug) {
      return toCollection(db.prepare(`
        select
          id,
          course_code as courseCode,
          slug,
          title,
          description,
          source_version as sourceVersion,
          category_count as categoryCount,
          question_count as questionCount,
          is_enabled as isEnabled,
          created_at as createdAt,
          updated_at as updatedAt
        from quiz_collections
        where slug = ?
      `).get(slug));
    },

    listCategories(collectionId) {
      return db.prepare(`
        select
          id,
          collection_id as collectionId,
          source_id as sourceId,
          title,
          parent_title as parentTitle,
          type,
          sort_order as sortOrder,
          question_count as questionCount
        from quiz_categories
        where collection_id = ?
        order by sort_order, id
      `).all(collectionId).map(toCategory);
    },

    getSafeQuestions(collectionId, { limit = 50 } = {}) {
      return db.prepare(`
        select
          id,
          collection_id as collectionId,
          category_id as categoryId,
          source_question_id as sourceQuestionId,
          type,
          prompt,
          body_json as bodyJson,
          explanation_json as explanationJson,
          source_json as sourceJson,
          sort_order as sortOrder
        from quiz_questions
        where collection_id = ? and is_active = 1
        order by sort_order, id
        limit ?
      `).all(collectionId, limit).map(toSafeQuestion);
    },

    getSafeQuestionBySourceId(collectionId, sourceQuestionId) {
      const row = db.prepare(`
        select
          id,
          collection_id as collectionId,
          category_id as categoryId,
          source_question_id as sourceQuestionId,
          type,
          prompt,
          body_json as bodyJson,
          explanation_json as explanationJson,
          source_json as sourceJson,
          sort_order as sortOrder
        from quiz_questions
        where collection_id = ? and source_question_id = ? and is_active = 1
      `).get(collectionId, sourceQuestionId);

      return row ? toSafeQuestion(row) : null;
    },

    getQuestionForEvaluationBySourceId(collectionId, sourceQuestionId) {
      return toEvaluationQuestion(db.prepare(`
        select
          id,
          collection_id as collectionId,
          category_id as categoryId,
          source_question_id as sourceQuestionId,
          type,
          prompt,
          body_json as bodyJson,
          answer_json as answerJson,
          explanation_json as explanationJson,
          source_json as sourceJson,
          sort_order as sortOrder
        from quiz_questions
        where collection_id = ? and source_question_id = ? and is_active = 1
      `).get(collectionId, sourceQuestionId));
    },

    listQuestionSourceIds(collectionId, { categorySourceIds = [], limit = 0 } = {}) {
      const categoryFilter = categorySourceIds.length
        ? `and c.source_id in (${categorySourceIds.map(() => '?').join(', ')})`
        : '';
      const limitFilter = limit > 0 ? 'limit ?' : '';
      const params = [
        collectionId,
        ...categorySourceIds,
        ...(limit > 0 ? [limit] : []),
      ];

      return db.prepare(`
        select q.source_question_id as sourceQuestionId
        from quiz_questions q
        join quiz_categories c on c.id = q.category_id
        where q.collection_id = ? and q.is_active = 1 ${categoryFilter}
        order by q.sort_order, q.id
        ${limitFilter}
      `).all(...params).map((row) => row.sourceQuestionId);
    },

    listQuestionRefsBySourceIds(collectionId, sourceQuestionIds = []) {
      if (!sourceQuestionIds.length) {
        return [];
      }

      return db.prepare(`
        select
          q.source_question_id as sourceQuestionId,
          q.sort_order as sortOrder,
          c.source_id as categorySourceId,
          c.sort_order as categorySortOrder
        from quiz_questions q
        join quiz_categories c on c.id = q.category_id
        where q.collection_id = ? and q.is_active = 1
          and q.source_question_id in (${sourceQuestionIds.map(() => '?').join(', ')})
        order by c.sort_order, q.sort_order, q.id
      `).all(collectionId, ...sourceQuestionIds);
    },

    createSession(session) {
      db.prepare(`
        insert into quiz_sessions (
          id, user_id, collection_id, mode, selected_category_source_ids_json,
          question_order_json, current_index, started_at, completed_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session.id,
        session.userId,
        session.collectionId,
        session.mode,
        jsonStringify(session.selectedCategorySourceIds ?? []),
        jsonStringify(session.questionOrder ?? []),
        session.currentIndex ?? 0,
        session.startedAt,
        session.completedAt ?? null,
      );
      return this.findSessionById(session.id);
    },

    findSessionById(id) {
      const row = db.prepare(`
        select
          id,
          user_id as userId,
          collection_id as collectionId,
          mode,
          selected_category_source_ids_json as selectedCategorySourceIdsJson,
          question_order_json as questionOrderJson,
          current_index as currentIndex,
          started_at as startedAt,
          completed_at as completedAt
        from quiz_sessions
        where id = ?
      `).get(id);

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.userId,
        collectionId: row.collectionId,
        mode: row.mode,
        selectedCategorySourceIds: jsonParse(row.selectedCategorySourceIdsJson, []),
        questionOrder: jsonParse(row.questionOrderJson, []),
        currentIndex: row.currentIndex,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
      };
    },

    updateSessionIndex(sessionId, currentIndex) {
      db.prepare('update quiz_sessions set current_index = ? where id = ?').run(currentIndex, sessionId);
      return this.findSessionById(sessionId);
    },

    findSessionAnswer(sessionId, questionId) {
      return toSessionAnswer(db.prepare(`
        select
          a.session_id as sessionId,
          a.user_id as userId,
          a.collection_id as collectionId,
          a.question_id as questionId,
          q.source_question_id as sourceQuestionId,
          a.answer_json as answerJson,
          a.is_correct as isCorrect,
          a.grading_mode as gradingMode,
          a.answered_at as answeredAt
        from quiz_answers a
        join quiz_questions q on q.id = a.question_id
        where a.session_id = ? and a.question_id = ?
      `).get(sessionId, questionId));
    },

    listSessionAnswers(sessionId) {
      return db.prepare(`
        select
          a.session_id as sessionId,
          a.user_id as userId,
          a.collection_id as collectionId,
          a.question_id as questionId,
          q.source_question_id as sourceQuestionId,
          a.answer_json as answerJson,
          a.is_correct as isCorrect,
          a.grading_mode as gradingMode,
          a.answered_at as answeredAt
        from quiz_answers a
        join quiz_questions q on q.id = a.question_id
        where a.session_id = ?
        order by a.answered_at, a.id
      `).all(sessionId).map(toSessionAnswer);
    },

    recordAnswer({ sessionId, userId, collectionId, questionId, answer, isCorrect, gradingMode }) {
      db.prepare(`
        insert into quiz_answers (
          session_id, user_id, collection_id, question_id, answer_json,
          is_correct, grading_mode, answered_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(session_id, question_id) do nothing
      `).run(
        sessionId,
        userId,
        collectionId,
        questionId,
        jsonStringify(answer),
        isCorrect === null || isCorrect === undefined ? null : (isCorrect ? 1 : 0),
        gradingMode,
        new Date().toISOString(),
      );

      return this.findSessionAnswer(sessionId, questionId);
    },

    listSessionReveals(sessionId) {
      return db.prepare(`
        select
          r.session_id as sessionId,
          r.user_id as userId,
          r.collection_id as collectionId,
          r.question_id as questionId,
          q.source_question_id as sourceQuestionId,
          r.revealed_at as revealedAt
        from quiz_reveals r
        join quiz_questions q on q.id = r.question_id
        where r.session_id = ?
        order by r.revealed_at, r.id
      `).all(sessionId).map(toSessionReveal);
    },

    recordReveal({ sessionId, userId, collectionId, questionId }) {
      db.prepare(`
        insert into quiz_reveals (session_id, user_id, collection_id, question_id, revealed_at)
        values (?, ?, ?, ?, ?)
        on conflict(session_id, question_id) do nothing
      `).run(sessionId, userId, collectionId, questionId, new Date().toISOString());

      return toSessionReveal(db.prepare(`
        select
          r.session_id as sessionId,
          r.user_id as userId,
          r.collection_id as collectionId,
          r.question_id as questionId,
          q.source_question_id as sourceQuestionId,
          r.revealed_at as revealedAt
        from quiz_reveals r
        join quiz_questions q on q.id = r.question_id
        where r.session_id = ? and r.question_id = ?
      `).get(sessionId, questionId));
    },

    upsertMistake({ userId, collectionId, questionId, answer, correctDisplay }) {
      const now = new Date().toISOString();
      db.prepare(`
        insert into quiz_mistakes (
          user_id, collection_id, question_id, wrong_count,
          last_answer_json, correct_display, last_answered_at, resolved_at
        )
        values (?, ?, ?, 1, ?, ?, ?, null)
        on conflict(user_id, collection_id, question_id) do update set
          wrong_count = quiz_mistakes.wrong_count + 1,
          last_answer_json = excluded.last_answer_json,
          correct_display = excluded.correct_display,
          last_answered_at = excluded.last_answered_at,
          resolved_at = null
      `).run(userId, collectionId, questionId, jsonStringify(answer), correctDisplay, now);

      return this.findMistake(userId, collectionId, questionId);
    },

    findMistake(userId, collectionId, questionId) {
      const row = db.prepare(`
        select
          id,
          user_id as userId,
          collection_id as collectionId,
          question_id as questionId,
          wrong_count as wrongCount,
          last_answer_json as lastAnswerJson,
          correct_display as correctDisplay,
          last_answered_at as lastAnsweredAt,
          resolved_at as resolvedAt
        from quiz_mistakes
        where user_id = ? and collection_id = ? and question_id = ?
      `).get(userId, collectionId, questionId);

      if (!row) {
        return null;
      }

      return {
        ...row,
        lastAnswer: jsonParse(row.lastAnswerJson, {}),
      };
    },

    listMistakes(userId, collectionId) {
      return db.prepare(`
        select
          m.id,
          m.user_id as userId,
          m.collection_id as collectionId,
          m.question_id as questionId,
          q.source_question_id as sourceQuestionId,
          m.wrong_count as wrongCount,
          m.last_answer_json as lastAnswerJson,
          m.correct_display as correctDisplay,
          m.last_answered_at as lastAnsweredAt,
          m.resolved_at as resolvedAt
        from quiz_mistakes m
        join quiz_questions q on q.id = m.question_id
        where m.user_id = ? and m.collection_id = ? and m.resolved_at is null
        order by m.last_answered_at desc, m.id desc
      `).all(userId, collectionId).map((row) => ({
        ...row,
        lastAnswer: jsonParse(row.lastAnswerJson, {}),
      }));
    },

    deleteMistakeBySourceQuestionId({ userId, collectionId, sourceQuestionId }) {
      const question = this.getQuestionForEvaluationBySourceId(collectionId, sourceQuestionId);
      if (!question) {
        return false;
      }

      const result = db.prepare(`
        delete from quiz_mistakes
        where user_id = ? and collection_id = ? and question_id = ?
      `).run(userId, collectionId, question.id);
      return result.changes > 0;
    },

    getProgressSummary(userId, collectionId) {
      const row = db.prepare(`
        select
          count(*) as answered,
          sum(case when is_correct = 1 then 1 else 0 end) as correct,
          sum(case when is_correct = 0 then 1 else 0 end) as incorrect
        from quiz_answers
        where user_id = ? and collection_id = ?
      `).get(userId, collectionId);
      const activeSession = db.prepare(`
        select id
        from quiz_sessions
        where user_id = ? and collection_id = ? and completed_at is null
        order by started_at desc
        limit 1
      `).get(userId, collectionId);

      return {
        answered: row.answered ?? 0,
        correct: row.correct ?? 0,
        incorrect: row.incorrect ?? 0,
        activeSessionId: activeSession?.id ?? '',
      };
    },

    resetUserCollectionRecords({ userId, collectionId, scope = 'all' }) {
      if (scope === 'mistakes' || scope === 'all') {
        db.prepare('delete from quiz_mistakes where user_id = ? and collection_id = ?').run(userId, collectionId);
      }

      if (scope === 'sessions' || scope === 'all') {
        const sessions = db.prepare('select id from quiz_sessions where user_id = ? and collection_id = ?').all(userId, collectionId);
        for (const session of sessions) {
          db.prepare('delete from quiz_answers where session_id = ? and user_id = ?').run(session.id, userId);
          db.prepare('delete from quiz_reveals where session_id = ? and user_id = ?').run(session.id, userId);
        }
        db.prepare('delete from quiz_sessions where user_id = ? and collection_id = ?').run(userId, collectionId);
      }
    },

    countQuestions() {
      return db.prepare('select count(*) as count from quiz_questions').get().count;
    },

    listImportRuns() {
      return db.prepare(`
        select
          id,
          collection_slug as collectionSlug,
          source_path as sourcePath,
          source_hash as sourceHash,
          status,
          imported_counts_json as importedCountsJson,
          message,
          created_at as createdAt
        from quiz_import_runs
        order by id
      `).all().map((row) => ({
        ...row,
        importedCounts: jsonParse(row.importedCountsJson, {}),
      }));
    },
  };
}
