const API_VERSION = '2025-04';
const DEBUG = process.env.PARTNER_DEBUG === 'true';

export async function shopifyGraphql(shop, accessToken, query, variables = {}) {
  if (DEBUG) {
    console.info('[PARTNER][GRAPHQL][REQUEST]', JSON.stringify({ variables, query }));
  }
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`Shopify API error (${response.status})`);
  }

  const payload = await response.json();
  if (DEBUG) {
    console.info('[PARTNER][GRAPHQL][RESPONSE]', JSON.stringify(payload));
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join('; '));
  }
  return payload.data;
}

export function metaobjectFieldMap(node) {
  const map = Object.create(null);
  if (!node?.fields) return map;
  node.fields.forEach((field) => {
    map[field.key] = field.value;
  });
  return map;
}
