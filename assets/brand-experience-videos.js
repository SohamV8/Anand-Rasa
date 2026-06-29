/**
 * Brand Experience Videos — 3D infinite carousel
 */
(function () {
  'use strict';

  const EMBED = 'https://www.youtube-nocookie.com/embed/';
  const SPEED_MULT = 0.118; /* ~31% faster than 0.09 */
  const registry = new WeakMap();

  const ytCmd = (iframe, fn, args) => {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: fn, args: args ?? '' }),
      '*'
    );
  };

  const carouselSrc = (id) =>
    `${EMBED}${encodeURIComponent(id)}?autoplay=1&mute=1&loop=1&playlist=${encodeURIComponent(id)}&playsinline=1&controls=0&modestbranding=1&rel=0&fs=0&iv_load_policy=3&enablejsapi=1`;

  const modalSrc = (id, muted) =>
    `${EMBED}${encodeURIComponent(id)}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${encodeURIComponent(id)}&playsinline=1&controls=1&modestbranding=1&rel=0&fs=1&enablejsapi=1`;

  class BrandVideos {
    #root;
    #rail;
    #viewport;
    #firstRow;
    #dialog;
    #player;
    #audioBtn;
    #fsBtn;
    #cards = [];
    #metrics = { cardW: 0, gap: 0, step: 0, rowW: 0, mid: 0, viewW: 0 };
    #offset = 0;
    #speed = 0;
    #scrollOn = true;
    #playOn = true;
    #reduced = false;
    #hoverPause = false;
    #offscreen = false;
    #modalOpen = false;
    #modalMuted = true;
    #modalIframe = null;
    #modalPoster = null;
    #mounted = new Set();
    #visibleSig = '';
    #raf = 0;
    #visibleIo = null;
    #headerIo = null;
    #onResize = null;
    #onEsc = null;
    #listeners = [];

    constructor(root) {
      this.#root = root;
      this.#rail = root.querySelector('[data-brand-videos-rail]');
      this.#viewport = root.querySelector('[data-brand-videos-viewport]');
      this.#firstRow = root.querySelector('[data-brand-videos-row]');
      this.#dialog = root.querySelector('[data-brand-videos-dialog]');
      this.#player = root.querySelector('[data-brand-videos-player]');
      this.#audioBtn = root.querySelector('[data-brand-videos-audio]');
      this.#fsBtn = root.querySelector('[data-brand-videos-fs]');
      this.#cards = [...root.querySelectorAll('[data-brand-videos-card][data-video-id]')];
    }

    #on(el, type, fn, opts) {
      el.addEventListener(type, fn, opts);
      this.#listeners.push([el, type, fn, opts]);
    }

    #readMetrics() {
      const m = this.#metrics;
      const card = this.#cards[0];
      if (!card) return;

      m.cardW = card.offsetWidth;
      m.gap = parseFloat(getComputedStyle(this.#firstRow).gap) || 10;
      m.step = m.cardW + m.gap;
      m.rowW = this.#firstRow.offsetWidth;
      m.viewW = this.#viewport.clientWidth;
      m.mid = m.viewW * 0.5;

      if (m.rowW > 0) {
        while (this.#offset >= m.rowW) this.#offset -= m.rowW;
        while (this.#offset < 0) this.#offset += m.rowW;
      }
    }

    #wrap() {
      const { rowW } = this.#metrics;
      if (rowW <= 0) return;
      while (this.#offset >= rowW) this.#offset -= rowW;
      while (this.#offset < 0) this.#offset += rowW;
    }

    #layout3d() {
      const { cardW, step, mid } = this.#metrics;
      if (!cardW) return;

      const flat = this.#reduced;

      for (let i = 0, n = this.#cards.length; i < n; i++) {
        const card = this.#cards[i];
        const x = i * step + cardW * 0.5 - this.#offset;
        const dist = (x - mid) / step;
        const a = Math.abs(dist);

        if (flat) {
          card.style.transform = `scale(${Math.max(0.86, 1 - a * 0.06)})`;
        } else {
          const rot = dist * -18;
          const scale = Math.max(0.76, 1 - a * 0.062);
          const z = -a * 44;
          card.style.transform = `rotateY(${rot}deg) scale(${scale}) translateZ(${z}px)`;
        }

        card.style.opacity = String(Math.max(0.55, 1 - a * 0.16));
        card.style.zIndex = String(100 - Math.round(a * 8));
        card.classList.toggle('is-center', a < 0.45);
      }
    }

    #visibleIndices() {
      const { cardW, step, viewW, gap } = this.#metrics;
      if (!cardW) return [];

      const pad = gap * 0.5;
      const out = [];

      for (let i = 0, n = this.#cards.length; i < n; i++) {
        const left = i * step - this.#offset;
        const right = left + cardW;
        if (right > -pad && left < viewW + pad) out.push(i);
      }

      return out;
    }

    #unmountCard(idx) {
      if (!this.#mounted.has(idx)) return;
      const card = this.#cards[idx];
      const embed = card?.querySelector('[data-brand-videos-embed]');
      if (embed) embed.replaceChildren();
      card?.classList.remove('is-ready', 'is-loading');
      this.#mounted.delete(idx);
    }

    #mountCard(idx) {
      if (!this.#playOn || this.#modalOpen || this.#offscreen || this.#mounted.has(idx)) return;

      const card = this.#cards[idx];
      const embed = card?.querySelector('[data-brand-videos-embed]');
      const id = card?.dataset.videoId;
      if (!embed || !id) return;

      card.classList.add('is-loading');

      const iframe = document.createElement('iframe');
      iframe.src = carouselSrc(id);
      iframe.title = card.dataset.videoTitle || 'Brand experience video';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.loading = 'lazy';
      iframe.tabIndex = -1;

      iframe.addEventListener(
        'load',
        () => {
          card.classList.remove('is-loading');
          card.classList.add('is-ready');
          ytCmd(iframe, 'playVideo');
        },
        { once: true }
      );

      embed.appendChild(iframe);
      this.#mounted.add(idx);
    }

    #clearAllEmbeds() {
      for (const idx of [...this.#mounted]) this.#unmountCard(idx);
      this.#visibleSig = '';
    }

    #syncVideos() {
      if (!this.#playOn || this.#modalOpen || this.#offscreen) {
        if (this.#mounted.size) this.#clearAllEmbeds();
        return;
      }

      const visible = this.#visibleIndices();
      const sig = visible.join(',');

      if (sig === this.#visibleSig) return;
      this.#visibleSig = sig;

      const want = new Set(visible);

      for (const idx of this.#mounted) {
        if (!want.has(idx)) this.#unmountCard(idx);
      }

      for (const idx of visible) {
        this.#mountCard(idx);
      }
    }

    #tick = () => {
      if (this.#speed > 0 && this.#scrollOn && !this.#hoverPause && !this.#offscreen && !this.#modalOpen) {
        this.#offset += this.#speed;
        this.#wrap();
      }

      this.#rail.style.transform = `translate3d(${-this.#offset}px,0,0)`;
      this.#layout3d();
      this.#syncVideos();
      this.#raf = requestAnimationFrame(this.#tick);
    };

    #openModal(id, title, posterSrc) {
      this.#modalOpen = true;
      this.#clearAllEmbeds();

      this.#dialog.hidden = false;
      this.#dialog.removeAttribute('aria-hidden');
      this.#dialog.classList.remove('is-playing');
      requestAnimationFrame(() => this.#dialog.classList.add('is-active'));
      document.body.style.overflow = 'hidden';

      this.#modalMuted = true;
      this.#player.replaceChildren();

      if (posterSrc) {
        this.#modalPoster = document.createElement('img');
        this.#modalPoster.className = 'bev-dialog__poster';
        this.#modalPoster.src = posterSrc;
        this.#modalPoster.alt = '';
        this.#modalPoster.width = 480;
        this.#modalPoster.height = 854;
        this.#player.appendChild(this.#modalPoster);
      }

      this.#modalIframe = document.createElement('iframe');
      this.#modalIframe.src = modalSrc(id, true);
      this.#modalIframe.title = title || 'Brand experience video';
      this.#modalIframe.allow = 'autoplay; encrypted-media; fullscreen';
      this.#modalIframe.allowFullscreen = true;
      this.#modalIframe.addEventListener(
        'load',
        () => {
          this.#dialog.classList.add('is-playing');
          ytCmd(this.#modalIframe, 'playVideo');
        },
        { once: true }
      );
      this.#player.appendChild(this.#modalIframe);

      this.#audioBtn?.classList.remove('is-on');
      this.#audioBtn?.setAttribute('aria-pressed', 'false');
      this.#audioBtn?.setAttribute('aria-label', 'Unmute video');
      this.#dialog.querySelector('.bev-dialog__x')?.focus();
    }

    #closeModal() {
      if (!this.#modalOpen) return;
      this.#modalOpen = false;
      this.#dialog.classList.remove('is-active', 'is-playing');
      this.#dialog.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      if (this.#modalIframe) {
        ytCmd(this.#modalIframe, 'pauseVideo');
        this.#modalIframe = null;
      }
      this.#modalPoster = null;
      this.#player.replaceChildren();
      this.#visibleSig = '';

      window.setTimeout(() => {
        if (!this.#modalOpen) this.#dialog.hidden = true;
      }, 360);
    }

    #toggleAudio() {
      if (!this.#modalIframe || !this.#audioBtn) return;
      this.#modalMuted = !this.#modalMuted;

      if (this.#modalMuted) {
        ytCmd(this.#modalIframe, 'mute');
        this.#audioBtn.classList.remove('is-on');
        this.#audioBtn.setAttribute('aria-pressed', 'false');
        this.#audioBtn.setAttribute('aria-label', 'Unmute video');
      } else {
        ytCmd(this.#modalIframe, 'unMute');
        ytCmd(this.#modalIframe, 'setVolume', [100]);
        ytCmd(this.#modalIframe, 'playVideo');
        this.#audioBtn.classList.add('is-on');
        this.#audioBtn.setAttribute('aria-pressed', 'true');
        this.#audioBtn.setAttribute('aria-label', 'Mute video');
      }
    }

    #enterFullscreen() {
      const target = this.#player;
      if (!target) return;
      const fn =
        target.requestFullscreen ||
        target.webkitRequestFullscreen ||
        target.msRequestFullscreen;
      if (fn) fn.call(target);
    }

    mount() {
      if (!this.#rail || !this.#cards.length) return;

      const speedRaw = parseFloat(this.#root.dataset.speed || '4');
      this.#scrollOn = this.#root.dataset.scroll !== 'false';
      this.#playOn = this.#root.dataset.play !== 'false';
      this.#reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.#speed = this.#reduced || !this.#scrollOn ? 0 : Math.max(0, speedRaw) * SPEED_MULT;

      this.#readMetrics();
      if (this.#metrics.rowW > 0) this.#offset = this.#metrics.rowW * 0.5;

      this.#onResize = (() => {
        let t = 0;
        return () => {
          const now = Date.now();
          if (now - t < 200) return;
          t = now;
          this.#readMetrics();
          this.#visibleSig = '';
        };
      })();
      this.#on(window, 'resize', this.#onResize, { passive: true });

      if (window.matchMedia('(hover: hover)').matches) {
        this.#on(this.#root, 'mouseenter', () => {
          this.#hoverPause = true;
        });
        this.#on(this.#root, 'mouseleave', () => {
          this.#hoverPause = false;
        });
      }

      this.#on(this.#viewport, 'keydown', (e) => {
        if (this.#modalOpen) return;
        const { step } = this.#metrics;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.#offset -= step;
          this.#wrap();
          this.#visibleSig = '';
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.#offset += step;
          this.#wrap();
          this.#visibleSig = '';
        }
      });

      this.#cards.forEach((card) => {
        const btn = card.querySelector('[data-brand-videos-open]');
        if (!btn) return;
        this.#on(btn, 'click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = card.dataset.videoId;
          const poster = card.querySelector('.bev-card__poster');
          if (id) this.#openModal(id, card.dataset.videoTitle, poster?.src);
        });
      });

      this.#root.querySelectorAll('[data-brand-videos-close]').forEach((el) => {
        this.#on(el, 'click', () => this.#closeModal());
      });

      if (this.#audioBtn) this.#on(this.#audioBtn, 'click', () => this.#toggleAudio());
      if (this.#fsBtn) this.#on(this.#fsBtn, 'click', () => this.#enterFullscreen());

      this.#onEsc = (e) => {
        if (e.key === 'Escape' && this.#modalOpen) this.#closeModal();
      };
      this.#on(document, 'keydown', this.#onEsc);

      if ('IntersectionObserver' in window) {
        this.#visibleIo = new IntersectionObserver(
          ([entry]) => {
            this.#offscreen = !entry.isIntersecting;
            if (this.#offscreen) this.#clearAllEmbeds();
            else this.#visibleSig = '';
          },
          { threshold: 0.06 }
        );
        this.#visibleIo.observe(this.#root);
      }

      const header = this.#root.querySelector('[data-brand-videos-header]');
      if (header) {
        if ('IntersectionObserver' in window) {
          this.#headerIo = new IntersectionObserver(
            ([entry]) => {
              if (!entry.isIntersecting) return;
              header.classList.add('is-revealed');
              this.#headerIo?.disconnect();
              this.#headerIo = null;
            },
            { threshold: 0.35, rootMargin: '0px 0px -8% 0px' }
          );
          this.#headerIo.observe(header);
        } else {
          header.classList.add('is-revealed');
        }
      }

      this.#raf = requestAnimationFrame(this.#tick);
    }

    destroy() {
      cancelAnimationFrame(this.#raf);
      this.#visibleIo?.disconnect();
      this.#headerIo?.disconnect();
      this.#clearAllEmbeds();
      this.#closeModal();

      for (const [el, type, fn, opts] of this.#listeners) {
        el.removeEventListener(type, fn, opts);
      }
      this.#listeners.length = 0;
    }
  }

  function init(scope) {
    (scope || document).querySelectorAll('[data-brand-videos]').forEach((root) => {
      registry.get(root)?.destroy();
      const app = new BrandVideos(root);
      registry.set(root, app);
      app.mount();
    });
  }

  function teardown(scope) {
    (scope || document).querySelectorAll('[data-brand-videos]').forEach((root) => {
      registry.get(root)?.destroy();
      registry.delete(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => init(e.target));
  document.addEventListener('shopify:section:unload', (e) => teardown(e.target));
})();
