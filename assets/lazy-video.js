/**
 * Visibility-gated video loading.
 *
 * A video marked with data-lazy-src keeps preload="none" and shows only its poster
 * until it is close to the viewport, so a decorative clip costs one small image on
 * first paint instead of megabytes of media. Playback is paused again once the clip
 * scrolls away or the tab is hidden, which keeps video decoding off the main thread
 * whenever nothing is actually on screen.
 */
(function () {
  'use strict';

  var SELECTOR = 'video[data-lazy-src]';
  var observer = null;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function attachSource(video) {
    if (video.dataset.lazyLoaded === 'true') return;
    video.dataset.lazyLoaded = 'true';

    var src = video.getAttribute('data-lazy-src');
    var type = video.getAttribute('data-lazy-type');

    if (type) {
      var source = document.createElement('source');
      source.src = src;
      source.type = type;
      video.appendChild(source);
    } else {
      video.src = src;
    }

    video.load();
  }

  function tryPlay(video) {
    if (video.dataset.lazyAutoplay !== 'true' || reducedMotion()) return;
    var p = video.play();
    // Autoplay can still be refused (low power mode, data saver); the poster stays.
    if (p && typeof p.catch === 'function') p.catch(function () {});
  }

  function enter(video) {
    attachSource(video);
    tryPlay(video);
  }

  function leave(video) {
    if (video.dataset.lazyLoaded === 'true' && !video.paused) video.pause();
  }

  function observe(video) {
    if (video.dataset.lazyObserved === 'true') return;
    video.dataset.lazyObserved = 'true';

    if (!observer) {
      enter(video);
      return;
    }
    observer.observe(video);
  }

  function boot(root) {
    var scope = root && root.querySelectorAll ? root : document;
    Array.prototype.forEach.call(scope.querySelectorAll(SELECTOR), observe);
  }

  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            enter(entry.target);
          } else {
            leave(entry.target);
          }
        });
      },
      { rootMargin: '200px 0px', threshold: 0.01 }
    );
  }

  document.addEventListener('visibilitychange', function () {
    Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (video) {
      if (document.hidden) {
        leave(video);
      }
    });
  });

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot(document);
    });
  } else {
    boot(document);
  }
})();
