import { shopifyGraphql } from './shopify.js';

const DISCOUNT_QUERY = `
  query DiscountByCode($code: String!) {
    codeDiscountNodeByCode(code: $code) {
      id
      codeDiscount {
        ... on DiscountCodeBasic {
          title
          status
          asyncUsageCount
          createdAt
          metafields(first: 20) { nodes { namespace key value } }
        }
        ... on DiscountCodeBxgy {
          title
          status
          asyncUsageCount
          createdAt
          metafields(first: 20) { nodes { namespace key value } }
        }
        ... on DiscountCodeFreeShipping {
          title
          status
          asyncUsageCount
          createdAt
          metafields(first: 20) { nodes { namespace key value } }
        }
      }
    }
  }
`;

const ORDERS_QUERY = `
  query PartnerOrders($query: String!, $cursor: String) {
    orders(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          createdAt
          cancelledAt
          displayFinancialStatus
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          discountCodes
          lineItems(first: 50) {
            nodes {
              quantity
            }
          }
        }
      }
    }
  }
`;

const COMMISSION_ELIGIBLE_STATUSES = new Set(['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED']);

function normalizeCoupon(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

function parseNumber(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function thirtyDayStartIso() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29)
  ).toISOString();
}

function titleFromCoupon(coupon) {
  const clean = String(coupon || '').trim().toLowerCase();
  if (!clean) return 'Partner';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function resolveCommissionPercent(discount, themeDefaultPercent) {
  const fields = Array.isArray(discount?.metafields?.nodes) ? discount.metafields.nodes : [];
  const mf = fields.find((item) => {
    const key = String(item?.key || '').toLowerCase();
    const ns = String(item?.namespace || '').toLowerCase();
    return key === 'commission_percent' && (ns === 'partner' || ns === 'custom');
  });
  const fromMetafield = parseNumber(mf?.value, NaN);
  if (Number.isFinite(fromMetafield)) return fromMetafield;
  if (Number.isFinite(themeDefaultPercent)) return themeDefaultPercent;
  return null;
}

async function fetchDiscountByCoupon(shop, accessToken, coupon, themeDefaultPercent) {
  console.info('[PARTNER] DISCOUNT LOOKUP INPUT COUPON:', coupon);
  const data = await shopifyGraphql(shop, accessToken, DISCOUNT_QUERY, { code: coupon });
  const node = data?.codeDiscountNodeByCode;
  const discount = node?.codeDiscount;
  if (!discount) {
    console.info('[PARTNER] DISCOUNT LOOKUP RESULT', JSON.stringify({
      found: 'NO',
      status: null,
      type: null,
      usageCount: null,
      title: null,
      code: coupon
    }));
    return null;
  }
  const status = String(discount.status || '').toUpperCase();
  console.info('[PARTNER] DISCOUNT LOOKUP RESULT', JSON.stringify({
    found: 'YES',
    status,
    type: String(discount.__typename || 'UNKNOWN'),
    usageCount: parseNumber(discount.asyncUsageCount, 0),
    title: discount.title || null,
    code: coupon
  }));
  if (status !== 'ACTIVE') return null;

  return {
    coupon,
    status: 'active',
    usageCount: parseNumber(discount.asyncUsageCount, 0),
    discountType: 'Code',
    title: String(discount.title || coupon),
    createdAt: discount.createdAt || null,
    commissionPercent: resolveCommissionPercent(discount, themeDefaultPercent)
  };
}

function buildDailySeries(dayMap) {
  const start = new Date(thirtyDayStartIso());
  const series = [];

  for (let offset = 0; offset < 30; offset += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + offset);
    const key = day.toISOString().slice(0, 10);
    const bucket = dayMap.get(key) || { orders: 0, revenue: 0, commission: 0 };

    series.push({
      date: key,
      orders: bucket.orders,
      revenue: bucket.revenue,
      commission: bucket.commission
    });
  }

  return series;
}

