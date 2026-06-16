/**
 * Production Shopify configuration checklist for Partner Portal.
 * Usage: node scripts/verify-shopify-config.mjs [--coupon SOHAM]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUPON = (process.argv.find((a, i) => process.argv[i - 1] === '--coupon') || 'SOHAM').toUpperCase();

const shop = process.env.SHOPIFY_SHOP_DOMAIN;
const token = process.env.SHOPIFY_ACCESS_TOKEN;
const secret = process.env.SHOPIFY_API_SECRET;
const shopUrl = process.env.SHOPIFY_SHOP_URL || (shop ? `https://${shop}` : '');
const API_VERSION = '2025-04';

function fail(msg) {
  console.log(`  ✗ ${msg}`);
  return false;
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
  return true;
}

function readTomlProxy() {
  try {
    const raw = readFileSync(join(__dirname, '..', 'shopify.app.toml'), 'utf8');
    const prefix = raw.match(/^prefix\s*=\s*"([^"]+)"/m)?.[1];
    const subpath = raw.match(/^subpath\s*=\s*"([^"]+)"/m)?.[1];
    const url = raw.match(/^url\s*=\s*"([^"]+)"/m)?.[1];
    const scopes = raw.match(/^scopes\s*=\s*"([^"]+)"/m)?.[1]?.split(',').map((s) => s.trim()) || [];
    return { prefix, subpath, url, scopes };
  } catch {
    return null;
  }
}

async function graphql(query, variables = {}) {
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join('; '));
  }
  return payload.data;
}

async function testProxy() {
  const bases = [
    shopUrl.replace(/\/$/, ''),
    shop ? `https://${shop}` : '',
    'https://www.anandrasa.com',
    'https://anand-rasa-3.myshopify.com'
  ].filter(Boolean);
  const seen = new Set();
  for (const base of bases) {
    if (seen.has(base)) continue;
    seen.add(base);
    const storefront = `${base}/apps/partner-portal/session`;
    try {
      const res = await fetch(storefront, { method: 'GET', redirect: 'follow' });
      if (res.status === 404) {
        console.log(`    ${storefront} → 404`);
        continue;
      }
      const backendHit = res.status !== 404;
      return {
        ok: backendHit,
        status: res.status,
        detail: `${storefront} → HTTP ${res.status}`
      };
    } catch (e) {
      console.log(`    ${storefront} → ${e.message}`);
    }
  }
  return { ok: false, status: 404, detail: 'All storefront proxy URLs returned 404' };
}

const report = {
  discountExists: null,
  discountActive: null,
  codeMatches: null,
  discountExpired: null,
  appInstalled: null,
  scopesOk: null,
  tokenValid: null,
  graphqlWorking: null,
  ordersReturned: null,
  revenueReturned: null,
  proxyWorking: null,
  dashboardWorking: null
};

console.log('\n=== Anand Rasa Partner Portal — Shopify Production Checklist ===\n');

// 1–4, 7–8: require credentials
console.log('1–4, 7–8. Discount + Admin API');
if (!shop || !token) {
  fail(`Missing env: SHOPIFY_SHOP_DOMAIN=${shop || '(empty)'}, SHOPIFY_ACCESS_TOKEN=${token ? 'set' : '(empty)'}`);
  console.log('  → Copy .env.example to .env and fill credentials, or run:');
  console.log('    shopify store auth --store anand-rasa-3.myshopify.com --scopes read_discounts,read_orders');
} else {
  try {
    const shopData = await graphql(`query { shop { name myshopifyDomain } }`);
    pass(`Access token valid — shop: ${shopData.shop.name} (${shopData.shop.myshopifyDomain})`);
    report.tokenValid = true;
    report.graphqlWorking = true;

    const discountData = await graphql(
      `query($code: String!) {
        codeDiscountNodeByCode(code: $code) {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title status asyncUsageCount createdAt endsAt startsAt
              codes(first: 5) { nodes { code } }
            }
            ... on DiscountCodeBxgy {
              title status asyncUsageCount createdAt endsAt startsAt
              codes(first: 5) { nodes { code } }
            }
            ... on DiscountCodeFreeShipping {
              title status asyncUsageCount createdAt endsAt startsAt
              codes(first: 5) { nodes { code } }
            }
          }
        }
      }`,
      { code: COUPON }
    );

    const node = discountData?.codeDiscountNodeByCode;
    const discount = node?.codeDiscount;
    if (!discount) {
      fail(`Discount code "${COUPON}" not found in Admin API`);
      report.discountExists = false;
    } else {
      report.discountExists = true;
      pass(`Discount exists — title: "${discount.title}", status: ${discount.status}`);
      report.discountActive = String(discount.status).toUpperCase() === 'ACTIVE';
      if (report.discountActive) pass('Discount is ACTIVE');
      else fail(`Discount status is ${discount.status} (must be ACTIVE)`);

      const codes = (discount.codes?.nodes || []).map((n) => String(n.code || '').toUpperCase());
      const normalized = COUPON.replace(/[^A-Z0-9]/g, '');
      report.codeMatches = codes.includes(normalized) || codes.includes(COUPON);
      if (report.codeMatches) pass(`Code matches input — registered codes: ${codes.join(', ') || COUPON}`);
      else fail(`Code mismatch — registered: [${codes.join(', ')}], input: ${COUPON}`);

      const now = Date.now();
      const endsAt = discount.endsAt ? Date.parse(discount.endsAt) : null;
      report.discountExpired = endsAt != null && endsAt < now;
      if (report.discountExpired) fail(`Discount expired at ${discount.endsAt}`);
      else pass(discount.endsAt ? `Not expired (ends ${discount.endsAt})` : 'No end date set');

      pass(`Usage count: ${discount.asyncUsageCount ?? 0}`);

      const ordersData = await graphql(
        `query($query: String!) {
          orders(first: 10, query: $query, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                name
                createdAt
                displayFinancialStatus
                currentTotalPriceSet { shopMoney { amount currencyCode } }
                discountCodes
              }
            }
          }
        }`,
        { query: `discount_code:${COUPON}` }
      );

      const orders = ordersData?.orders?.edges || [];
      report.ordersReturned = orders.length > 0;
      const revenue = orders.reduce((sum, { node }) => {
        return sum + parseFloat(node.currentTotalPriceSet?.shopMoney?.amount || 0);
      }, 0);
      report.revenueReturned = revenue > 0;

      if (orders.length) {
        pass(`Orders with ${COUPON}: ${orders.length} (sample revenue ₹${revenue.toFixed(2)})`);
        orders.slice(0, 3).forEach(({ node }) => {
          console.log(`    - ${node.name} ${node.createdAt} ₹${node.currentTotalPriceSet?.shopMoney?.amount}`);
        });
      } else {
        fail(`No orders found with discount_code:${COUPON}`);
      }
    }
  } catch (e) {
    fail(`GraphQL error: ${e.message}`);
    report.tokenValid = false;
    report.graphqlWorking = false;
  }
}

// 5–6: scopes from toml
console.log('\n5–6. App scopes (shopify.app.toml)');
const toml = readTomlProxy();
if (!toml) {
  fail('Could not read shopify.app.toml');
} else {
  const required = ['read_discounts', 'read_orders'];
  const missing = required.filter((s) => !toml.scopes.includes(s));
  report.scopesOk = missing.length === 0;
  if (missing.length) fail(`Missing scopes in toml: ${missing.join(', ')}`);
  else pass(`Scopes include: ${required.join(', ')} (full: ${toml.scopes.join(', ')})`);
}

console.log('\n5. App installed');
if (!secret) {
  fail('SHOPIFY_API_SECRET not set — cannot verify app install or proxy HMAC');
  report.appInstalled = null;
} else {
  pass('SHOPIFY_API_SECRET set (app credentials present)');
  report.appInstalled = null; // needs Admin UI or app query
}

// 9. App proxy
console.log('\n9. App Proxy configuration');
if (toml) {
  pass(`prefix=${toml.prefix}, subpath=${toml.subpath}, url=${toml.url}`);
  pass(`Storefront path: /${toml.prefix}/${toml.subpath}/*`);
}
const proxy = await testProxy();
report.proxyWorking = proxy.ok;
if (proxy.ok) pass(`Storefront proxy reachable — ${proxy.detail}`);
else fail(`Storefront proxy — ${proxy.detail}`);

// 11–14: manual
console.log('\n11–14. Test order + dashboard (manual)');
console.log('  → Create a test order with code SOHAM at checkout');
console.log('  → Re-run this script to confirm usageCount and orders increase');
console.log('  → Log in at /pages/partner?view=partner with coupon SOHAM after proxy works');

report.dashboardWorking = report.proxyWorking && report.graphqlWorking && report.discountActive;

console.log('\n=== Summary ===');
const rows = [
  ['Discount exists?', report.discountExists],
  ['Active?', report.discountActive],
  ['GraphQL working?', report.graphqlWorking],
  ['Orders returned?', report.ordersReturned],
  ['Revenue returned?', report.revenueReturned],
  ['Proxy working?', report.proxyWorking],
  ['Dashboard working?', report.dashboardWorking]
];
rows.forEach(([label, val]) => {
  const icon = val === true ? '✓' : val === false ? '✗' : '?';
  console.log(`  ${icon} ${label} ${val === null ? '(not tested)' : val}`);
});
console.log('');
