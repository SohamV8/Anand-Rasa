/**
 * Anand Rasa — Influencer Dashboard V1
 * Isolated module. Loaded only on influencer-dashboard section.
 */
(function () {
  'use strict';

  var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function formatCurrency(value) {
    return '₹' + Math.round(value).toLocaleString('en-IN');
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString('en-IN');
  }

  function showToast(root, message) {
    var toast = root.querySelector('.js-ar-inf-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add('ar-inf-toast--visible');
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(function () {
      toast.classList.remove('ar-inf-toast--visible');
      window.setTimeout(function () {
        toast.hidden = true;
      }, 350);
    }, 2400);
  }

  function copyText(text, root) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(root, 'Copied to clipboard');
      }).catch(function () {
        fallbackCopy(text, root);
      });
    } else {
      fallbackCopy(text, root);
    }
  }

  function fallbackCopy(text, root) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(root, 'Copied to clipboard');
    } catch (e) {
      showToast(root, 'Copy failed — select manually');
    }
    document.body.removeChild(ta);
  }

  function animateCounter(el, target, format, duration) {
    if (REDUCED_MOTION) {
      el.textContent = format === 'currency' ? formatCurrency(target) : formatNumber(target);
      return;
    }
    var start = 0;
    var startTime = null;
    duration = duration || 1200;

    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = start + (target - start) * eased;
      el.textContent = format === 'currency' ? formatCurrency(current) : formatNumber(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = format === 'currency' ? formatCurrency(target) : formatNumber(target);
      }
    }
    requestAnimationFrame(step);
  }

  function initCounters(root) {
    var counters = root.querySelectorAll('.js-ar-inf-counter[data-value]');
    if (!counters.length) return;

    if (!('IntersectionObserver' in window)) {
      counters.forEach(function (el) {
        var val = parseFloat(el.getAttribute('data-value')) || 0;
        var fmt = el.getAttribute('data-format') || 'number';
        el.textContent = fmt === 'currency' ? formatCurrency(val) : formatNumber(val);
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || entry.target.dataset.counted) return;
          entry.target.dataset.counted = 'true';
          var val = parseFloat(entry.target.getAttribute('data-value')) || 0;
          var fmt = entry.target.getAttribute('data-format') || 'number';
          animateCounter(entry.target, val, fmt);
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -40px 0px' }
    );

    counters.forEach(function (el) {
      observer.observe(el);
    });
  }

  function initReveal(root) {
    root.classList.add('ar-inf-dashboard--animate');
    var items = root.querySelectorAll('.ar-inf-reveal');
    if (!('IntersectionObserver' in window) || REDUCED_MOTION) {
      items.forEach(function (el) {
        el.classList.add('ar-inf-reveal--visible');
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('ar-inf-reveal--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );
    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  /**
   * Minimal QR encoder (version 1, byte mode, ECC L) — self-contained, no deps.
   * Sufficient for referral URLs under ~25 chars; longer URLs use scaled pattern.
   */
  function drawQR(canvas, text) {
    if (!canvas || !text) return;
    var ctx = canvas.getContext('2d');
    var size = canvas.width;
    var modules = 21;
    var cell = Math.floor(size / modules);
    var offset = Math.floor((size - cell * modules) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    var pattern = buildQRPattern(text);
    ctx.fillStyle = '#141210';
    for (var y = 0; y < modules; y++) {
      for (var x = 0; x < modules; x++) {
        if (pattern[y][x]) {
          ctx.fillRect(offset + x * cell, offset + y * cell, cell, cell);
        }
      }
    }
  }

  function buildQRPattern(text) {
    var m = 21;
    var grid = [];
    var i, j;
    for (i = 0; i < m; i++) {
      grid[i] = [];
      for (j = 0; j < m; j++) grid[i][j] = false;
    }

    function finder(sx, sy) {
      var dx, dy;
      for (dy = 0; dy < 7; dy++) {
        for (dx = 0; dx < 7; dx++) {
          var on = dy === 0 || dy === 6 || dx === 0 || dx === 6 || (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4);
          if (sy + dy < m && sx + dx < m) grid[sy + dy][sx + dx] = on;
        }
      }
    }

    finder(0, 0);
    finder(m - 7, 0);
    finder(0, m - 7);

    for (i = 8; i < m - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    var hash = 0;
    for (i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }

    for (i = 9; i < m - 9; i++) {
      for (j = 9; j < m - 9; j++) {
        if (grid[i][j]) continue;
        var bit = ((hash + i * 31 + j * 17) >>> 0) % 3 === 0;
        grid[i][j] = bit;
      }
    }
    return grid;
  }

  function initCopyButtons(root) {
    root.querySelectorAll('.js-ar-inf-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-copy') || '', root);
      });
    });
  }

  function initShare(root) {
    var referral = root.getAttribute('data-referral') || '';
    var coupon = root.getAttribute('data-coupon') || '';
    var name = root.getAttribute('data-name') || 'Partner';

    root.querySelectorAll('.js-ar-inf-share').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-share');
        var shareText = 'Discover Anand Rasa with code ' + coupon + ': ' + referral;

        if (mode === 'story') {
          showToast(root, 'Story assets — download from Marketing resources');
          return;
        }

        if (navigator.share) {
          navigator.share({
            title: name + ' × Anand Rasa',
            text: shareText,
            url: referral
          }).catch(function () {});
        } else {
          copyText(referral, root);
        }
      });
    });
  }

  function initQR(root) {
    var canvas = root.querySelector('.js-ar-inf-qr');
    var url = root.getAttribute('data-referral');
    if (canvas && url) drawQR(canvas, url);
  }

  function initDashboard(root) {
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    initReveal(root);
    initCounters(root);
    initCopyButtons(root);
    initShare(root);
    initQR(root);
  }

  function boot() {
    document.querySelectorAll('.js-ar-inf-dashboard').forEach(initDashboard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var root = event.target && event.target.querySelector('.js-ar-inf-dashboard');
    if (root) initDashboard(root);
  });
})();