async function aggregateOrders(shop, accessToken, coupon, commissionPercent) {
  const query = `discount_code:${coupon}`;
  const monthStart = monthStartIso();
  const thirtyDayStart = thirtyDayStartIso();
  let cursor = null;
  let guard = 0;

  const summary = {
    ordersUsingCoupon: 0,
    totalRevenueGenerated: 0,
    commissionEarned: 0,
    highestOrder: 0,
    totalItemsPurchased: 0,
    lastCouponUseAt: null,
    currencyCode: 'INR'
  };
  const monthly = { ordersUsingCoupon: 0, salesAmount: 0, commissionEarned: 0 };
  const dayMap = new Map();

  while (guard < 30) {
    guard += 1;
    const data = await shopifyGraphql(shop, accessToken, ORDERS_QUERY, { query, cursor });
    const batch = data?.orders;
    if (!batch?.edges?.length) break;

    batch.edges.forEach(({ node }) => {
      if (node.cancelledAt) return;

      const codes = (node.discountCodes || []).map((code) => normalizeCoupon(code));
      if (!codes.includes(coupon)) return;

      const amount = parseNumber(node.currentTotalPriceSet?.shopMoney?.amount);
      const currencyCode = String(
        node.currentTotalPriceSet?.shopMoney?.currencyCode || summary.currencyCode
      );
      const status = String(node.displayFinancialStatus || 'PENDING').toUpperCase();
      const commission = COMMISSION_ELIGIBLE_STATUSES.has(status) && commissionPercent != null
        ? amount * (commissionPercent / 100)
        : null;
      const createdAt = String(node.createdAt || '');
      const dayKey = createdAt.slice(0, 10);
      const monthKey = createdAt.slice(0, 7);
      const quantity = Array.isArray(node.lineItems?.nodes)
        ? node.lineItems.nodes.reduce((sum, line) => sum + parseNumber(line.quantity), 0)
        : 0;

      summary.currencyCode = currencyCode;
      summary.ordersUsingCoupon += 1;
      summary.totalRevenueGenerated += amount;
      if (commission != null) summary.commissionEarned += commission;
      summary.totalItemsPurchased += quantity;

      if (amount > summary.highestOrder) {
        summary.highestOrder = amount;
      }

      if (!summary.lastCouponUseAt || createdAt > summary.lastCouponUseAt) {
        summary.lastCouponUseAt = createdAt;
      }

      if (createdAt >= monthStart) {
        monthly.ordersUsingCoupon += 1;
        monthly.salesAmount += amount;
        if (commission != null) monthly.commissionEarned += commission;
      }

      if (createdAt >= thirtyDayStart) {
        const dayBucket = dayMap.get(dayKey) || { orders: 0, revenue: 0, commission: 0 };
        dayBucket.orders += 1;
        dayBucket.revenue += amount;
        if (commission != null) dayBucket.commission += commission;
        dayMap.set(dayKey, dayBucket);
      }
    });

    if (!batch.pageInfo?.hasNextPage) break;
    cursor = batch.pageInfo.endCursor;
  }

  const averageOrderValue = summary.ordersUsingCoupon
    ? summary.totalRevenueGenerated / summary.ordersUsingCoupon
    : 0;
  const daily30 = buildDailySeries(dayMap);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const lastWeekOrders = daily30.slice(-7).reduce((sum, item) => sum + item.orders, 0);
  const lastWeekRevenue = daily30.slice(-7).reduce((sum, item) => sum + item.revenue, 0);
  const lastWeekCommissionRaw = daily30.slice(-7).reduce((sum, item) => sum + item.commission, 0);
  const todayBucket = dayMap.get(todayKey) || { orders: 0, revenue: 0, commission: 0 };
  const yesterdayBucket = dayMap.get(yesterdayKey) || { orders: 0, revenue: 0, commission: 0 };
  const commissionConfigured = commissionPercent != null;

  return {
    summary: {
      ...summary,
      averageOrderValue,
      thisMonthSales: monthly.salesAmount,
      lifetimeSales: summary.totalRevenueGenerated,
      commissionEarned: commissionConfigured ? summary.commissionEarned : null
    },
    monthly,
    analytics: {
      daily30,
      has30DayData: daily30.some((point) => point.orders > 0),
      hasMonthlyData: false,
      activity: {
        today: {
          orders: todayBucket.orders,
          revenue: todayBucket.revenue,
          commission: commissionConfigured ? todayBucket.commission : null
        },
        yesterday: {
          orders: yesterdayBucket.orders,
          revenue: yesterdayBucket.revenue,
          commission: commissionConfigured ? yesterdayBucket.commission : null
        },
        lastWeek: {
          orders: lastWeekOrders,
          revenue: lastWeekRevenue,
          commission: commissionConfigured ? lastWeekCommissionRaw : null
        }
      }
    }
  };
}

export async function authenticateByCoupon({ shop, accessToken, coupon, themeDefaultPercent }) {
  const normalizedCoupon = normalizeCoupon(coupon);
  if (!normalizedCoupon) return null;
  return fetchDiscountByCoupon(shop, accessToken, normalizedCoupon, themeDefaultPercent);
}

export async function getPartnerAnalytics({
  shop,
  accessToken,
  couponSession,
  themeDefaultPercent,
  shopUrl
}) {
  const discount = await fetchDiscountByCoupon(shop, accessToken, couponSession, themeDefaultPercent);
  if (!discount) return null;
  const live = await aggregateOrders(shop, accessToken, discount.coupon, discount.commissionPercent);
  console.info('[PARTNER] ORDERS AGGREGATE', JSON.stringify({
    coupon: discount.coupon,
    ordersFound: live.summary.ordersUsingCoupon,
    revenue: live.summary.totalRevenueGenerated,
    averageOrderValue: live.summary.averageOrderValue,
    highestOrder: live.summary.highestOrder,
    lastUse: live.summary.lastCouponUseAt
  }));
  const referralUrl = `${String(shopUrl || '').replace(/\/$/, '')}/?ref=${encodeURIComponent(discount.coupon)}`;

  return {
    partner: {
      name: titleFromCoupon(discount.coupon),
      status: 'Active',
      coupon: discount.coupon,
      commissionPercent: discount.commissionPercent,
      partnerSince: discount.createdAt
    },
    discount: {
      code: discount.coupon,
      status: 'ACTIVE',
      usageCount: discount.usageCount,
      type: discount.discountType,
      title: discount.title,
      createdAt: discount.createdAt
    },
    summary: live.summary,
    monthly: live.monthly,
    commission: {
      ratePercent: discount.commissionPercent,
      totalEarned: live.summary.commissionEarned,
      pendingPayout: null,
      paidOut: null,
      nextPayoutAt: null
    },
    recentOrders: [],
    analytics: live.analytics,
    referralUrl
  };
}

export { normalizeCoupon };
