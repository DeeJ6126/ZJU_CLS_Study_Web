import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createProductionBackup } from '../scripts/backup-production-data.mjs';

function createDatabase(filePath, value) {
  const database = new DatabaseSync(filePath);
  database.exec('CREATE TABLE records (value TEXT NOT NULL)');
  database.prepare('INSERT INTO records (value) VALUES (?)').run(value);
  database.close();
}

test('production backup snapshots unique databases, copies uploads, and removes expired snapshots', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zjubio-backup-'));
  const dataDir = path.join(root, 'data');
  const backupDir = path.join(root, 'backups');
  const uploadDir = path.join(dataDir, 'content-uploads');
  const avatarDir = path.join(dataDir, 'profile-avatars');
  await mkdir(uploadDir, { recursive: true });
  await mkdir(avatarDir, { recursive: true });
  await mkdir(path.join(backupDir, '2026-08-01T00-00-00-000Z'), { recursive: true });
  await writeFile(path.join(uploadDir, 'paper.pdf'), '%PDF-test');
  await writeFile(path.join(avatarDir, 'avatar.webp'), 'webp-test');

  const authFile = path.join(dataDir, 'auth.sqlite');
  const contentFile = path.join(dataDir, 'content.sqlite');
  const homepageFile = path.join(dataDir, 'student-homepages.sqlite');
  createDatabase(authFile, 'auth');
  createDatabase(contentFile, 'content');
  createDatabase(homepageFile, 'homepage');

  const result = await createProductionBackup({
    env: {
      AUTH_DB_FILE: authFile,
      QUIZ_DB_FILE: authFile,
      CONTENT_DB_FILE: contentFile,
      STUDENT_HOMEPAGE_DB_FILE: homepageFile,
      CONTENT_UPLOAD_DIR: uploadDir,
      PROFILE_AVATAR_DIR: avatarDir,
      ZJUBIO_BACKUP_DIR: backupDir,
      ZJUBIO_BACKUP_RETENTION_DAYS: '14',
    },
    now: new Date('2026-09-15T12:00:00.000Z'),
  });

  assert.equal(result.databases.length, 3);
  assert.deepEqual(result.databases.map((item) => item.integrity), ['ok', 'ok', 'ok']);
  assert.equal(await readFile(path.join(result.snapshotDir, 'uploads', 'paper.pdf'), 'utf8'), '%PDF-test');
  assert.equal(await readFile(path.join(result.snapshotDir, 'avatars', 'avatar.webp'), 'utf8'), 'webp-test');
  const manifest = JSON.parse(await readFile(path.join(result.snapshotDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.databases.length, 3);
  await assert.rejects(readFile(path.join(backupDir, '2026-08-01T00-00-00-000Z', 'manifest.json')));
});
