/**
 * Anand Rasa — cart offers live updater + fade marquee + milestone confetti.
 * Gift add/remove stays in ar-b3g1-gift.js.
 *
 * Qualifying value: sum of original_line_price for non-gift items
 * (selling-price subtotal before cart-level discounts).
 * Payable: cart.total_price. Shipping threshold uses payable.
 */
(function () {
  'use strict';

  if (window.__arCartOffersBooted) return;
  window.__arCartOffersBooted = true;

  var CELEBRATED_KEY = 'ar_ms_celebrated_v1';
  var config = null;
  var marqueeTimer = null;
  var hydratedCelebration = false;

  function readConfig() {
    var el = document.querySelector('.ar-cart-offers-config');
    if (!el || !el.textContent) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  function formatMoney(cents) {
    var value = Number(cents) || 0;
    var format = (config && config.moneyFormat) || '₹{{amount}}';
    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(value, format);
    }
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(value / 100);
    } catch (err) {
      return '₹' + Math.round(value / 100);
    }
  }

  function formatRupee(cents) {
    var rupees = Math.round((Number(cents) || 0) / 100);
    try {
      return '₹' + rupees.toLocaleString('en-IN');
    } catch (e) {
      return '₹' + rupees;
    }
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function tickMarquees() {
    document.querySelectorAll('[data-ar-marquee]').forEach(function (root) {
      var items = root.querySelectorAll('.ar-cart-marquee__item');
      if (items.length < 2) return;
      var current = 0;
      items.forEach(function (el, idx) {
        if (el.classList.contains('is-active')) current = idx;
      });
      items[current].classList.remove('is-active');
      items[current].setAttribute('aria-hidden', 'true');
      var next = (current + 1) % items.length;
      items[next].classList.add('is-active');
      items[next].removeAttribute('aria-hidden');
    });
  }

  function startMarquee() {
    if (prefersReducedMotion()) return;
    if (marqueeTimer) return;
    marqueeTimer = window.setInterval(tickMarquees, 3200);
  }

  function isFullCart(cart) {
    return !!(cart && typeof cart.total_price === 'number' && Array.isArray(cart.items));
  }

  function isGift(item) {
    if (!item || !item.properties || !config) return false;
    var key = config.giftPropertyKey || '_ar_b3g1_gift';
    return item.properties[key] != null && String(item.properties[key]) !== '';
  }

  function qualifyingFromCart(cart) {
    var total = 0;
    (cart.items || []).forEach(function (item) {
      if (isGift(item)) return;
      var qty = Number(item.quantity) || 0;
      var original = Number(item.original_price != null ? item.original_price : item.price) || 0;
      total += Number(item.original_line_price) || original * qty;
    });
    return total;
  }

  function progressFromTotal(total) {
    var marks = (config && config.milestones) || [];
    if (!marks.length) {
      return { pct: 0, unlocked: 0, next: 0, away: 0, reachedAmount: 0 };
    }
    var q = Number(total) || 0;
    var unlocked = 0;
    var lastReached = -1;
    var reachedAmount = 0;
    var i;

    for (i = 0; i < marks.length; i++) {
      if (q >= marks[i].amount) {
        unlocked = marks[i].off;
        lastReached = i;
        reachedAmount = marks[i].amount;
      }
    }

    if (lastReached >= marks.length - 1) {
      return { pct: 100, unlocked: unlocked, next: 0, away: 0, reachedAmount: reachedAmount };
    }

    var lower = lastReached >= 0 ? marks[lastReached].amount : 0;
    var upper = marks[lastReached + 1].amount;
    var span = upper - lower;
    var into = q - lower;
    var pct;
    if (lastReached < 0) {
      pct = (q / marks[0].amount) * 25;
    } else {
      pct = span > 0 ? (into / span) * 25 + (lastReached + 1) * 25 : (lastReached + 1) * 25;
    }
    if (pct > 100) pct = 100;
    if (pct < 0) pct = 0;
    return { pct: pct, unlocked: unlocked, next: upper, away: Math.max(0, upper - q), reachedAmount: reachedAmount };
  }

  function compute(cart) {
    var mrp = 0;
    var productDiscount = 0;
    var giftValue = 0;
    var hasGift = false;

    (cart.items || []).forEach(function (item) {
      var qty = Number(item.quantity) || 0;
      var original = Number(item.original_price != null ? item.original_price : item.price) || 0;
      var compare = item.compare_at_price != null ? Number(item.compare_at_price) || 0 : 0;
      var unitMrp = compare > original ? compare : original;
      var lineMrp = unitMrp * qty;
      var originalLine = Number(item.original_line_price) || original * qty;

      if (isGift(item)) {
        hasGift = true;
        if (lineMrp > originalLine) giftValue += lineMrp - originalLine;
        return;
      }

      mrp += lineMrp;
      if (lineMrp > originalLine) productDiscount += lineMrp - originalLine;
    });

    var offerDiscount = Number(cart.total_discount) || 0;
    var couponApplied = false;
    var code = String((config && config.couponCode) || '').toUpperCase();
    (cart.cart_level_discount_applications || []).forEach(function (d) {
      var title = String((d && (d.title || d.code)) || '').toUpperCase();
      if (code && title.indexOf(code) !== -1) couponApplied = true;
    });

    var qualifying = qualifyingFromCart(cart);
    var savings = productDiscount + offerDiscount + giftValue;
    var progress = progressFromTotal(qualifying);
    var shipFreeAt = Number(config && config.shippingFreeAt) || 50000;
    var payable = Number(cart.total_price) || 0;

    return {
      mrp: mrp,
      productDiscount: productDiscount,
      offerDiscount: offerDiscount,
      giftValue: giftValue,
      hasGift: hasGift,
      savings: savings,
      couponApplied: couponApplied,
      qualifying: qualifying,
      payable: payable,
      shipFree: payable >= shipFreeAt,
      progress: progress
    };
  }

  function setText(root, selector, text, hideRow) {
    var el = root.querySelector(selector);
    if (!el) return;
    el.textContent = text || '';
    if (hideRow) {
      var row = el.closest('.ar-cart-break__row');
      if (row) row.hidden = !text;
    }
  }

  function readCelebrated() {
    try {
      return parseInt(sessionStorage.getItem(CELEBRATED_KEY) || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function writeCelebrated(amount) {
    try {
      sessionStorage.setItem(CELEBRATED_KEY, String(amount || 0));
    } catch (e) {}
  }

  function burstConfetti() {
    if (prefersReducedMotion()) return;
    var host = document.querySelector('.ar-unlock');
    if (!host) return;

    var layer = host.querySelector('[data-ar-confetti]');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ar-unlock__confetti';
      layer.setAttribute('data-ar-confetti', '');
      layer.setAttribute('aria-hidden', 'true');
      host.appendChild(layer);
    }
    layer.innerHTML = '';

    var colors = ['#111827', '#2f6b3c', '#d4af37', '#ffffff', '#6b7280'];
    var i;
    for (i = 0; i < 14; i++) {
      var piece = document.createElement('span');
      var dx = (Math.random() * 140 - 70).toFixed(0) + 'px';
      var dy = (Math.random() * 56 - 8).toFixed(0) + 'px';
      var rot = (Math.random() * 220 - 110).toFixed(0) + 'deg';
      piece.style.setProperty('--dx', dx);
      piece.style.setProperty('--dy', dy);
      piece.style.setProperty('--rot', rot);
      piece.style.left = 18 + Math.random() * 64 + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 80) + 'ms';
      layer.appendChild(piece);
    }

    window.setTimeout(function () {
      if (layer) layer.innerHTML = '';
    }, 1100);
  }

  function maybeCelebrate(reachedAmount) {
    var reached = Number(reachedAmount) || 0;
    var prev = readCelebrated();
    if (!hydratedCelebration) {
      hydratedCelebration = true;
      if (reached > prev) writeCelebrated(reached);
      return;
    }
    if (reached > prev) {
      writeCelebrated(reached);
      burstConfetti();
    }
  }

  function celebrateFromDom() {
    var el = document.querySelector('[data-ar-reached]');
    var amt = el ? Number(el.getAttribute('data-ar-reached')) || 0 : 0;
    maybeCelebrate(amt);
  }

  function paint(state) {
    if (!state) return;
    var p = state.progress;

    document.querySelectorAll('[data-ar-cart-offers]').forEach(function (root) {
      var pct = (Number(p.pct) || 0) + '%';
      var rail = root.querySelector('[data-ar-unlock-rail]');
      if (rail) rail.style.setProperty('--ar-progress', pct);
      var fill = root.querySelector('[data-ar-unlock-fill]');
      if (fill) fill.style.width = pct;

      var unlock = root.querySelector('.ar-unlock');
      if (unlock) unlock.setAttribute('data-ar-reached', String(p.reachedAmount || 0));

      root.querySelectorAll('[data-ar-unlock-mark]').forEach(function (mark) {
        var amount = Number(mark.getAttribute('data-amount')) || 0;
        mark.classList.toggle('is-reached', state.qualifying >= amount);
      });

      var msg = root.querySelector('[data-ar-unlock-msg]');
      if (msg) {
        if (p.unlocked > 0) {
          msg.textContent = "🎉 You've unlocked " + p.unlocked + '% OFF';
        } else if (p.next > 0) {
          msg.textContent = 'You are ' + formatRupee(p.away) + ' away from the next milestone';
        } else {
          msg.textContent = '';
        }
      }
    });

    document.querySelectorAll('[data-ar-cart-savings]').forEach(function (root) {
      var banner = root.querySelector('[data-ar-savings-banner]');
      var amountEl = root.querySelector('[data-ar-savings-amount]');
      if (banner) {
        banner.hidden = !(state.savings > 0);
        if (amountEl && state.savings > 0) amountEl.textContent = formatRupee(state.savings);
      }

      setText(root, '[data-ar-break-mrp]', formatMoney(state.mrp));
      setText(root, '[data-ar-break-product]', state.productDiscount > 0 ? '-' + formatMoney(state.productDiscount) : '', true);
      setText(root, '[data-ar-break-offer]', state.offerDiscount > 0 ? '-' + formatMoney(state.offerDiscount) : '', true);
      var offerLabel = root.querySelector('[data-ar-offer-label]');
      if (offerLabel) offerLabel.textContent = state.couponApplied ? 'Coupon Discount' : 'Offer Discount';
      setText(root, '[data-ar-break-gift]', state.giftValue > 0 ? '-' + formatMoney(state.giftValue) : '', true);
      setText(root, '[data-ar-break-ship]', state.shipFree ? 'FREE' : 'At checkout');
      setText(root, '[data-ar-break-payable]', formatMoney(state.payable));
    });

    document.querySelectorAll('[data-ar-est-total]').forEach(function (el) {
      el.textContent = formatMoney(state.payable);
    });

    maybeCelebrate(p.reachedAmount);
  }

  function cartFromEvent(event) {
    if (!event) return null;
    if (event.cartData && isFullCart(event.cartData)) return event.cartData;
    if (event.detail && isFullCart(event.detail)) return event.detail;
    if (isFullCart(event)) return event;
    return null;
  }

  function onCartEvent(event) {
    var cart = cartFromEvent(event);
    if (!config) config = readConfig();
    if (!config) return;
    if (cart) {
      paint(compute(cart));
      return;
    }
    celebrateFromDom();
  }

  function boot() {
    config = readConfig();
    startMarquee();
    celebrateFromDom();
    if (typeof subscribe === 'function' && window.PUB_SUB_EVENTS) {
      subscribe(window.PUB_SUB_EVENTS.cartUpdate, onCartEvent);
    }
    document.addEventListener('cart:updated', onCartEvent);
    document.addEventListener('cart-drawer:rendered', celebrateFromDom);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
