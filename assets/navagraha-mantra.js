(function () {
  if (window.__ngMantraInit) return;
  window.__ngMantraInit = true;

  var strips = document.querySelectorAll('[data-ng-reveal]');
  if (!strips.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal(el) {
    el.classList.add('is-visible');
  }

  if (reduced || !('IntersectionObserver' in window)) {
    strips.forEach(reveal);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.12 }
  );

  strips.forEach(function (strip) {
    observer.observe(strip);
  });
})();
