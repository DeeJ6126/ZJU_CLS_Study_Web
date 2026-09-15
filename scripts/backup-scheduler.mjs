import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createProductionBackup } from './backup-production-data.mjs';

const DEFAULT_HOUR = 3;
const DEFAULT_MINUTE = 20;
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

export function nextRunAt(now = new Date(), hour = DEFAULT_HOUR, minute = DEFAULT_MINUTE) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('Backup hour must be from 0 to 23');
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error('Backup minute must be from 0 to 59');
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function writeEvent(stream, event, details = {}) {
  stream.write(`${JSON.stringify({ timestamp: new Date().toISOString(), event, ...details })}\n`);
}

export function startBackupScheduler({ env = process.env, now = () => new Date(), setTimer = setTimeout, backup = createProductionBackup } = {}) {
  const hour = Number.parseInt(env.ZJUBIO_BACKUP_HOUR || String(DEFAULT_HOUR), 10);
  const minute = Number.parseInt(env.ZJUBIO_BACKUP_MINUTE || String(DEFAULT_MINUTE), 10);
  const schedule = () => {
    const current = now();
    const next = nextRunAt(current, hour, minute);
    const delay = Math.min(next.getTime() - current.getTime(), MAX_TIMER_DELAY_MS);
    writeEvent(process.stdout, 'backup_scheduled', { nextRunAt: next.toISOString() });
    const timer = setTimer(async () => {
      try {
        const result = await backup({ env, now: now() });
        writeEvent(process.stdout, 'backup_completed', { snapshotDir: result.snapshotDir, databases: result.databases.length, removedSnapshots: result.removedSnapshots.length });
      } catch (error) {
        writeEvent(process.stderr, 'backup_failed', { message: error instanceof Error ? error.message : String(error) });
      } finally {
        schedule();
      }
    }, delay);
    return { next, timer };
  };
  return schedule();
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  startBackupScheduler();
}
