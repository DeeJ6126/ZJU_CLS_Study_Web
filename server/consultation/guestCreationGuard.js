import { createHmac, randomBytes } from 'node:crypto';

export function createGuestCreationGuard({
  maxCreates = 60,
  windowMs = 10 * 60 * 1000,
  maxTrackedIps = 5000,
} = {}) {
  const secret = randomBytes(32);
  const entries = new Map();

  return {
    checkAndRecord(ip, now = Date.now()) {
      const key = createHmac('sha256', secret).update(String(ip || 'unknown')).digest('hex');
      for (const [candidate, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(candidate);
      }
      const entry = entries.get(key) ?? { count: 0, resetAt: now + windowMs };
      if (entry.count >= maxCreates) return false;
      entry.count += 1;
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > maxTrackedIps) entries.delete(entries.keys().next().value);
      return true;
    },
  };
}
