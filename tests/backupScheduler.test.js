import test from 'node:test';
import assert from 'node:assert/strict';

import { nextRunAt, startBackupScheduler } from '../scripts/backup-scheduler.mjs';

test('backup scheduler chooses the next local 03:20 occurrence', () => {
  assert.equal(nextRunAt(new Date('2026-09-15T02:00:00+08:00')).toISOString(), new Date('2026-09-15T03:20:00+08:00').toISOString());
  assert.equal(nextRunAt(new Date('2026-09-15T04:00:00+08:00')).toISOString(), new Date('2026-09-16T03:20:00+08:00').toISOString());
});

test('backup scheduler arms one timer without running the backup immediately', () => {
  const timers = [];
  let backupRuns = 0;
  const current = new Date('2026-09-15T02:00:00+08:00');
  const result = startBackupScheduler({
    env: {},
    now: () => current,
    setTimer(callback, delay) {
      timers.push({ callback, delay });
      return { unref() {} };
    },
    backup: async () => { backupRuns += 1; },
  });
  assert.equal(result.next.toISOString(), new Date('2026-09-15T03:20:00+08:00').toISOString());
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 80 * 60 * 1000);
  assert.equal(backupRuns, 0);
});
