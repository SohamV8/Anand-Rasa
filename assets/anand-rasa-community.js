/**
 * Anand Rasa Community — showcase carousel (no dependencies)
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initCarousel(root) {
    var viewport = root.querySelector('[data-arc-viewport]');
    var track = root.querySelector('[data-arc-track]');
    if (!viewport || !track) return;

    var originals = Array.prototype.slice.call(track.children);
    if (!originals.length) return;

    originals.forEach(function (node) {
      track.appendChild(node.cloneNode(true));
    });
    originals.slice().reverse().forEach(function (node) {
      track.insertBefore(node.cloneNode(true), track.firstChild);
    });

    var cards = track.children;
    var gap = 0;
    var setWidth = 0;
    var offset = 0;
    var paused = false;
    var dragging = false;
    var dragStartX = 0;
    var dragStartOffset = 0;
    var velocity = 0;
    var rafId = 0;
    var autoSpeed = parseFloat(root.getAttribute('data-arc-speed')) || 0.45;

    function readGap() {
      var style = window.getComputedStyle(track);
      gap = parseFloat(style.columnGap || style.gap) || 16;
    }

    function measure() {
      readGap();
      setWidth = 0;
      for (var i = originals.length; i < originals.length * 2; i++) {
        setWidth += cards[i].offsetWidth + gap;
      }
      offset = -setWidth;
      apply();
    }

    function apply() {
      track.style.transform = 'translate3d(' + offset + 'px,0,0)';
    }

    function normalize() {
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
      apply();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      velocity = 0;
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
    window.addEventListener('resize', measure);
    if (!REDUCED) tick();

    return function () {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measure);
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

  document.querySelectorAll('[data-arc-root]').forEach(function (root) {
    initReveal(root);
    initCarousel(root.querySelector('[data-arc-carousel]'));
  });
})();
