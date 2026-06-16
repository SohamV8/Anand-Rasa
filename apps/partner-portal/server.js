import express from 'express';
import cookieParser from 'cookie-parser';
import {
  authenticateByCoupon,
  getPartnerAnalytics,
  normalizeCoupon
} from './lib/partners.js';
import { signSession, verifyAppProxy, verifySession } from './lib/crypto.js';
import { clearAttempts, isRateLimited, recordFailedAttempt } from './lib/rate-limit.js';

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || process.env.FRONTEND_PORT || 3000;

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOP_URL = process.env.SHOPIFY_SHOP_URL || `https://${SHOP}`;
const SESSION_COOKIE = 'partner_coupon';
const SESSION_MAX_MS = 24 * 60 * 60 * 1000;
const IDLE_MAX_MS = 30 * 60 * 1000;
const THEME_DEFAULT_COMMISSION = Number.isFinite(parseFloat(process.env.PARTNER_DEFAULT_COMMISSION_PERCENT))
  ? parseFloat(process.env.PARTNER_DEFAULT_COMMISSION_PERCENT)
  : null;

const GENERIC_AUTH_ERROR = 'Coupon not found. Please contact Anand Rasa.';
const LOCKOUT_ERROR = 'Too many attempts. Please try again later.';

/** Storefront /apps/partner-portal/{path} → backend /proxy/{path} (Shopify app proxy convention). */
const PROXY_ROUTES = [
  { method: 'POST', paths: ['/proxy/auth', '/apps/partner-portal/proxy/auth', '/apps/partner-portal/auth'] },
  { method: 'GET', paths: ['/proxy/session', '/apps/partner-portal/proxy/session', '/apps/partner-portal/session'] },
  { method: 'GET', paths: ['/proxy/analytics', '/apps/partner-portal/proxy/analytics', '/apps/partner-portal/analytics'] },
  { method: 'POST', paths: ['/proxy/logout', '/apps/partner-portal/proxy/logout', '/apps/partner-portal/logout'] }
];

app.use((req, res, next) => {
  console.log('[REQUEST]', req.method, req.originalUrl);
  next();
});

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json({ limit: '8kb' }));

function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function requireConfig(_req, res, next) {
  if (!SHOP || !ACCESS_TOKEN || !API_SECRET) {
    return res.status(503).json({
      ok: false,
      error: 'Partner portal is not configured. Please contact Anand Rasa.'
    });
  }
  next();
}

function verifyProxy(req, res, next) {
  if (!verifyAppProxy(req.query, API_SECRET)) {
    return res.status(401).json({ ok: false, error: GENERIC_AUTH_ERROR });
  }
  console.log('[PARTNER] APP PROXY HIT', req.method, req.originalUrl);
  next();
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.json(body);
}

function createSessionToken(coupon, shop) {
  const now = Date.now();
  return signSession(
    {
      coupon,
      shop,
      iat: now,
      exp: now + SESSION_MAX_MS,
      idleExp: now + IDLE_MAX_MS
    },
    API_SECRET
  );
}

function refreshSessionToken(session) {
  const now = Date.now();
  return signSession(
    {
      coupon: session.coupon,
      shop: session.shop,
      iat: session.iat,
      exp: session.exp,
      idleExp: now + IDLE_MAX_MS
    },
    API_SECRET
  );
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/apps/partner-portal',
    maxAge: SESSION_MAX_MS
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/apps/partner-portal'
  });
}

async function resolveSession(req) {
  const token = req.cookies[SESSION_COOKIE];
  const session = verifySession(token, API_SECRET);
  if (!session) return null;
  if (session.shop !== SHOP) return null;
  if (!session.coupon) return null;

  const analytics = await getPartnerAnalytics({
    shop: SHOP,
    accessToken: ACCESS_TOKEN,
    couponSession: session.coupon,
    themeDefaultPercent: THEME_DEFAULT_COMMISSION,
    shopUrl: SHOP_URL
  });
  if (!analytics) return null;
  return { session, analytics };
}

function printMountedRoutes() {
  console.log('[PARTNER] Mounted routes:');
  console.log('  GET  /health');
  PROXY_ROUTES.forEach(({ method, paths }) => {
    paths.forEach((path) => {
      console.log(`  ${method.padEnd(4)} ${path}`);
    });
  });
}

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    time: Date.now(),
    proxy: true
  });
});

