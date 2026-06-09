(function () {
  'use strict';

  if (window.__atrInit) return;
  window.__atrInit = true;

  function markLoaded(wrap) {
    if (!wrap) return;
    wrap.classList.add('is-loaded');
  }

  function showImage(img) {
    if (!img) return;
    img.classList.add('is-ready');
    var wrap = img.closest('[data-atr-media]');
    markLoaded(wrap);
  }

  function initImage(wrap) {
    if (!wrap || wrap.dataset.atrImgInit === 'true') return;
    wrap.dataset.atrImgInit = 'true';

    var primary = wrap.querySelector('[data-atr-img]');
    var alternate = wrap.querySelector('[data-atr-img-alt]');
    var placeholder = wrap.querySelector('.atr__img-placeholder');

    function useAlternate() {
      if (!alternate || !primary) {
        markLoaded(wrap);
        return;
      }
      primary.hidden = true;
      primary.classList.remove('is-ready');
      alternate.hidden = false;
      if (alternate.complete && alternate.naturalWidth > 0) {
        showImage(alternate);
      } else {
        alternate.addEventListener('load', function () {
          showImage(alternate);
        });
        alternate.addEventListener('error', function () {
          markLoaded(wrap);
        });
      }
    }

    if (primary) {
      if (primary.complete && primary.naturalWidth > 0) {
        showImage(primary);
      } else {
        primary.addEventListener('load', function () {
          showImage(primary);
        });
        primary.addEventListener('error', useAlternate);
      }
      return;
    }

    if (placeholder) {
      markLoaded(wrap);
    }
  }

  function initSection(section) {
    if (!section || section.dataset.atrSectionInit === 'true') return;
    section.dataset.atrSectionInit = 'true';

    var wrap = section.querySelector('[data-atr-media]');
    if (wrap) initImage(wrap);

    var frame = section.querySelector('[data-atr-reveal]');
    if (!frame) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame.classList.add('is-visible');
      markLoaded(wrap);
      section.querySelectorAll('[data-atr-img]').forEach(function (img) {
        img.classList.add('is-ready');
      });
      return;
    }

    if (!('IntersectionObserver' in window)) {
      frame.classList.add('is-visible');
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
    );

    observer.observe(frame);
  }

  function boot(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-atr-section]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot();
    });
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (e) {
    boot(e.target);
  });
})();
