/**
 * Hero Vanta — official VANTA.CLOUDS (three.js r134 + vanta 0.5.24).
 */
(function () {
  'use strict';

  var instances = new WeakMap();
  var pendingObservers = new WeakMap();
  var resizeTimer = null;
  var DEBUG = /[?&]vantaDebug=1(?:&|$)/.test(window.location.search);

  function cloudOptions(hero) {
    return {
      el: hero,
      mouseControls: false,
      touchControls: false,
      gyroControls: false,
      speed: 0.72,
      scale: 3,
      scaleMobile: 12,
      backgroundColor: 0xeaf2f8,
      skyColor: 0x6eb0d4,
      cloudColor: 0xd0dae6,
      cloudShadowColor: 0x3f566c,
      sunColor: 0xffa81e,
      sunGlareColor: 0xff9028,
      sunlightColor: 0xffcc55
    };
  }

  function heroesIn(root) {
    var scope = root && root.querySelectorAll ? root : document;
    return scope.querySelectorAll('.hero-vanta');
  }

  function log() {
    if (!DEBUG) return;
    var args = ['[hero-vanta]'].concat([].slice.call(arguments));
    console.log.apply(console, args);
  }

  function animateContent(hero) {
    if (hero.dataset.heroContentAnimated === 'true') return;
    hero.dataset.heroContentAnimated = 'true';
    hero.classList.add('is-animated');
  }

  function useFallback(hero) {
    hero.classList.remove('hero-vanta--ready');
    hero.classList.add('hero-vanta--fallback');
    hero.dataset.heroVantaInit = 'true';
    animateContent(hero);
  }

  function initHero(hero) {
    if (hero.dataset.heroVantaInit === 'true' || !hero.isConnected) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      useFallback(hero);
      return;
    }

    if (!window.THREE || !window.VANTA || typeof window.VANTA.CLOUDS !== 'function') {
      useFallback(hero);
      return;
    }

    if (hero.offsetWidth < 1 || hero.offsetHeight < 1) {
      return;
    }

    try {
      var effect = window.VANTA.CLOUDS(cloudOptions(hero));

      if (!effect || !effect.renderer) {
        useFallback(hero);
        return;
      }

      instances.set(hero, effect);
      hero.dataset.heroVantaInit = 'true';
      hero.classList.add('hero-vanta--ready');
      hero.classList.remove('hero-vanta--fallback');

      requestAnimationFrame(function () {
        if (typeof effect.resize === 'function') {
          effect.resize();
        }
        if (DEBUG) {
          log('THREE.REVISION', window.THREE.REVISION);
          log('uniforms', effect.uniforms);
        }
      });

      animateContent(hero);
    } catch (err) {
      log('init error', err);
      useFallback(hero);
    }
  }

  function disconnectPending(hero) {
    var observer = pendingObservers.get(hero);
    if (observer) {
      observer.disconnect();
      pendingObservers.delete(hero);
    }
  }

  function destroyHero(hero) {
    disconnectPending(hero);

    var effect = instances.get(hero);
    if (effect && typeof effect.destroy === 'function') {
      try {
        effect.destroy();
      } catch (err) {
        log('destroy error', err);
      }
    }

    instances.delete(hero);
    hero.removeAttribute('data-hero-vanta-init');
    hero.classList.remove('hero-vanta--ready', 'hero-vanta--fallback');
  }

  function queueHero(hero) {
    if (hero.dataset.heroVantaInit === 'true') return;

    disconnectPending(hero);

    function run() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          initHero(hero);
        });
      });
    }

    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            disconnectPending(hero);
            run();
          }
        });
      }, { rootMargin: '80px 0px', threshold: 0.01 });

      io.observe(hero);
      pendingObservers.set(hero, io);
    } else {
      run();
    }
  }

  function boot(root) {
    heroesIn(root).forEach(queueHero);
  }

  function bindEvents() {
    if (document.documentElement.dataset.heroVantaBound === 'true') return;
    document.documentElement.dataset.heroVantaBound = 'true';

    document.addEventListener('shopify:section:load', function (event) {
      boot(event.target);
    });

    document.addEventListener('shopify:section:unload', function (event) {
      heroesIn(event.target).forEach(destroyHero);
    });

    window.addEventListener('resize', function () {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(function () {
        heroesIn(document).forEach(function (hero) {
          var effect = instances.get(hero);
          if (effect && typeof effect.resize === 'function') {
            effect.resize();
          }
        });
      }, 150);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      heroesIn(document).forEach(function (hero) {
        var effect = instances.get(hero);
        if (effect && typeof effect.animationLoop === 'function' && !effect.req) {
          effect.animationLoop();
        }
      });
    });
  }

  window.addEventListener('load', function () {
    bindEvents();
    boot(document);
  });
})();
