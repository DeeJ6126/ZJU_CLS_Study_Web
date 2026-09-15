import { cp, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;

function resolveProjectPath(value) {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(projectRoot, value);
}

function assertSafeBackupRoot(value) {
  const resolved = resolveProjectPath(value);
  const filesystemRoot = path.parse(resolved).root;
  if (resolved === filesystemRoot || resolved === projectRoot) {
    throw new Error(`Unsafe backup root: ${resolved}`);
  }
  return resolved;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function snapshotDate(name) {
  const match = SNAPSHOT_PATTERN.exec(name);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, millisecond] = match;
  return new Date(Date.UTC(
    Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute),
    Number(second), Number(millisecond),
  ));
}

function databaseSources(env) {
  const definitions = [
    ['auth', env.AUTH_DB_FILE || 'server/data/auth.sqlite'],
    ['quiz', env.QUIZ_DB_FILE || env.AUTH_DB_FILE || 'server/data/auth.sqlite'],
    ['content', env.CONTENT_DB_FILE || 'server/data/content.sqlite'],
    ['student-homepages', env.STUDENT_HOMEPAGE_DB_FILE || 'server/data/student-homepages.sqlite'],
  ];
  const unique = new Map();
  for (const [label, source] of definitions) {
    const resolved = resolveProjectPath(source);
    const existing = unique.get(resolved) ?? { source: resolved, labels: [] };
    existing.labels.push(label);
    unique.set(resolved, existing);
  }
  return [...unique.values()];
}

async function snapshotDatabase(source, target) {
  await stat(source);
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    database.exec(`VACUUM INTO ${sqlString(target)}`);
  } finally {
    database.close();
  }

  const snapshot = new DatabaseSync(target, { readOnly: true });
  try {
    const results = snapshot.prepare('PRAGMA integrity_check').all();
    const integrity = results.map((row) => Object.values(row)[0]);
    if (integrity.length !== 1 || integrity[0] !== 'ok') {
      throw new Error(`SQLite integrity check failed for ${path.basename(source)}: ${integrity.join(', ')}`);
    }
    return { integrity: 'ok', bytes: (await stat(target)).size };
  } finally {
    snapshot.close();
  }
}

async function copyDirectory(source, target) {
  try {
    const sourceStat = await stat(source);
    if (!sourceStat.isDirectory()) throw new Error(`${source} is not a directory`);
    await cp(source, target, { recursive: true, preserveTimestamps: true });
    return true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await mkdir(target, { recursive: true });
    return false;
  }
}

async function pruneSnapshots(backupRoot, now, retentionDays) {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const entry of await readdir(backupRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const createdAt = snapshotDate(entry.name);
    if (!createdAt || createdAt.getTime() >= cutoff) continue;
    const target = path.resolve(backupRoot, entry.name);
    if (path.dirname(target) !== backupRoot) throw new Error(`Unsafe retention target: ${target}`);
    await rm(target, { recursive: true });
    removed.push(entry.name);
  }
  return removed;
}

export async function createProductionBackup({ env = process.env, now = new Date() } = {}) {
  const backupRoot = assertSafeBackupRoot(env.ZJUBIO_BACKUP_DIR || '/data/zjubio/backups');
  const retentionDays = Number.parseInt(env.ZJUBIO_BACKUP_RETENTION_DAYS || '14', 10);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
    throw new Error('ZJUBIO_BACKUP_RETENTION_DAYS must be an integer from 1 to 365');
  }

  await mkdir(backupRoot, { recursive: true });
  const snapshotName = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const snapshotDir = path.resolve(backupRoot, snapshotName);
  const temporaryDir = path.resolve(backupRoot, `.${snapshotName}.tmp-${process.pid}`);
  if (path.dirname(snapshotDir) !== backupRoot || path.dirname(temporaryDir) !== backupRoot) {
    throw new Error('Backup snapshot escaped its configured root');
  }

  await mkdir(temporaryDir, { recursive: false });
  try {
    const databases = [];
    for (const item of databaseSources(env)) {
      const name = `${item.labels.join('-')}.sqlite`;
      const result = await snapshotDatabase(item.source, path.join(temporaryDir, name));
      databases.push({ name, labels: item.labels, ...result });
    }

    const contentUploads = resolveProjectPath(env.CONTENT_UPLOAD_DIR || 'server/data/content-uploads');
    const profileAvatars = resolveProjectPath(env.PROFILE_AVATAR_DIR || 'server/data/profile-avatars');
    const copied = {
      uploads: await copyDirectory(contentUploads, path.join(temporaryDir, 'uploads')),
      avatars: await copyDirectory(profileAvatars, path.join(temporaryDir, 'avatars')),
    };
    const manifest = {
      createdAt: now.toISOString(),
      databases,
      copied,
      retentionDays,
    };
    await writeFile(path.join(temporaryDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o640 });
    await rename(temporaryDir, snapshotDir);
    const removedSnapshots = await pruneSnapshots(backupRoot, now, retentionDays);
    return { snapshotDir, databases, copied, removedSnapshots };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await createProductionBackup();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