async function handleAuth(req, res) {
  const ip = clientIp(req);
  if (isRateLimited(SHOP, ip)) {
    console.log('[PARTNER] RESPONSE SENT', 429, '/auth');
    return json(res, 429, { ok: false, error: LOCKOUT_ERROR });
  }

  const coupon = normalizeCoupon(req.body?.coupon || req.body?.code);
  console.log('[PARTNER] AUTH START', coupon || '(empty)');

  try {
    console.log('[PARTNER] GRAPHQL START discount lookup');
    const partner = await authenticateByCoupon({
      shop: SHOP,
      accessToken: ACCESS_TOKEN,
      coupon,
      themeDefaultPercent: THEME_DEFAULT_COMMISSION
    });

    if (!partner) {
      recordFailedAttempt(SHOP, ip);
      console.log('[PARTNER] RESPONSE SENT', 401, '/auth');
      return json(res, 401, { ok: false, error: GENERIC_AUTH_ERROR });
    }

    clearAttempts(SHOP, ip);
    const token = createSessionToken(partner.coupon, SHOP);
    setSessionCookie(res, token);
    console.log('[PARTNER] SESSION CREATED', partner.coupon);

    console.log('[PARTNER] ANALYTICS START');
    const analytics = await getPartnerAnalytics({
      shop: SHOP,
      accessToken: ACCESS_TOKEN,
      couponSession: partner.coupon,
      themeDefaultPercent: THEME_DEFAULT_COMMISSION,
      shopUrl: SHOP_URL
    });
    if (!analytics) {
      clearSessionCookie(res);
      console.log('[PARTNER] RESPONSE SENT', 401, '/auth');
      return json(res, 401, { ok: false, error: GENERIC_AUTH_ERROR });
    }

    console.log('[PARTNER] RESPONSE SENT', 200, '/auth');
    return json(res, 200, { ok: true, ...analytics });
  } catch (error) {
    console.error('[PARTNER] AUTH ERROR', error?.message || error);
    console.log('[PARTNER] RESPONSE SENT', 500, '/auth');
    return json(res, 500, { ok: false, error: GENERIC_AUTH_ERROR });
  }
}

async function handleSession(req, res) {
  console.log('[PARTNER] SESSION START');
  try {
    const resolved = await resolveSession(req);
    if (!resolved) {
      clearSessionCookie(res);
      console.log('[PARTNER] RESPONSE SENT', 401, '/session');
      return json(res, 401, { ok: false, error: GENERIC_AUTH_ERROR });
    }

    const refreshed = refreshSessionToken(resolved.session);
    setSessionCookie(res, refreshed);

    console.log('[PARTNER] RESPONSE SENT', 200, '/session');
    return json(res, 200, { ok: true, ...resolved.analytics });
  } catch (error) {
    console.error('[PARTNER] SESSION ERROR', error?.message || error);
    console.log('[PARTNER] RESPONSE SENT', 500, '/session');
    return json(res, 500, { ok: false, error: GENERIC_AUTH_ERROR });
  }
}

async function handleAnalytics(req, res) {
  console.log('[PARTNER] ANALYTICS START');
  try {
    const resolved = await resolveSession(req);
    if (!resolved) {
      clearSessionCookie(res);
      console.log('[PARTNER] RESPONSE SENT', 401, '/analytics');
      return json(res, 401, { ok: false, error: GENERIC_AUTH_ERROR });
    }

    const refreshed = refreshSessionToken(resolved.session);
    setSessionCookie(res, refreshed);

    console.log('[PARTNER] RESPONSE SENT', 200, '/analytics');
    return json(res, 200, { ok: true, ...resolved.analytics });
  } catch (error) {
    console.error('[PARTNER] ANALYTICS ERROR', error?.message || error);
    console.log('[PARTNER] RESPONSE SENT', 500, '/analytics');
    return json(res, 500, { ok: false, error: GENERIC_AUTH_ERROR });
  }
}

function handleLogout(_req, res) {
  clearSessionCookie(res);
  console.log('[PARTNER] RESPONSE SENT', 200, '/logout');
  return json(res, 200, { ok: true });
}

const proxyMiddleware = [requireConfig, verifyProxy];

PROXY_ROUTES.forEach(({ method, paths }) => {
  const handler =
    method === 'POST' && paths[0].includes('auth')
      ? handleAuth
      : method === 'POST' && paths[0].includes('logout')
        ? handleLogout
        : paths[0].includes('session')
          ? handleSession
          : handleAnalytics;

  app[method.toLowerCase()](paths, ...proxyMiddleware, handler);
});

app.listen(PORT, () => {
  console.log(`Partner portal proxy listening on :${PORT}`);
  printMountedRoutes();
  console.log('[PARTNER] Storefront path: /apps/partner-portal/* → proxy url + /*');
  console.log('[PARTNER] Config:', {
    shop: SHOP || '(missing)',
    hasToken: Boolean(ACCESS_TOKEN),
    hasSecret: Boolean(API_SECRET)
  });
});
