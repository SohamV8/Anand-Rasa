/**
 * Premium Collections — interactions
 */
(function () {
  'use strict';

  var RIPPLE_STYLE_ID = 'pcl-ripple-style';

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setPillState(pills, activePill, root) {
    pills.forEach(function (pill) {
      var isActive = pill === activePill;
      pill.classList.toggle('is-active', isActive);
      pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
      pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      pill.tabIndex = isActive ? 0 : -1;
    });
    if (root && activePill && activePill.id) {
      var panel = root.querySelector('[role="tabpanel"]');
      if (panel) panel.setAttribute('aria-labelledby', activePill.id);
    }
  }

  function applyFilter(root, filter) {
    var cards = root.querySelectorAll('.js-pcl-card');
    cards.forEach(function (card) {
      if (filter === 'all') {
        card.classList.remove('is-filtered');
        card.removeAttribute('hidden');
        return;
      }
      var groups = (card.dataset.groups || '')
        .split(',')
        .map(function (g) {
          return g.trim();
        })
        .filter(Boolean);
      var match = groups.indexOf(filter) !== -1;
      card.classList.toggle('is-filtered', !match);
      if (match) {
        card.removeAttribute('hidden');
      } else {
        card.setAttribute('hidden', '');
      }
    });
  }

  function destroyPcl(root) {
    if (!root || !root._pclCleanup) return;
    root._pclCleanup.forEach(function (fn) {
      try {
        fn();
      } catch (err) {
        /* noop */
      }
    });
    root._pclCleanup = [];
    delete root.dataset.pclInited;
  }

  function initPcl(root) {
    if (!root || root.dataset.pclInited === 'true') return;
    root.dataset.pclInited = 'true';
    root._pclCleanup = [];

    var reduced = prefersReducedMotion();
    root.classList.add('pcl--animate', 'is-loading');

    requestAnimationFrame(function () {
      root.classList.remove('is-loading');
      root.classList.add('is-ready');
    });

    if ('IntersectionObserver' in window && !reduced) {
      var ioOpts = { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.08 };

      var grid = root.querySelector('.js-pcl-masonry');
      if (grid) {
        var gridObserver = new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            root.classList.add('is-grid-visible');
            obs.unobserve(e.target);
          });
        }, ioOpts);
        gridObserver.observe(grid);
        root._pclCleanup.push(function () {
          gridObserver.disconnect();
        });
      } else {
        root.classList.add('is-grid-visible');
      }

      [
        ['.js-pcl-features', 'is-features-visible'],
        ['.js-pcl-finder', 'is-finder-visible'],
        ['.js-pcl-trust', 'is-trust-visible']
      ].forEach(function (pair) {
        var el = root.querySelector(pair[0]);
        if (!el) {
          root.classList.add(pair[1]);
          return;
        }
        var observer = new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            root.classList.add(pair[1]);
            obs.unobserve(e.target);
          });
        }, ioOpts);
        observer.observe(el);
        root._pclCleanup.push(function () {
          observer.disconnect();
        });
      });
    } else {
      root.classList.add(
        'is-grid-visible',
        'is-features-visible',
        'is-quote-visible',
        'is-finder-visible',
        'is-trust-visible'
      );
    }

    var heroImg = root.querySelector('.js-pcl-hero-img');
    if (heroImg && !reduced && window.matchMedia && window.matchMedia('(min-width: 900px)').matches) {
      var heroVisual = heroImg.closest('.pcl-hero__visual');
      var ticking = false;
      var onScroll = function () {
        if (ticking || !heroVisual) return;
        ticking = true;
        requestAnimationFrame(function () {
          var rect = heroVisual.getBoundingClientRect();
          var vh = window.innerHeight || document.documentElement.clientHeight;
          if (rect.bottom > 0 && rect.top < vh) {
            var p = (rect.top + rect.height * 0.5 - vh * 0.5) / vh;
            heroImg.style.transform = 'translateY(' + p * -8 + 'px)';
          }
          ticking = false;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      root._pclCleanup.push(function () {
        window.removeEventListener('scroll', onScroll);
        heroImg.style.transform = '';
      });
    }

    var pills = Array.prototype.slice.call(root.querySelectorAll('.js-pcl-pill'));
    var cards = root.querySelectorAll('.js-pcl-card');

    if (pills.length && cards.length) {
      setPillState(pills, pills[0], root);

      pills.forEach(function (pill, index) {
        pill.addEventListener('click', function () {
          var filter = pill.dataset.filter || 'all';
          setPillState(pills, pill, root);
          applyFilter(root, filter);
        });

        pill.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          var delta = e.key === 'ArrowRight' ? 1 : -1;
          var next = (index + delta + pills.length) % pills.length;
          pills[next].focus();
          pills[next].click();
        });
      });
    }

    if (!reduced && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      root.querySelectorAll('.js-pcl-magnetic').forEach(function (btn) {
        var link = btn.closest('.pcl-card__link');
        if (!link) return;

        var onMove = function (e) {
          var rect = btn.getBoundingClientRect();
          var cx = rect.left + rect.width / 2;
          var cy = rect.top + rect.height / 2;
          var dx = (e.clientX - cx) * 0.22;
          var dy = (e.clientY - cy) * 0.22;
          btn.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(1.06)';
        };
        var onLeave = function () {
          btn.style.transform = '';
        };

        link.addEventListener('mousemove', onMove);
        link.addEventListener('mouseleave', onLeave);
        root._pclCleanup.push(function () {
          link.removeEventListener('mousemove', onMove);
          link.removeEventListener('mouseleave', onLeave);
          btn.style.transform = '';
        });
      });
    }

    if (!reduced) {
      pills.forEach(function (pill) {
        var onRipple = function (e) {
          var ripple = document.createElement('span');
          ripple.className = 'pcl-pill__ripple';
          ripple.style.cssText =
            'position:absolute;border-radius:50%;background:rgba(201,169,110,0.25);pointer-events:none;transform:scale(0);animation:pcl-ripple 0.5s ease forwards;';
          var rect = pill.getBoundingClientRect();
          var size = Math.max(rect.width, rect.height);
          ripple.style.width = ripple.style.height = size + 'px';
          ripple.style.left = e.clientX - rect.left - size / 2 + 'px';
          ripple.style.top = e.clientY - rect.top - size / 2 + 'px';
          pill.style.position = 'relative';
          pill.style.overflow = 'hidden';
          pill.appendChild(ripple);
          window.setTimeout(function () {
            ripple.remove();
          }, 500);
        };
        pill.addEventListener('click', onRipple);
        root._pclCleanup.push(function () {
          pill.removeEventListener('click', onRipple);
        });
      });
    }
  }

  function boot() {
    document.querySelectorAll('.js-pcl').forEach(initPcl);
  }

  if (!document.getElementById(RIPPLE_STYLE_ID)) {
    var style = document.createElement('style');
    style.id = RIPPLE_STYLE_ID;
    style.textContent = '@keyframes pcl-ripple{to{transform:scale(2.5);opacity:0}}';
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (e) {
    if (!e.detail || !e.detail.sectionId) return;
    var section = document.getElementById('pcl-' + e.detail.sectionId);
    if (!section || !section.classList.contains('js-pcl')) return;
    destroyPcl(section);
    initPcl(section);
  });

  document.addEventListener('shopify:section:unload', function (e) {
    if (!e.detail || !e.detail.sectionId) return;
    var section = document.getElementById('pcl-' + e.detail.sectionId);
    if (section) destroyPcl(section);
  });
})();
