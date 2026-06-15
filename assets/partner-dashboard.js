/**
 * Anand Rasa — Partner Dashboard V1
 * Coupon-gated portal. Isolated module — no external API calls in Phase 1.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ar_partner_sess';
  var ATTEMPTS_KEY = 'ar_partner_att';
  var LOCKOUT_KEY = 'ar_partner_lock';
  var MAX_ATTEMPTS = 8;
  var WINDOW_MS = 15 * 60 * 1000;
  var LOCKOUT_MS = 5 * 60 * 1000;
  var COUPON_RE = /^[A-Z0-9]{4,24}$/;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Phase 1 partner registry (mock).
   * Phase 2: replace lookup with metafield/Flow-fed endpoint.
   * Encoded as tuples — not exposed in HTML.
   */
  var REGISTRY = [
    ['SOHAM10', 'Soham', 12, 32000, 3200, 10, 1],
    ['RAHUL10', 'Rahul', 8, 18000, 1800, 10, 1],
    ['PRIYA10', 'Priya', 21, 58000, 5800, 10, 1]
  ];

  var lookup = Object.create(null);
  REGISTRY.forEach(function (row) {
    lookup[row[0]] = {
      coupon: row[0],
      name: row[1],
      orders: row[2],
      revenue: row[3],
      commission: row[4],
      rate: row[5],
      active: row[6] === 1
    };
  });

  function sanitize(raw) {
    if (typeof raw !== 'string') return '';
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
  }

  function formatCurrency(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  function formatNumber(n) {
    return Math.round(n).toLocaleString('en-IN');
  }

  function getAttempts() {
    try {
      var raw = sessionStorage.getItem(ATTEMPTS_KEY);
      if (!raw) return { count: 0, since: Date.now() };
      var data = JSON.parse(raw);
      if (Date.now() - data.since > WINDOW_MS) return { count: 0, since: Date.now() };
      return data;
    } catch (e) {
      return { count: 0, since: Date.now() };
    }
  }

  function recordAttempt(failed) {
    if (!failed) {
      sessionStorage.removeItem(ATTEMPTS_KEY);
      return;
    }
    var data = getAttempts();
    data.count += 1;
    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
    if (data.count >= MAX_ATTEMPTS) {
      sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
    }
  }

  function isLockedOut() {
    try {
      var until = parseInt(sessionStorage.getItem(LOCKOUT_KEY), 10);
      if (!until) return false;
      if (Date.now() < until) return true;
      sessionStorage.removeItem(LOCKOUT_KEY);
      sessionStorage.removeItem(ATTEMPTS_KEY);
      return false;
    } catch (e) {
      return false;
    }
  }

  function lockoutRemaining() {
    var until = parseInt(sessionStorage.getItem(LOCKOUT_KEY), 10) || 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 60000));
  }

  function saveSession(coupon) {
    try {
      sessionStorage.setItem(STORAGE_KEY, coupon);
    } catch (e) {}
  }

  function loadSession() {
    try {
      return sanitize(sessionStorage.getItem(STORAGE_KEY) || '');
    } catch (e) {
      return '';
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function resolvePartner(coupon) {
    if (!COUPON_RE.test(coupon)) return null;
    return lookup[coupon] || null;
  }

  function referralUrl(shopUrl, coupon) {
    var base = (shopUrl || '').replace(/\/$/, '');
    return base + '/?ref=' + encodeURIComponent(coupon);
  }

  function toast(root, msg) {
    var el = root.querySelector('.js-ar-partner-toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('ar-partner-toast--in');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove('ar-partner-toast--in');
      setTimeout(function () { el.hidden = true; }, 350);
    }, 2400);
  }

  function copyText(text, root) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(root, 'Copied to clipboard');
      }).catch(function () { fallbackCopy(text, root); });
    } else {
      fallbackCopy(text, root);
    }
  }

  function fallbackCopy(text, root) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast(root, 'Copied to clipboard');
    } catch (e) {
      toast(root, 'Please copy manually');
    }
    document.body.removeChild(ta);
  }

  function animateCounter(el, target, fmt) {
    if (REDUCED) {
      el.textContent = fmt === 'currency' ? formatCurrency(target) : formatNumber(target);
      return;
    }
    var start = performance.now();
    var dur = 1000;
    function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = fmt === 'currency' ? formatCurrency(val) : formatNumber(val);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = fmt === 'currency' ? formatCurrency(target) : formatNumber(target);
    }
    requestAnimationFrame(tick);
  }

  function initReveal(root) {
    root.classList.add('ar-partner--animate');
    var items = root.querySelectorAll('.ar-partner-reveal');
    if (REDUCED || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('ar-partner-reveal--in'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('ar-partner-reveal--in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    items.forEach(function (el) { obs.observe(el); });
  }

  function showGate(root) {
    root.querySelector('.js-ar-partner-gate').hidden = false;
    root.querySelector('.js-ar-partner-dash').hidden = true;
    root.querySelector('.js-ar-partner-sticky').hidden = true;
    var input = root.querySelector('.js-ar-partner-input');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  function showError(root, msg) {
    var err = root.querySelector('.js-ar-partner-error');
    if (!err) return;
    err.textContent = msg;
    err.hidden = false;
  }

  function clearError(root) {
    var err = root.querySelector('.js-ar-partner-error');
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
  }

  function renderDashboard(root, partner) {
    var shopUrl = root.getAttribute('data-shop-url') || '';
    var ref = referralUrl(shopUrl, partner.coupon);
    var isEmpty = partner.orders === 0;

    root.querySelector('.js-ar-partner-name').textContent = partner.name;
    root.querySelector('.js-ar-partner-coupon').textContent = partner.coupon;
    root.querySelector('.js-ar-partner-status').textContent = partner.active ? 'Active' : 'Pending';
    root.querySelector('.js-ar-partner-rate').textContent = partner.rate + '%';
    root.querySelector('.js-ar-partner-referral').textContent = ref.replace(/^https?:\/\//, '');

    var emptyEl = root.querySelector('.js-ar-partner-empty');
    var activityEl = root.querySelector('.js-ar-partner-activity');
    if (isEmpty) {
      emptyEl.hidden = false;
      activityEl.hidden = true;
    } else {
      emptyEl.hidden = true;
      activityEl.hidden = false;
      var actText = root.querySelector('.js-ar-partner-activity-text');
      if (actText) {
        actText.textContent = partner.orders === 1
          ? 'Someone used your code recently.'
          : 'Someone used your code today.';
      }
    }

    root.querySelectorAll('.js-ar-partner-counter').forEach(function (el) {
      var key = el.getAttribute('data-key');
      var fmt = el.getAttribute('data-format') || 'number';
      var val = partner[key] != null ? partner[key] : 0;
      animateCounter(el, val, fmt);
    });

    var wa = root.querySelector('.js-ar-partner-whatsapp');
    if (wa) {
      var num = root.getAttribute('data-whatsapp') || '';
      var text = 'Discover Anand Rasa with my partner code ' + partner.coupon + ': ' + ref;
      wa.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
    }

    root._partner = partner;
    root._referral = ref;

    root.querySelector('.js-ar-partner-gate').hidden = true;
    root.querySelector('.js-ar-partner-dash').hidden = false;
    root.querySelector('.js-ar-partner-sticky').hidden = false;

    var success = root.querySelector('.js-ar-partner-success-icon');
    if (success) {
      success.classList.remove('ar-partner-dash__success--in');
      void success.offsetWidth;
      if (!REDUCED) success.classList.add('ar-partner-dash__success--in');
    }

    initReveal(root);
  }

  function validateAndShow(root, rawCoupon) {
    clearError(root);

    if (isLockedOut()) {
      showError(root, 'Too many attempts. Please try again in ' + lockoutRemaining() + ' minute(s).');
      return;
    }

    var coupon = sanitize(rawCoupon);

    if (!coupon || coupon.length < 4) {
      recordAttempt(true);
      showError(root, "We couldn't find that partner code. Please try again.");
      return;
    }

    var partner = resolvePartner(coupon);

    if (!partner) {
      recordAttempt(true);
      showError(root, "We couldn't find that partner code. Please try again.");
      return;
    }

    recordAttempt(false);
    saveSession(coupon);
    renderDashboard(root, partner);
  }

  function bindEvents(root) {
    var form = root.querySelector('.js-ar-partner-form');
    var input = root.querySelector('.js-ar-partner-input');

    if (input) {
      input.addEventListener('input', function () {
        var pos = input.selectionStart;
        var before = input.value;
        input.value = sanitize(before);
        if (pos != null) input.setSelectionRange(input.value.length, input.value.length);
        clearError(root);
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        validateAndShow(root, input ? input.value : '');
      });
    }

    root.querySelector('.js-ar-partner-signout')?.addEventListener('click', function () {
      clearSession();
      showGate(root);
      clearError(root);
    });

    root.querySelectorAll('.js-ar-partner-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = root._partner;
        if (!p) return;
        var type = btn.getAttribute('data-copy-type');
        if (type === 'coupon') copyText(p.coupon, root);
        else if (type === 'referral') copyText(root._referral || '', root);
      });
    });

    root.querySelector('.js-ar-partner-share-ig')?.addEventListener('click', function () {
      toast(root, 'Open Instagram and paste your referral link');
      if (root._referral) copyText(root._referral, root);
    });
  }

  function init(root) {
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';
    bindEvents(root);

    var saved = loadSession();
    if (saved) {
      var partner = resolvePartner(saved);
      if (partner) {
        renderDashboard(root, partner);
        return;
      }
      clearSession();
    }
    showGate(root);
    initReveal(root);
  }

  function boot() {
    document.querySelectorAll('.js-ar-partner').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (ev) {
    var root = ev.target && ev.target.querySelector('.js-ar-partner');
    if (root) init(root);
  });
})();
