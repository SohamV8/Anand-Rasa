/**
 * Anand Rasa Partner Portal
 * Secure login + Shopify-backed analytics only.
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LOAD_MS = REDUCED ? 0 : 220;
  var GENERIC_ERROR = 'Coupon not found. Please contact Anand Rasa.';
  var LOCKOUT_ERROR = 'Too many attempts. Please try again later.';
  var CODE_RE = /^[A-Z0-9]{4,32}$/;
  var currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });
  var numberFormatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  });
  var dateFormatter = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  var monthFormatter = new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: '2-digit'
  });

  function apiBase(root) {
    return (root.getAttribute('data-api-base') || '/apps/partner-portal').replace(/\/$/, '');
  }

  function sanitizeCode(raw) {
    if (typeof raw !== 'string') return '';
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
  }

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value) || 0);
  }

  function formatNumber(value) {
    return numberFormatter.format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return '—';

    try {
      return dateFormatter.format(new Date(value));
    } catch (_error) {
      return '—';
    }
  }

  function formatMonth(value) {
    if (!value) return '';

    try {
      return monthFormatter.format(new Date(value + '-01T00:00:00Z'));
    } catch (_error) {
      return value;
    }
  }

  function humanizeStatus(value) {
    var text = String(value || '').trim();
    if (!text) return 'Pending';

    return text
      .toLowerCase()
      .split('_')
      .map(function (part) {
        return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
      })
      .join(' ');
  }

  function formatPercent(value) {
    var num = Number(value);
    if (!isFinite(num)) return '—';
    return (Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '')) + '%';
  }

  function setText(root, selector, text) {
    var el = root.querySelector(selector);
    if (el) el.textContent = text;
  }

  function setHidden(root, selector, hidden) {
    var el = root.querySelector(selector);
    if (el) el.hidden = !!hidden;
  }

  function setHiddenAll(root, selector, hidden) {
    root.querySelectorAll(selector).forEach(function (el) {
      el.hidden = !!hidden;
    });
  }

  function apiRequest(root, path, options) {
    var url = apiBase(root) + path;
    var opts = options || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});

    return fetch(url, opts).then(function (res) {
      return res
        .json()
        .catch(function () {
          return { ok: false, error: GENERIC_ERROR };
        })
        .then(function (body) {
          return { status: res.status, body: body };
        });
    });
  }

  function toast(root, msg, check) {
    var el = root.querySelector('.js-ar-partner-toast');
    var text = root.querySelector('.js-ar-partner-toast-text');
    if (!el || !text) return;

    text.textContent = msg;
    el.hidden = false;
    el.classList.toggle('ar-partner-toast--check', !!check);
    el.classList.add('ar-partner-toast--in');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      el.classList.remove('ar-partner-toast--in', 'ar-partner-toast--check');
      setTimeout(function () {
        el.hidden = true;
      }, 240);
    }, 2200);
  }

  function flashBtn(btn) {
    if (!btn) return;

    btn.classList.add('ar-partner-btn--success');
    setTimeout(function () {
      btn.classList.remove('ar-partner-btn--success');
    }, 1000);
  }

  function fallbackCopy(text, root, btn, label) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();

    try {
      document.execCommand('copy');
      toast(root, label || 'Copied', true);
      flashBtn(btn);
    } catch (_error) {
      toast(root, 'Please copy manually');
    }

    document.body.removeChild(ta);
  }

  function copyText(text, root, btn, label) {
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          toast(root, label || 'Copied', true);
          flashBtn(btn);
        })
        .catch(function () {
          fallbackCopy(text, root, btn, label);
        });
      return;
    }

    fallbackCopy(text, root, btn, label);
  }

  function setMetric(root, key, valueText, noteText, isEmpty) {
    var valueEl = root.querySelector('[data-metric="' + key + '"]');
    var noteEl = root.querySelector('[data-metric-note="' + key + '"]');

    if (valueEl) {
      valueEl.textContent = valueText;
      valueEl.classList.toggle('is-empty', !!isEmpty);
    }

    if (noteEl) {
      noteEl.textContent = noteText || '';
      noteEl.hidden = !noteText;
    }
  }

  function setActivity(root, key, text) {
    var el = root.querySelector('[data-activity="' + key + '"]');
    if (el) el.textContent = text;
  }

  function showLoading(root) {
    var skeleton = root.querySelector('.js-ar-partner-skeleton');
    var content = root.querySelector('.js-ar-partner-content');

    if (skeleton) skeleton.hidden = false;
    if (content) content.hidden = true;
  }

  function showContent(root) {
    var skeleton = root.querySelector('.js-ar-partner-skeleton');
    var content = root.querySelector('.js-ar-partner-content');

    if (skeleton) skeleton.hidden = true;
    if (content) content.hidden = false;
  }

  function buildShareMessage(root) {
    var data = root._data || {};
    var partner = data.partner || {};
    var referral = root._referral || '';

    if (!partner.coupon && !referral) return '';

    return 'Shop Anand Rasa with my coupon ' + (partner.coupon || '') + '. ' + referral;
  }

  function setShareLinks(root, coupon, referral) {
    var whatsapp = root.querySelector('.js-ar-partner-whatsapp');
    var facebook = root.querySelector('.js-ar-partner-share-fb');
    var num = (root.getAttribute('data-whatsapp') || '').replace(/[^0-9]/g, '');
    var message = 'Shop Anand Rasa with my coupon ' + coupon + '. ' + referral;

    if (whatsapp) {
      if (num) {
        whatsapp.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(message);
        whatsapp.hidden = false;
      } else {
        whatsapp.hidden = true;
      }
    }

    if (facebook) {
      facebook.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(referral);
    }
  }

  function renderOrders(root, orders) {
    var tableWrap = root.querySelector('.js-ar-partner-orders-table-wrap');
    var body = root.querySelector('.js-ar-partner-orders-body');
    var empty = root.querySelector('.js-ar-partner-orders-empty');

    if (!body || !tableWrap || !empty) return;
    body.textContent = '';

    if (!orders || !orders.length) {
      tableWrap.hidden = true;
      empty.hidden = false;
      return;
    }

    tableWrap.hidden = false;
    empty.hidden = true;

    orders.forEach(function (order) {
      var tr = document.createElement('tr');
      var date = document.createElement('td');
      var amount = document.createElement('td');
      var commission = document.createElement('td');
      var status = document.createElement('td');

      date.textContent = formatDate(order.date);
      amount.textContent = formatCurrency(order.amount);
      commission.textContent = Number(order.commission) > 0 ? formatCurrency(order.commission) : 'Not earned yet';
      status.textContent = humanizeStatus(order.status);

      tr.appendChild(date);
      tr.appendChild(amount);
      tr.appendChild(commission);
      tr.appendChild(status);
      body.appendChild(tr);
    });
  }

  function renderCommission(root, partner, commission) {
    var rate = partner.commissionPercent != null ? partner.commissionPercent : commission.ratePercent;
    var hasRate = rate != null && isFinite(Number(rate));
    setText(
      root,
      '.js-ar-partner-commission-rate',
      hasRate ? formatPercent(rate) : '—'
    );
    setText(
      root,
      '.js-ar-partner-commission-total',
      hasRate
        ? (Number(commission.totalEarned) > 0 ? formatCurrency(commission.totalEarned) : 'No commission yet.')
        : 'Commission setup pending.'
    );

    setText(root, '.js-ar-partner-commission-pending', commission.pendingPayout != null ? formatCurrency(commission.pendingPayout) : '—');
    setText(root, '.js-ar-partner-commission-paid', commission.paidOut != null ? formatCurrency(commission.paidOut) : '—');
    setText(root, '.js-ar-partner-commission-next', commission.nextPayoutAt ? formatDate(commission.nextPayoutAt) : '—');

    var hasPayoutData = !(
      commission.pendingPayout == null &&
      commission.paidOut == null &&
      !commission.nextPayoutAt
    );
    setHiddenAll(root, '.js-ar-partner-payout-row', !hasPayoutData);
    setHidden(root, '.js-ar-partner-payout-note', !hasPayoutData);
  }

  function barChartMarkup(series, valueKey, color, labelFn, valueFormatter, ariaLabel) {
    var width = 360;
    var height = 150;
    var chartHeight = 102;
    var paddingTop = 12;
    var paddingX = 10;
    var gap = series.length > 10 ? 3 : 8;
    var count = Math.max(series.length, 1);
    var barWidth = Math.max(6, (width - paddingX * 2 - gap * (count - 1)) / count);
    var values = series.map(function (item) {
      return Number(item[valueKey]) || 0;
    });
    var max = Math.max.apply(null, values.concat([1]));
    var bars = '';
    var peak = 0;

    series.forEach(function (item, index) {
      var value = Number(item[valueKey]) || 0;
      var scaled = value > 0 ? (value / max) * chartHeight : 2;
      var x = paddingX + index * (barWidth + gap);
      var y = paddingTop + (chartHeight - scaled);
      var safeLabel = String(labelFn(item)).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

      if (value > peak) peak = value;

      bars +=
        '<rect x="' +
        x.toFixed(2) +
        '" y="' +
        y.toFixed(2) +
        '" width="' +
        barWidth.toFixed(2) +
        '" height="' +
        scaled.toFixed(2) +
        '" rx="6" fill="' +
        color +
        '">' +
        '<title>' +
        safeLabel +
        ': ' +
        valueFormatter(value).replace(/&/g, '&amp;') +
        '</title></rect>';
    });

    return (
      '<div class="ar-partner-chart__svg-wrap">' +
      '<svg viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '" role="img" aria-label="' +
      ariaLabel.replace(/&/g, '&amp;').replace(/"/g, '&quot;') +
      '">' +
      '<line x1="' +
      paddingX +
      '" y1="' +
      (paddingTop + chartHeight + 6) +
      '" x2="' +
      (width - paddingX) +
      '" y2="' +
      (paddingTop + chartHeight + 6) +
      '" stroke="rgba(18,16,14,0.12)" stroke-width="1" />' +
      bars +
      '</svg>' +
      '</div>' +
      '<div class="ar-partner-chart__footer">' +
      '<span>' +
      labelFn(series[0]) +
      '</span>' +
      '<strong>Peak ' +
      valueFormatter(peak) +
      '</strong>' +
      '<span>' +
      labelFn(series[series.length - 1]) +
      '</span>' +
      '</div>'
    );
  }

  function setChartHidden(root, chartKey, hidden) {
    var card = root.querySelector('.js-ar-partner-chart[data-chart="' + chartKey + '"]');
    if (card) card.hidden = !!hidden;
  }

  function renderCharts(root) {
    var data = root._data || {};
    var analytics = data.analytics || {};
    var usageCanvas = root.querySelector('[data-chart-canvas="usage30"]');
    var revenueCanvas = root.querySelector('[data-chart-canvas="revenue30"]');
    var monthlyCanvas = root.querySelector('[data-chart-canvas="monthlyRevenue"]');
    var showUsage = !!analytics.has30DayData;
    var showMonthly = !!analytics.hasMonthlyData;

    setChartHidden(root, 'usage30', !showUsage);
    setChartHidden(root, 'revenue30', !showUsage);
    setChartHidden(root, 'monthlyRevenue', !showMonthly);

    if (showUsage && usageCanvas) {
      usageCanvas.innerHTML = barChartMarkup(
        analytics.daily30,
        'orders',
        '#c9a96e',
        function (item) {
          return formatDate(item.date);
        },
        function (value) {
          return formatNumber(value) + ' orders';
        },
        'Coupon usage trend for the last 30 days'
      );
    } else if (usageCanvas) {
      usageCanvas.innerHTML = '';
    }

    if (showUsage && revenueCanvas) {
      revenueCanvas.innerHTML = barChartMarkup(
        analytics.daily30,
        'revenue',
        '#12100e',
        function (item) {
          return formatDate(item.date);
        },
        function (value) {
          return formatCurrency(value);
        },
        'Revenue trend for the last 30 days'
      );
    } else if (revenueCanvas) {
      revenueCanvas.innerHTML = '';
    }

    if (showMonthly && monthlyCanvas) {
      monthlyCanvas.innerHTML = barChartMarkup(
        analytics.monthly,
        'revenue',
        '#8f7448',
        function (item) {
          return formatMonth(item.month);
        },
        function (value) {
          return formatCurrency(value);
        },
        'Monthly revenue graph'
      );
    } else if (monthlyCanvas) {
      monthlyCanvas.innerHTML = '';
    }

    root._chartsRendered = true;
  }

  function queueChartRender(root) {
    var analytics = (root._data && root._data.analytics) || {};
    var section = root.querySelector('.js-ar-partner-analytics');

    if (!section || section.hidden || (!analytics.has30DayData && !analytics.hasMonthlyData)) {
      return;
    }

    if (root._chartObserver) {
      root._chartObserver.disconnect();
      root._chartObserver = null;
    }

    if (REDUCED || !('IntersectionObserver' in window)) {
      renderCharts(root);
      return;
    }

    root._chartObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          renderCharts(root);
          if (root._chartObserver) {
            root._chartObserver.disconnect();
            root._chartObserver = null;
          }
        });
      },
      { rootMargin: '120px 0px' }
    );

    root._chartObserver.observe(section);
  }

  function renderAnalytics(root, analytics) {
    var section = root.querySelector('.js-ar-partner-analytics');
    var hasData = !!(analytics && (analytics.has30DayData || analytics.hasMonthlyData));

    if (!section) return;

    section.hidden = !hasData;
    if (!hasData) {
      root._chartsRendered = false;
      return;
    }

    root._chartsRendered = false;
    queueChartRender(root);
  }

  function resetDashboard(root) {
    var body = root.querySelector('.js-ar-partner-orders-body');

    setText(root, '.js-ar-partner-name', 'Partner');
    setText(root, '.js-ar-partner-since', '—');
    setText(root, '.js-ar-partner-status-text', 'Unknown');
    setText(root, '.js-ar-partner-coupon-hero', '');
    setText(root, '.js-ar-partner-coupon-card', '—');
    setText(root, '.js-ar-partner-referral-url', '—');

    setMetric(root, 'ordersUsingCoupon', '—', '', true);
    setMetric(root, 'totalRevenueGenerated', '—', '', true);
    setMetric(root, 'commissionEarned', '—', '', true);
    setMetric(root, 'averageOrderValue', '—', '', true);
    setMetric(root, 'lastCouponUseAt', '—', '', true);
    setMetric(root, 'highestOrder', '—', '', true);
    setMetric(root, 'thisMonthSales', '—', '', true);
    setMetric(root, 'lifetimeSales', '—', '', true);

    setText(root, '.js-ar-partner-commission-rate', '—');
    setText(root, '.js-ar-partner-commission-total', '—');
    setText(root, '.js-ar-partner-commission-pending', '—');
    setText(root, '.js-ar-partner-commission-paid', '—');
    setText(root, '.js-ar-partner-commission-next', '—');
    setHidden(root, '.js-ar-partner-payout-note', true);
    setHiddenAll(root, '.js-ar-partner-payout-row', true);

    if (body) body.textContent = '';
    setHidden(root, '.js-ar-partner-orders-table-wrap', true);
    setHidden(root, '.js-ar-partner-orders-empty', true);
    setActivity(root, 'todayRevenue', formatCurrency(0));
    setActivity(root, 'todayCommission', 'Commission setup pending.');
    setActivity(root, 'todayOrders', 'Coupon used 0 times');
    setActivity(root, 'yesterdayRevenue', formatCurrency(0));
    setActivity(root, 'yesterdayCommission', 'Commission setup pending.');
    setActivity(root, 'yesterdayOrders', 'Coupon used 0 times');
    setActivity(root, 'lastWeekRevenue', formatCurrency(0));
    setActivity(root, 'lastWeekCommission', 'Commission setup pending.');
    setActivity(root, 'lastWeekOrders', 'Coupon used 0 times');

    var analyticsSection = root.querySelector('.js-ar-partner-analytics');
    if (analyticsSection) analyticsSection.hidden = true;
    root.querySelectorAll('[data-chart-canvas]').forEach(function (canvas) {
      canvas.innerHTML = '';
    });

    if (root._chartObserver) {
      root._chartObserver.disconnect();
      root._chartObserver = null;
    }

    root._chartsRendered = false;
    root._referral = '';
    root._data = null;
  }

  function populateDashboard(root, data) {
    var partner = data.partner || {};
    var summary = data.summary || {};
    var commission = data.commission || {};
    var recentOrders = Array.isArray(data.recentOrders) ? data.recentOrders : [];
    var analytics = data.analytics || {};
    var activity = analytics.activity || {};
    var referral = data.referralUrl || '';
    var hasOrders = Number(summary.ordersUsingCoupon) > 0;

    root._referral = referral;
    root._data = data;

    setText(root, '.js-ar-partner-name', partner.name || 'Partner');
    setText(root, '.js-ar-partner-since', partner.partnerSince ? formatDate(partner.partnerSince) : '—');
    setText(root, '.js-ar-partner-status-text', partner.status || 'Unknown');
    setText(root, '.js-ar-partner-coupon-hero', partner.coupon || '—');
    setText(root, '.js-ar-partner-coupon-card', partner.coupon || '—');
    setText(root, '.js-ar-partner-referral-url', referral || '—');

    setMetric(
      root,
      'ordersUsingCoupon',
      hasOrders ? formatNumber(summary.ordersUsingCoupon) : 'No orders yet.',
      hasOrders ? '' : 'Share your coupon to start earning.',
      !hasOrders
    );
    setMetric(
      root,
      'totalRevenueGenerated',
      hasOrders ? formatCurrency(summary.totalRevenueGenerated) : 'No revenue yet.',
      '',
      !hasOrders
    );
    setMetric(
      root,
      'commissionEarned',
      Number(summary.commissionEarned) > 0 ? formatCurrency(summary.commissionEarned) : 'No commission earned yet.',
      '',
      !(Number(summary.commissionEarned) > 0)
    );
    setMetric(
      root,
      'averageOrderValue',
      hasOrders ? formatCurrency(summary.averageOrderValue) : '—',
      hasOrders ? '' : 'Average order value appears after your first order.',
      !hasOrders
    );
    setMetric(
      root,
      'lastCouponUseAt',
      summary.lastCouponUseAt ? formatDate(summary.lastCouponUseAt) : 'No coupon use yet.',
      '',
      !summary.lastCouponUseAt
    );
    setMetric(
      root,
      'highestOrder',
      hasOrders ? formatCurrency(summary.highestOrder) : '—',
      '',
      !hasOrders
    );
    setMetric(
      root,
      'thisMonthSales',
      Number(summary.thisMonthSales) > 0 ? formatCurrency(summary.thisMonthSales) : 'No sales this month.',
      '',
      !(Number(summary.thisMonthSales) > 0)
    );
    setMetric(
      root,
      'lifetimeSales',
      hasOrders ? formatCurrency(summary.lifetimeSales) : 'No lifetime sales yet.',
      '',
      !hasOrders
    );

    renderOrders(root, recentOrders);
    renderCommission(root, partner, commission);
    renderAnalytics(root, analytics);
    setActivity(root, 'todayRevenue', formatCurrency(activity.today ? activity.today.revenue : 0));
    setActivity(
      root,
      'todayCommission',
      activity.today && activity.today.commission != null ? formatCurrency(activity.today.commission) : 'Commission setup pending.'
    );
    setActivity(root, 'todayOrders', 'Coupon used ' + formatNumber(activity.today ? activity.today.orders : 0) + ' times');
    setActivity(root, 'yesterdayRevenue', formatCurrency(activity.yesterday ? activity.yesterday.revenue : 0));
    setActivity(
      root,
      'yesterdayCommission',
      activity.yesterday && activity.yesterday.commission != null
        ? formatCurrency(activity.yesterday.commission)
        : 'Commission setup pending.'
    );
    setActivity(
      root,
      'yesterdayOrders',
      'Coupon used ' + formatNumber(activity.yesterday ? activity.yesterday.orders : 0) + ' times'
    );
    setActivity(root, 'lastWeekRevenue', formatCurrency(activity.lastWeek ? activity.lastWeek.revenue : 0));
    setActivity(
      root,
      'lastWeekCommission',
      activity.lastWeek && activity.lastWeek.commission != null
        ? formatCurrency(activity.lastWeek.commission)
        : 'Commission setup pending.'
    );
    setActivity(root, 'lastWeekOrders', 'Coupon used ' + formatNumber(activity.lastWeek ? activity.lastWeek.orders : 0) + ' times');
    setShareLinks(root, partner.coupon || '', referral);
  }

  function initLoginReveal(root) {
    var items = root.querySelectorAll('.js-ar-partner-login .ar-partner-reveal');
    if (!items.length) return;

    root.classList.add('ar-partner--animate');
    if (REDUCED || !('IntersectionObserver' in window)) {
      items.forEach(function (el) {
        el.classList.add('ar-partner-reveal--in');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('ar-partner-reveal--in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.06 }
    );

    items.forEach(function (el, index) {
      el.style.setProperty('--ar-p-delay', Math.min(index * 40, 120) + 'ms');
      observer.observe(el);
    });
  }

  function revealDashboard(root) {
    root.querySelectorAll('.js-ar-partner-dash .ar-partner-reveal').forEach(function (el) {
      el.classList.add('ar-partner-reveal--in');
    });
  }

  function lockGate(root) {
    root.classList.add('ar-partner--gate');
    root.classList.remove('ar-partner--authenticated');

    var login = root.querySelector('.js-ar-partner-login');
    var dash = root.querySelector('.js-ar-partner-dash');

    resetDashboard(root);

    if (login) {
      login.hidden = false;
      login.removeAttribute('aria-hidden');
    }

    if (dash) {
      dash.hidden = true;
      dash.setAttribute('aria-hidden', 'true');
      dash.setAttribute('inert', '');
    }
  }

  function unlockDashboard(root) {
    root.classList.remove('ar-partner--gate');
    root.classList.add('ar-partner--authenticated');

    var login = root.querySelector('.js-ar-partner-login');
    var dash = root.querySelector('.js-ar-partner-dash');

    if (login) {
      login.hidden = true;
      login.setAttribute('aria-hidden', 'true');
    }

    if (dash) {
      dash.hidden = false;
      dash.removeAttribute('aria-hidden');
      dash.removeAttribute('inert');
    }
  }

  function setSubmitLoading(submit, loading) {
    if (!submit) return;

    if (loading) {
      if (!submit.dataset.label) submit.dataset.label = submit.textContent;
      submit.textContent = 'Verifying…';
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      return;
    }

    submit.textContent = submit.dataset.label || 'Access Dashboard';
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
  }

  function showError(root, msg) {
    var err = root.querySelector('.js-ar-partner-error');
    if (!err) return;

    err.textContent = msg;
    err.hidden = false;
  }

  function clearError(root) {
    var err = root.querySelector('.js-ar-partner-error');
    if (!err) return;

    err.textContent = '';
    err.hidden = true;
  }

  function showLogin(root) {
    lockGate(root);

    var code = root.querySelector('.js-ar-partner-code');
    var submit = root.querySelector('.js-ar-partner-submit');

    if (code) code.value = '';
    setSubmitLoading(submit, false);

    if (code) code.focus();
  }

  function renderDashboard(root, data) {
    unlockDashboard(root);
    showLoading(root);

    setTimeout(function () {
      try {
        populateDashboard(root, data);
        console.info('[PARTNER] DASHBOARD POPULATED');
      } catch (_error) {
        showError(root, 'Unable to load partner analytics. Please try again later.');
        showLogin(root);
        return;
      }
      showContent(root);
      revealDashboard(root);
      console.info('[PARTNER] RENDER COMPLETE');
    }, LOAD_MS);
  }

  function handleAuthResponse(root, result, submit) {
    var body = result.body || {};

    if (result.status === 429) {
      showError(root, LOCKOUT_ERROR);
      setSubmitLoading(submit, false);
      return;
    }

    if (!body.ok) {
      showError(root, body.error || GENERIC_ERROR);
      setSubmitLoading(submit, false);
      return;
    }

    setSubmitLoading(submit, false);
    renderDashboard(root, body);
  }

  function attemptLogin(root) {
    clearError(root);

    var submit = root.querySelector('.js-ar-partner-submit');
    var codeEl = root.querySelector('.js-ar-partner-code');
    var coupon = sanitizeCode(codeEl ? codeEl.value : '');

    setSubmitLoading(submit, true);

    if (!CODE_RE.test(coupon)) {
      showError(root, GENERIC_ERROR);
      setSubmitLoading(submit, false);
      return;
    }

    apiRequest(root, '/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupon: coupon })
    })
      .then(function (result) {
        if (result.body && result.body.ok) console.info('[PARTNER] AUTH SUCCESS');
        handleAuthResponse(root, result, submit);
      })
      .catch(function () {
        showError(root, GENERIC_ERROR);
        setSubmitLoading(submit, false);
      });
  }

  function restoreSession(root) {
    apiRequest(root, '/session')
      .then(function (result) {
        if (result.body && result.body.ok) {
          console.info('[PARTNER] SESSION RESTORED');
          renderDashboard(root, result.body);
          return;
        }

        showLogin(root);
        initLoginReveal(root);
      })
      .catch(function () {
        showLogin(root);
        initLoginReveal(root);
      });
  }

  function logout(root) {
    apiRequest(root, '/logout', { method: 'POST' }).finally(function () {
      showLogin(root);
      clearError(root);
      initLoginReveal(root);
    });
  }

  function shareNative(root, btn) {
    var data = root._data || {};
    var partner = data.partner || {};
    var referral = root._referral || '';
    var message = buildShareMessage(root);

    if (!referral) return;

    if (navigator.share) {
      navigator
        .share({
          title: 'Anand Rasa',
          text: message,
          url: referral
        })
        .then(function () {
          flashBtn(btn);
        })
        .catch(function () {});
      return;
    }

    copyText(message || referral, root, btn, (partner.coupon ? 'Coupon details copied' : 'Link copied'));
  }

  function shareInstagram(root, btn) {
    var referral = root._referral || '';
    if (!referral) return;

    copyText(referral, root, btn, 'Link copied for Instagram');
    window.open('https://www.instagram.com/', '_blank', 'noopener');
  }

  function bindEvents(root) {
    var form = root.querySelector('.js-ar-partner-form');
    var codeEl = root.querySelector('.js-ar-partner-code');
    var logoutBtn = root.querySelector('.js-ar-partner-logout');

    if (codeEl) {
      codeEl.addEventListener('input', function () {
        codeEl.value = sanitizeCode(codeEl.value);
        clearError(root);
      });
    }

    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        attemptLogin(root);
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logout(root);
      });
    }

    root.addEventListener('click', function (event) {
      var copyBtn = event.target.closest('.js-ar-partner-copy');
      if (copyBtn && root.contains(copyBtn) && root._data) {
        var type = copyBtn.getAttribute('data-copy-type');
        var coupon = root._data.partner && root._data.partner.coupon;

        if (type === 'coupon' && coupon) {
          copyText(coupon, root, copyBtn, 'Coupon copied');
        } else if (type === 'referral' && root._referral) {
          copyText(root._referral, root, copyBtn, 'Referral link copied');
        }
        return;
      }

      var shareBtn = event.target.closest('.js-ar-partner-native-share');
      if (shareBtn && root.contains(shareBtn) && root._data) {
        shareNative(root, shareBtn);
        return;
      }

      var instagramBtn = event.target.closest('.js-ar-partner-share-ig');
      if (instagramBtn && root.contains(instagramBtn) && root._data) {
        shareInstagram(root, instagramBtn);
      }
    });
  }

  function init(root) {
    if (!root || root.dataset.ready) return;

    root.dataset.ready = '1';
    lockGate(root);
    bindEvents(root);
    restoreSession(root);
  }

  function boot() {
    document.querySelectorAll('.js-ar-partner').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var root = event.target && event.target.querySelector('.js-ar-partner');
    if (!root) return;

    root.dataset.ready = '';
    init(root);
  });
})();
