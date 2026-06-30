/**
 * Anand Rasa Community — showcase carousel (no dependencies)
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LOOP_MIN = 5;

  function initCarousel(root) {
    var viewport = root.querySelector('[data-arc-viewport]');
    var track = root.querySelector('[data-arc-track]');
    if (!viewport || !track) return;

    var originals = Array.prototype.slice.call(track.children);
    if (!originals.length) return;

    var loop = originals.length >= LOOP_MIN;

    if (loop) {
      originals.forEach(function (node) {
        track.appendChild(node.cloneNode(true));
      });
      originals.slice().reverse().forEach(function (node) {
        track.insertBefore(node.cloneNode(true), track.firstChild);
      });
    } else {
      track.classList.add('is-finite');
    }

    var cards = track.children;
    var gap = 0;
    var setWidth = 0;
    var offset = 0;
    var minOffset = 0;
    var paused = false;
    var dragging = false;
    var dragStartX = 0;
    var dragStartOffset = 0;
    var rafId = 0;
    var visible = true;
    var io = null;
    var resizeTimer = 0;
    var autoSpeed = loop ? parseFloat(root.getAttribute('data-arc-speed')) || 0.45 : 0;

    function readGap() {
      var style = window.getComputedStyle(track);
      gap = parseFloat(style.columnGap || style.gap) || 16;
    }

    function trackWidth() {
      var total = 0;
      for (var i = 0; i < cards.length; i++) {
        total += cards[i].offsetWidth + (i < cards.length - 1 ? gap : 0);
      }
      return total;
    }

    function clampOffset() {
      if (loop) return;
      if (offset > 0) offset = 0;
      if (offset < minOffset) offset = minOffset;
    }

    function measure() {
      readGap();
      if (loop) {
        setWidth = 0;
        for (var i = originals.length; i < originals.length * 2; i++) {
          setWidth += cards[i].offsetWidth + gap;
        }
        offset = -setWidth;
      } else {
        setWidth = trackWidth();
        minOffset = Math.min(0, viewport.clientWidth - setWidth);
        clampOffset();
      }
      apply();
    }

    function apply() {
      track.style.transform = 'translate3d(' + offset + 'px,0,0)';
    }

    function normalize() {
      if (!loop) {
        clampOffset();
        return;
      }
      if (offset <= -setWidth * 2) offset += setWidth;
      if (offset >= 0) offset -= setWidth;
    }

    function tick() {
      if (!paused && !dragging && !REDUCED) {
        offset -= autoSpeed;
        normalize();
        apply();
      }
      rafId = window.requestAnimationFrame(tick);
    }

    // Perf: only run the rAF auto-scroll while the carousel is on-screen and the
    // tab is visible. Animation is invisible when offscreen/hidden, so this is
    // visually identical but eliminates the always-on main-thread loop.
    function startLoop() {
      if (rafId || !loop || REDUCED) return;
      rafId = window.requestAnimationFrame(tick);
    }

    function stopLoop() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function nudge(dx) {
      offset += dx;
      normalize();
      apply();
    }

    root.addEventListener('mouseenter', function () {
      paused = true;
    });
    root.addEventListener('mouseleave', function () {
      paused = false;
      dragging = false;
    });

    root.addEventListener(
      'wheel',
      function (e) {
        if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
        e.preventDefault();
        nudge(-e.deltaY * 0.6);
      },
      { passive: false }
    );

    viewport.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      dragStartX = e.clientX;
      dragStartOffset = offset;
      viewport.setPointerCapture(e.pointerId);
      track.classList.add('is-dragging');
    });

    viewport.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      offset = dragStartOffset + (e.clientX - dragStartX);
      if (!loop) clampOffset();
      apply();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      normalize();
      apply();
      try {
        viewport.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    var prev = root.querySelector('[data-arc-prev]');
    var next = root.querySelector('[data-arc-next]');
    if (prev) {
      prev.addEventListener('click', function () {
        nudge(280);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        nudge(-280);
      });
    }

    measure();

    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 150);
    }
    window.addEventListener('resize', onResize);

    function onVisibility() {
      if (document.hidden) stopLoop();
      else if (visible) startLoop();
    }
    document.addEventListener('visibilitychange', onVisibility);

    if (loop && !REDUCED && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          if (visible && !document.hidden) startLoop();
          else stopLoop();
        },
        { rootMargin: '120px 0px' }
      );
      io.observe(viewport);
    } else if (loop && !REDUCED) {
      startLoop();
    }

    return function destroy() {
      stopLoop();
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (io) {
        io.disconnect();
        io = null;
      }
    };
  }

  function initReveal(root) {
    if (!('IntersectionObserver' in window)) {
      root.classList.add('is-visible');
      return;
    }
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(root);
  }

  function boot(scope) {
    (scope || document).querySelectorAll('[data-arc-root]').forEach(function (root) {
      if (root.__arcBooted) return;
      root.__arcBooted = true;
      initReveal(root);
      var carousel = root.querySelector('[data-arc-carousel]');
      if (carousel) {
        root.__arcDestroy = initCarousel(carousel);
      }
    });
  }

  boot(document);

  // Theme editor: tear down / re-init cleanly so observers and rAF don't leak.
  document.addEventListener('shopify:section:load', function (e) {
    boot(e.target);
  });
  document.addEventListener('shopify:section:unload', function (e) {
    e.target.querySelectorAll('[data-arc-root]').forEach(function (root) {
      if (typeof root.__arcDestroy === 'function') root.__arcDestroy();
      root.__arcDestroy = null;
      root.__arcBooted = false;
    });
  });
})();
