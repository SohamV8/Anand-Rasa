/**
 * Brand Experience Videos — shared library
 * @namespace window.Bev
 */
(function (global) {
  'use strict';

  const Bev = global.Bev || {};

  Bev.CONST = {
    EMBED_ORIGIN: 'https://www.youtube-nocookie.com',
    SPEED_BASE: 0.118,
    TARGET_FPS: 60,
    SYNC_INTERVAL: 6,
    PRELOAD_AHEAD: 4,
    DESTROY_BEHIND: 5,
    EASE: 'cubic-bezier(0.22, 1, 0.36, 1)',
    SPRING: 'cubic-bezier(0.34, 1.28, 0.64, 1)',
    YT_PLAYING: 1,
    YT_BUFFERING: 3
  };

  Bev.util = {
    clamp(v, min, max) {
      return Math.min(max, Math.max(min, v));
    },

    prefersReducedMotion() {
      return global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    debug() {
      return new URLSearchParams(global.location.search).has('bevDebug');
    },

    log(...args) {
      if (Bev.util.debug()) global.console.log('[BEV]', ...args);
    },

    bindAll(target, entries) {
      const bag = [];
      for (const [el, type, fn, opts] of entries) {
        if (!el || !fn) continue;
        el.addEventListener(type, fn, opts);
        bag.push([el, type, fn, opts]);
      }
      return bag;
    },

    unbindAll(bag) {
      for (const [el, type, fn, opts] of bag) {
        el.removeEventListener(type, fn, opts);
      }
      bag.length = 0;
    },

    focusableWithin(root) {
      return [...root.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((el) => el.offsetParent !== null || el === document.activeElement);
    }
  };

  const ytCmd = (iframe, fn, args) => {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: fn, args: args ?? '' }),
      '*'
    );
  };

  const ytListen = (iframe) => {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
      '*'
    );
  };

  const carouselSrc = (id) => {
    const origin = encodeURIComponent(global.location.origin);
    return `${Bev.CONST.EMBED_ORIGIN}/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&loop=1&playlist=${encodeURIComponent(id)}&playsinline=1&controls=0&modestbranding=1&rel=0&fs=0&iv_load_policy=3&enablejsapi=1&origin=${origin}`;
  };

  /** YouTube IFrame API loader (singleton) — modal only */
  Bev.YouTubeAPI = (function () {
    let promise = null;

    function load() {
      if (promise) return promise;
      promise = new Promise((resolve) => {
        if (global.YT && global.YT.Player) {
          resolve(global.YT);
          return;
        }
        const prev = global.onYouTubeIframeAPIReady;
        global.onYouTubeIframeAPIReady = function () {
          if (typeof prev === 'function') prev();
          resolve(global.YT);
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      });
      return promise;
    }

    return { load };
  })();

  /**
   * Pooled iframe players — one iframe per videoId, moved between card slots.
   * Posters stay visible until YT reports PLAYING.
   */
  Bev.VideoPool = class VideoPool {
    #staging;
    #entries = new Map();
    #onMessage;

    constructor(root) {
      this.#staging = document.createElement('div');
      this.#staging.className = 'bev-pool';
      this.#staging.hidden = true;
      this.#staging.setAttribute('aria-hidden', 'true');
      root.appendChild(this.#staging);

      this.#onMessage = (e) => this.#handleMessage(e);
      global.addEventListener('message', this.#onMessage);
    }

    #handleMessage(e) {
      let entry = null;
      for (const candidate of this.#entries.values()) {
        if (candidate.iframe.contentWindow === e.source) {
          entry = candidate;
          break;
        }
      }
      if (!entry) return;

      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      if (data.event !== 'infoDelivery' || !data.info) return;

      const { playerState } = data.info;
      if (playerState === Bev.CONST.YT_PLAYING || playerState === Bev.CONST.YT_BUFFERING) {
        this.#markPlaying(entry);
      }
    }

    #markPlaying(entry) {
      if (!entry.card || !entry.slot) return;
      entry.playing = true;
      entry.card.classList.remove('is-loading');
      entry.card.classList.add('is-ready', 'is-playing');
      Bev.util.log('playing', entry.videoId, entry.card.dataset.videoId);
    }

    #markError(entry) {
      entry.card?.classList.remove('is-loading', 'is-ready', 'is-playing');
      Bev.util.log('error', entry.videoId);
    }

    #parkEntry(entry) {
      if (!entry.slot) return;

      try {
        ytCmd(entry.iframe, 'pauseVideo');
      } catch (_) {
        /* noop */
      }

      this.#staging.appendChild(entry.iframe);
      entry.card?.classList.remove('is-ready', 'is-loading', 'is-playing');
      entry.slot = null;
      entry.card = null;
      entry.playing = false;
    }

    #ensureEntry(videoId) {
      let entry = this.#entries.get(videoId);
      if (entry) return entry;

      const iframe = document.createElement('iframe');
      iframe.className = 'bev-card__iframe';
      iframe.title = 'Brand experience video';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.tabIndex = -1;
      iframe.setAttribute('loading', 'eager');

      entry = {
        videoId,
        iframe,
        loaded: false,
        playing: false,
        slot: null,
        card: null
      };

      iframe.addEventListener(
        'load',
        () => {
          entry.loaded = true;
          ytListen(iframe);
          ytCmd(iframe, 'mute');
          ytCmd(iframe, 'playVideo');
          Bev.util.log('iframe load', videoId);

          global.setTimeout(() => {
            if (entry.slot && !entry.playing) {
              ytListen(iframe);
              ytCmd(iframe, 'mute');
              ytCmd(iframe, 'playVideo');
            }
          }, 500);

          global.setTimeout(() => {
            if (entry.slot && !entry.playing) {
              ytCmd(iframe, 'playVideo');
            }
          }, 1500);
        },
        { once: true }
      );

      iframe.addEventListener(
        'error',
        () => this.#markError(entry),
        { once: true }
      );

      iframe.src = carouselSrc(videoId);
      this.#staging.appendChild(iframe);
      this.#entries.set(videoId, entry);

      Bev.util.log('create iframe', videoId);
      return entry;
    }

    attach(videoId, embedEl, cardEl) {
      const entry = this.#ensureEntry(videoId);

      if (entry.slot === embedEl) {
        if (entry.loaded) {
          ytListen(entry.iframe);
          ytCmd(entry.iframe, 'mute');
          ytCmd(entry.iframe, 'playVideo');
          if (entry.playing) this.#markPlaying(entry);
        }
        return entry;
      }

      if (entry.slot) {
        this.#parkEntry(entry);
      }

      cardEl.classList.add('is-loading');
      cardEl.classList.remove('is-ready', 'is-playing');
      embedEl.appendChild(entry.iframe);
      entry.slot = embedEl;
      entry.card = cardEl;
      entry.playing = false;

      if (entry.loaded) {
        ytListen(entry.iframe);
        ytCmd(entry.iframe, 'mute');
        ytCmd(entry.iframe, 'playVideo');
      }

      Bev.util.log('attach', videoId, 'loaded=', entry.loaded, 'playing=', entry.playing);
      return entry;
    }

    detachSlot(embedEl) {
      for (const entry of this.#entries.values()) {
        if (entry.slot === embedEl) {
          this.#parkEntry(entry);
          return;
        }
      }
    }

    detachAll() {
      for (const entry of [...this.#entries.values()]) {
        if (entry.slot) this.#parkEntry(entry);
      }
    }

    destroy() {
      global.removeEventListener('message', this.#onMessage);
      for (const entry of this.#entries.values()) {
        entry.iframe.remove();
      }
      this.#entries.clear();
      this.#staging.remove();
    }
  };

  global.Bev = Bev;
})(window);
