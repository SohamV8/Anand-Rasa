/**
 * Trust Marquee — seamless infinite scroll, constant px/s, GPU transform only.
 */
(function () {
  'use strict';

  const BASE_SPEED = 40;
  const SPEED_STEP = 8;
  const SLOWDOWN = 1.26;
  const BP = { mobile: 749, tablet: 989, wide: 1600 };

  function speedMult() {
    const w = window.innerWidth;
    if (w <= BP.mobile) return 0.78;
    if (w <= BP.tablet) return 0.88;
    if (w >= BP.wide) return 1;
    return 0.94;
  }

  function readGapPx(root, track) {
    const trackStyles = getComputedStyle(track);
    const gap = parseFloat(trackStyles.columnGap || trackStyles.gap);
    if (!Number.isNaN(gap) && gap > 0) return gap;

    const rootGap = parseFloat(getComputedStyle(root).getPropertyValue('--tmq-gap'));
    return Number.isNaN(rootGap) ? 0 : rootGap;
  }

  function setDuration(root) {
    const track = root.querySelector('[data-tmq-track]');
    const row = root.querySelector('[data-tmq-row]');
    if (!track || !row) return;

    const rowW = Math.round(row.getBoundingClientRect().width);
    if (rowW <= 0) return;

    const gap = readGapPx(root, track);
    const shift = rowW + gap;
    const setting = parseInt(root.dataset.speed || '5', 10);
    const pxPerSec = ((BASE_SPEED + setting * SPEED_STEP) * speedMult()) / SLOWDOWN;
    const duration = shift / pxPerSec;

    root.style.setProperty('--tmq-shift', shift + 'px');
    root.style.setProperty('--tmq-duration', duration.toFixed(3) + 's');
  }

  function init(root) {
    if (root.dataset.tmqReady === 'true') return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    root.dataset.tmqReady = 'true';

    let resizeTimer = null;
    let lastShift = 0;

    const update = () => {
      const track = root.querySelector('[data-tmq-track]');
      const row = root.querySelector('[data-tmq-row]');
      if (!track || !row) return;

      const rowW = Math.round(row.getBoundingClientRect().width);
      const gap = readGapPx(root, track);
      const shift = rowW + gap;

      if (Math.abs(shift - lastShift) < 2 && lastShift > 0) return;
      lastShift = shift;

      setDuration(root);
    };

    const scheduleUpdate = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        requestAnimationFrame(update);
      }, 120);
    };

    const boot = () => requestAnimationFrame(() => requestAnimationFrame(update));

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(boot).catch(boot);
    } else {
      boot();
    }

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(scheduleUpdate);
      ro.observe(root);
    } else {
      window.addEventListener('resize', scheduleUpdate, { passive: true });
    }

    window.addEventListener('load', scheduleUpdate, { passive: true, once: true });
  }

  function boot() {
    document.querySelectorAll('[data-trust-marquee]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', (e) => {
    e.target.querySelectorAll?.('[data-trust-marquee]').forEach((root) => {
      root.dataset.tmqReady = 'false';
      init(root);
    });
  });
})();
