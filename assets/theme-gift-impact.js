(function () {
  'use strict';

  function initSection(root) {
    if (!root || root.dataset.lgiInit === 'true') return;
    root.dataset.lgiInit = 'true';
    root.classList.add('is-visible');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
            }
          });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
      );
      observer.observe(root);
    }
  }

  function boot() {
    document.querySelectorAll('[data-lgi-section]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var section = e.target.querySelector('[data-lgi-section]');
    if (section) initSection(section);
  });
})();
