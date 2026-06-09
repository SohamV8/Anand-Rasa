(function () {
  'use strict';

  if (window.__pmeInit) return;
  window.__pmeInit = true;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealFrame(frame) {
    if (!frame || frame.classList.contains('is-visible')) return;
    frame.classList.add('is-visible');
  }

  function buildEmbedUrl(videoId) {
    var origin = window.location.origin;
    return (
      'https://www.youtube.com/embed/' +
      encodeURIComponent(videoId) +
      '?autoplay=1&mute=1&loop=1&playlist=' +
      encodeURIComponent(videoId) +
      '&controls=0&modestbranding=1&rel=0&fs=0&playsinline=1' +
      '&enablejsapi=1&origin=' +
      encodeURIComponent(origin) +
      '&disablekb=1&iv_load_policy=3&cc_load_policy=0&autohide=1'
    );
  }

  function ytCommand(iframe, func, args) {
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func: func,
        args: args || ''
      }),
      '*'
    );
  }

  function initReel(reel) {
    if (!reel || reel.dataset.pmeReelInit === 'true') return;
    reel.dataset.pmeReelInit = 'true';

    var videoId = reel.getAttribute('data-pme-youtube');
    var mediaHost = reel.querySelector('[data-pme-media]');
    var soundBtn = reel.querySelector('[data-pme-sound]');
    var hint = reel.querySelector('[data-pme-sound-hint]');
    var iframe = null;
    var isLoaded = false;
    var isUnmuted = false;
    var pendingUnmute = false;

    if (!videoId || !mediaHost) return;

    function setMuted(muted) {
      if (!iframe) return;
      ytCommand(iframe, muted ? 'mute' : 'unMute');
      isUnmuted = !muted;
      reel.classList.toggle('is-unmuted', isUnmuted);
      if (soundBtn) {
        soundBtn.setAttribute(
          'aria-label',
          muted ? soundBtn.getAttribute('data-pme-label-unmute') : soundBtn.getAttribute('data-pme-label-mute')
        );
      }
      if (hint) {
        hint.textContent = muted ? 'Tap for sound' : '';
      }
    }

    function loadIframe() {
      if (isLoaded) return;
      isLoaded = true;

      iframe = document.createElement('iframe');
      iframe.setAttribute('title', 'Mantra chanting reel');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', 'false');
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('tabindex', '-1');
      iframe.src = buildEmbedUrl(videoId);

      iframe.addEventListener('load', function () {
        reel.classList.add('is-loaded');
        setMuted(!pendingUnmute);
        pendingUnmute = false;
        ytCommand(iframe, 'playVideo');
      });

      mediaHost.hidden = false;
      mediaHost.appendChild(iframe);
    }

    if (soundBtn) {
      soundBtn.setAttribute('data-pme-label-unmute', soundBtn.getAttribute('aria-label') || 'Enable sound');
      soundBtn.setAttribute('data-pme-label-mute', 'Mute mantra reel');

      soundBtn.addEventListener('click', function () {
        if (!iframe) {
          pendingUnmute = true;
          loadIframe();
          return;
        }
        setMuted(isUnmuted);
      });

      soundBtn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          soundBtn.click();
        }
      });
    }

    if ('IntersectionObserver' in window) {
      var mediaObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              loadIframe();
              if (iframe) {
                ytCommand(iframe, 'playVideo');
                if (!isUnmuted) setMuted(true);
              }
            } else if (iframe) {
              setMuted(true);
              isUnmuted = false;
              reel.classList.remove('is-unmuted');
            }
          });
        },
        { root: null, threshold: 0.25 }
      );

      mediaObserver.observe(reel);
      return;
    }

    loadIframe();
  }

  function initSection(section) {
    if (!section || section.dataset.pmeSectionInit === 'true') return;
    section.dataset.pmeSectionInit = 'true';

    var frame = section.querySelector('[data-pme-reveal]');
    var reel = section.querySelector('[data-pme-reel]');

    if (reel) initReel(reel);

    if (!frame) return;

    if (reduced || !('IntersectionObserver' in window)) {
      revealFrame(frame);
      return;
    }

    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealFrame(entry.target);
          revealObserver.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
    );

    revealObserver.observe(frame);
  }

  function boot(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-pme-section]').forEach(initSection);
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
