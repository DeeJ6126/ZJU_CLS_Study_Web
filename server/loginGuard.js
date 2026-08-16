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
  now = () => Date.now(),
} = {}) {
  const accountEntries = new Map();
  const ipEntries = new Map();

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
