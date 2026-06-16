const buckets = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const LOCKOUT_MS = 10 * 60 * 1000;

function keyFor(shop, ip) {
  return `${shop || 'unknown'}:${ip || 'unknown'}`;
}

export function isRateLimited(shop, ip) {
  const key = keyFor(shop, ip);
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry) return false;

  if (entry.lockUntil && now < entry.lockUntil) return true;
  if (entry.lockUntil && now >= entry.lockUntil) {
    buckets.delete(key);
    return false;
  }

  if (now - entry.since > WINDOW_MS) {
    buckets.delete(key);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(shop, ip) {
  const key = keyFor(shop, ip);
  const now = Date.now();
  const entry = buckets.get(key) || { count: 0, since: now };

  if (now - entry.since > WINDOW_MS) {
    entry.count = 0;
    entry.since = now;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockUntil = now + LOCKOUT_MS;
  }

  buckets.set(key, entry);
}

export function clearAttempts(shop, ip) {
  buckets.delete(keyFor(shop, ip));
}
