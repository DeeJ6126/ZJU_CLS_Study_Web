// In-memory login brute-force guard.
//
// Tracks per-account consecutive failures and per-IP failure frequency.
// State lives in memory only: a server restart resets counters, which is an
// acceptable trade-off for this phase (the guard limits bursts, it does not
// replace password strength or the verification-code flow).

export function createLoginGuard({
  maxAccountFailures = 5,
  accountLockMs = 15 * 60 * 1000,
  maxIpFailures = 20,
  ipWindowMs = 15 * 60 * 1000,
  // Both maps are keyed by attacker-supplied values (any account name, any
  // forwarded address), so without eviction a stream of failed logins grows
  // them without bound until the process runs out of memory. Entries are
  // dropped once they can no longer affect a decision, and a hard cap bounds
  // the worst case between sweeps.
  maxTrackedEntries = 10_000,
  now = () => Date.now(),
} = {}) {
  const accountEntries = new Map();
  const ipEntries = new Map();

  // An account entry stops mattering once its lock has expired and it has no
  // partial failure count; an ip entry once its window has rolled over.
  function prune(time) {
    for (const [key, entry] of accountEntries) {
      if (entry.lockedUntil <= time && entry.count === 0) accountEntries.delete(key);
    }
    for (const [ip, entry] of ipEntries) {
      if (time - entry.windowStart >= ipWindowMs) ipEntries.delete(ip);
    }
  }

  // Last resort when pruning cannot keep up (every tracked entry still live).
  // Map preserves insertion order, so the oldest entries go first.
  //
  // `isProtected` keeps an attacker from flooding unique keys to evict a
  // locked account entry and thereby lift the lock on a targeted account:
  // protected entries are only dropped once nothing else is left to drop.
  function enforceCap(entries, isProtected = () => false) {
    if (entries.size <= maxTrackedEntries) return;
    for (const [key, entry] of entries) {
      if (entries.size <= maxTrackedEntries) return;
      if (!isProtected(entry)) entries.delete(key);
    }
    for (const key of entries.keys()) {
      if (entries.size <= maxTrackedEntries) return;
      entries.delete(key);
    }
  }

  function check(key, ip) {
    const time = now();
    const account = accountEntries.get(key);
    if (account && account.lockedUntil > time) {
      return { ok: false, status: 429, message: '登录失败次数过多，请 15 分钟后再试。' };
    }
    const ipEntry = ipEntries.get(ip);
    if (
      ipEntry
      && time - ipEntry.windowStart < ipWindowMs
      && ipEntry.count >= maxIpFailures
    ) {
      return { ok: false, status: 429, message: '登录尝试过于频繁，请稍后再试。' };
    }
    return { ok: true };
  }

  function recordFailure(key, ip) {
    const time = now();
    prune(time);

    const account = accountEntries.get(key) ?? { count: 0, lockedUntil: 0 };
    account.count += 1;
    if (account.count >= maxAccountFailures) {
      account.lockedUntil = time + accountLockMs;
      account.count = 0;
    }
    accountEntries.set(key, account);

    const ipEntry = ipEntries.get(ip) ?? { count: 0, windowStart: time };
    if (time - ipEntry.windowStart >= ipWindowMs) {
      ipEntry.count = 0;
      ipEntry.windowStart = time;
    }
    ipEntry.count += 1;
    ipEntries.set(ip, ipEntry);

    enforceCap(accountEntries, (entry) => entry.lockedUntil > time);
    enforceCap(ipEntries, (entry) => entry.count >= maxIpFailures);
  }

  function recordSuccess(key) {
    accountEntries.delete(key);
  }

  return {
    check,
    recordFailure,
    recordSuccess,
    size() {
      return { accounts: accountEntries.size, ips: ipEntries.size };
    },
  };
}

// Normalize a login identity so casing/whitespace variants share one lock
// entry, matching how the auth store normalizes identities.
export function normalizeLoginKey(value, prefix) {
  return `${prefix}:${String(value ?? '').trim().toLowerCase()}`;
}
