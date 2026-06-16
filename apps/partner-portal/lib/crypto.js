import crypto from 'crypto';

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function signSession(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    if (typeof payload.idleExp !== 'number' || Date.now() > payload.idleExp) return null;
    if (!payload.coupon || !payload.shop) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyAppProxy(query, secret) {
  if (!query || !secret) return false;
  const signature = query.signature;
  if (!signature) return false;

  const timestamp = parseInt(query.timestamp, 10);
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = Math.abs(Date.now() - timestamp * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  const pairs = Object.keys(query)
    .filter((key) => key !== 'signature')
    .sort()
    .map((key) => `${key}=${Array.isArray(query[key]) ? query[key].join(',') : query[key]}`);

  const message = pairs.join('');
  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return timingSafeEqual(digest, signature);
}
