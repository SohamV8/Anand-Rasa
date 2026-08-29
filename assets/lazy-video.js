/**
 * Visibility-gated video loading + cross-browser muted autoplay.
 *
 * Videos with data-lazy-src keep preload="none" until near the viewport.
 * Playback pauses when scrolled away or the tab is hidden (GPU/CPU friendly).
 */
(function () {
  'use strict';

  var SELECTOR = 'video[data-lazy-src]';
  var observer = null;
  var visible = new WeakSet();

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function applyAutoplayChrome(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.loop = true;
    video.setAttribute('loop', '');
    video.autoplay = true;
    video.setAttribute('autoplay', '');
    video.controls = false;
    video.removeAttribute('controls');
    video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    if ('disablePictureInPicture' in video) {
      video.disablePictureInPicture = true;
    }
    if (!video.classList.contains('arc-card__video')) {
      video.style.transform = 'translateZ(0)';
      video.style.backfaceVisibility = 'hidden';
    }
  }

  function attachSource(video) {
    if (video.dataset.lazyLoaded === 'true') return;
    video.dataset.lazyLoaded = 'true';

    var src = video.getAttribute('data-lazy-src');
    var type = video.getAttribute('data-lazy-type');

    if (!src) return;

    if (type) {
      var source = document.createElement('source');
      source.src = src;
      source.type = type;
      video.appendChild(source);
    } else {
      video.src = src;
    }

    applyAutoplayChrome(video);
    video.load();
  }

  function tryPlay(video) {
    if (video.dataset.lazyAutoplay !== 'true' || reducedMotion()) {
      if (reducedMotion() && !video.paused) video.pause();
      return;
    }

    applyAutoplayChrome(video);

    var attempt = function () {
      var promise = video.play();
      if (!promise || typeof promise.catch !== 'function') return;

      promise.catch(function () {
        var retry = function () {
          applyAutoplayChrome(video);
          var second = video.play();
          if (second && typeof second.catch === 'function') {
            second.catch(function () {
              /* Autoplay blocked (Low Power Mode, data saver, etc.) */
            });
          }
        };

        if (video.readyState >= 2) {
          window.setTimeout(retry, 50);
        } else {
          video.addEventListener('loadeddata', retry, { once: true });
          video.addEventListener('canplay', retry, { once: true });
        }
      });
    };

    if (video.readyState >= 2) {
      attempt();
    } else {
      video.addEventListener('loadeddata', attempt, { once: true });
      video.addEventListener('canplay', attempt, { once: true });
      attempt();
    }
  }

  function enter(video) {
    attachSource(video);
    visible.add(video);
    tryPlay(video);
  }

  function leave(video) {
    visible.delete(video);
    if (video.dataset.lazyLoaded === 'true' && !video.paused) {
      video.pause();
    }
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
      { rootMargin: '120px 0px', threshold: 0.08 }
    );
  }

  document.addEventListener('visibilitychange', function () {
    Array.prototype.forEach.call(document.querySelectorAll(SELECTOR), function (video) {
      if (document.hidden) {
        leave(video);
        return;
      }
      if (video.dataset.lazyLoaded === 'true' && visible.has(video)) {
        tryPlay(video);
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
