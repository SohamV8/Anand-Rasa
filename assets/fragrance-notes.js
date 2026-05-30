(function () {
  'use strict';

  var section = document.querySelector('.js-ar-fn');
  if (!section) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('ar-fn--vis');
    return;
  }

  if (!('IntersectionObserver' in window)) {
    section.classList.add('ar-fn--vis');
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      var entry = entries[0];
      if (!entry.isIntersecting) return;
      section.classList.add('ar-fn--vis');
      observer.disconnect();
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  observer.observe(section);
})();
