/**
 * Upsert a partner metaobject via Admin API.
 * Usage: node scripts/upsert-partner.mjs --email soham@email.com --coupon SOHAM --name Soham --commission 10
 */
import { shopifyGraphql } from '../lib/shopify.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    out[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const shop = process.env.SHOPIFY_SHOP_DOMAIN;
const token = process.env.SHOPIFY_ACCESS_TOKEN;
const type = process.env.PARTNER_METAOBJECT_TYPE || '$app:partner';

if (!shop || !token) {
  console.error('Set SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN');
  process.exit(1);
}

const email = String(args.email || '').trim().toLowerCase();
const coupon = String(args.coupon || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const name = String(args.name || 'Partner').trim();
const commission = String(args.commission || '10');

if (!email || !coupon) {
  console.error('Required: --email and --coupon');
  process.exit(1);
}

const mutation = `
  mutation UpsertPartner($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const handle = coupon.toLowerCase();
const variables = {
  handle: { type, handle },
  metaobject: {
    fields: [
      { key: 'email', value: email },
      { key: 'coupon_code', value: coupon },
      { key: 'display_name', value: name },
      { key: 'commission_percent', value: commission },
      { key: 'status', value: 'active' },
      { key: 'notifications_enabled', value: 'true' }
    ]
  }
};

const data = await shopifyGraphql(shop, token, mutation, variables);
const result = data?.metaobjectUpsert;
if (result?.userErrors?.length) {
  console.error(result.userErrors);
  process.exit(1);
}

console.log('Partner saved:', result?.metaobject?.handle);
