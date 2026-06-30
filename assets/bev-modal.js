/**
 * Brand Experience Videos — modal player
 */
(function (global) {
  'use strict';

  const { util } = global.Bev;

  global.Bev.ModalPlayer = class ModalPlayer {
    #root;
    #dialog;
    #sheet;
    #player;
    #audioBtn;
    #playBtn;
    #fsBtn;
    #progressWrap;
    #progressBar;
    #progressFill = 0;
    #progressTarget = 0;
    #progressRaf = 0;
    #progressTimer = 0;
    #ytPlayer = null;
    #posterEl = null;
    #open = false;
    #muted = true;
    #playing = true;
    #lastFocus = null;
    #listeners = [];
    #onClose = null;

    constructor({ root, onClose }) {
      this.#root = root;
      this.#dialog = root.querySelector('[data-brand-videos-dialog]');
      this.#sheet = this.#dialog?.querySelector('.bev-dialog__sheet');
      this.#player = root.querySelector('[data-brand-videos-player]');
      this.#audioBtn = root.querySelector('[data-brand-videos-audio]');
      this.#playBtn = root.querySelector('[data-brand-videos-playpause]');
      this.#fsBtn = root.querySelector('[data-brand-videos-fs]');
      this.#progressWrap = root.querySelector('[data-brand-videos-progress-wrap]');
      this.#progressBar = root.querySelector('[data-brand-videos-progress]');
      this.#onClose = onClose;
    }

    get isOpen() {
      return this.#open;
    }

    #on(el, type, fn, opts) {
      el.addEventListener(type, fn, opts);
      this.#listeners.push([el, type, fn, opts]);
    }

    #setPlayUi(playing) {
      this.#playing = playing;
      if (!this.#playBtn) return;
      const pauseIcon = this.#playBtn.querySelector('.bev-dialog__icon-pause');
      const playIcon = this.#playBtn.querySelector('.bev-dialog__icon-play');
      this.#playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      this.#playBtn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
      if (playing) {
        pauseIcon?.removeAttribute('hidden');
        playIcon?.setAttribute('hidden', '');
      } else {
        playIcon?.removeAttribute('hidden');
        pauseIcon?.setAttribute('hidden', '');
      }
    }

    #animateProgress = () => {
      this.#progressFill += (this.#progressTarget - this.#progressFill) * 0.18;
      if (this.#progressBar) {
        this.#progressBar.style.width = `${this.#progressFill}%`;
      }
      if (this.#progressWrap) {
        this.#progressWrap.setAttribute('aria-valuenow', String(Math.round(this.#progressFill)));
      }
      if (this.#open) {
        this.#progressRaf = requestAnimationFrame(this.#animateProgress);
      }
    };

    #trapFocus(e) {
      if (!this.#open || e.key !== 'Tab' || !this.#sheet) return;
      const nodes = util.focusableWithin(this.#sheet);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    async open({ videoId, title, posterSrc, sourceBtn }) {
      const YT = await global.Bev.YouTubeAPI.load();

      this.#lastFocus = document.activeElement;
      this.#open = true;
      this.#muted = true;
      this.#playing = true;

      this.#dialog.hidden = false;
      this.#dialog.removeAttribute('aria-hidden');
      this.#dialog.classList.remove('is-playing', 'is-from-card');
      document.body.classList.add('bev-modal-open');

      if (sourceBtn && this.#sheet) {
        const rect = sourceBtn.getBoundingClientRect();
        this.#sheet.style.setProperty('--bev-origin-x', `${rect.left + rect.width * 0.5}px`);
        this.#sheet.style.setProperty('--bev-origin-y', `${rect.top + rect.height * 0.5}px`);
        this.#sheet.style.setProperty('--bev-origin-w', `${rect.width}px`);
        this.#sheet.style.setProperty('--bev-origin-h', `${rect.height}px`);
        this.#dialog.classList.add('is-from-card');
      }

      this.#player.replaceChildren();
      this.#progressFill = 0;
      this.#progressTarget = 0;

      if (posterSrc) {
        this.#posterEl = document.createElement('img');
        this.#posterEl.className = 'bev-dialog__poster';
        this.#posterEl.src = posterSrc;
        this.#posterEl.alt = '';
        this.#posterEl.decoding = 'async';
        this.#player.appendChild(this.#posterEl);
      }

      if (this.#progressWrap) this.#player.appendChild(this.#progressWrap);

      const host = document.createElement('div');
      host.className = 'bev-dialog__yt-host';
      this.#player.appendChild(host);

      requestAnimationFrame(() => this.#dialog.classList.add('is-active'));

      this.#ytPlayer = new YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          playsinline: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 1,
          enablejsapi: 1,
          origin: global.location.origin
        },
        events: {
          onReady: (e) => {
            e.target.mute();
            e.target.playVideo();
            this.#dialog.classList.add('is-playing');
            this.#setPlayUi(true);
            this.#progressRaf = requestAnimationFrame(this.#animateProgress);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) this.#setPlayUi(true);
            if (e.data === YT.PlayerState.PAUSED) this.#setPlayUi(false);
          }
        }
      });

      this.#dialog.querySelector('.bev-dialog__x')?.focus();

      this.#progressTimer = global.setInterval(() => {
        if (!this.#ytPlayer?.getCurrentTime) return;
        const cur = this.#ytPlayer.getCurrentTime();
        const dur = this.#ytPlayer.getDuration();
        if (dur > 0) this.#progressTarget = (cur / dur) * 100;
      }, 250);
    }

    close() {
      if (!this.#open) return;
      this.#open = false;

      this.#dialog.classList.remove('is-active', 'is-playing', 'is-from-card');
      this.#dialog.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('bev-modal-open');

      clearInterval(this.#progressTimer);
      cancelAnimationFrame(this.#progressRaf);

      try {
        this.#ytPlayer?.destroy();
      } catch (_) {
        /* noop */
      }

      this.#ytPlayer = null;
      this.#posterEl = null;
      this.#player.replaceChildren();

      global.setTimeout(() => {
        if (!this.#open) this.#dialog.hidden = true;
        this.#lastFocus?.focus?.();
        this.#lastFocus = null;
        this.#onClose?.();
      }, 380);
    }

    bind() {
      this.#root.querySelectorAll('[data-brand-videos-close]').forEach((el) => {
        this.#on(el, 'click', () => this.close());
      });

      if (this.#audioBtn) {
        this.#on(this.#audioBtn, 'click', () => {
          if (!this.#ytPlayer) return;
          this.#muted = !this.#muted;
          if (this.#muted) {
            this.#ytPlayer.mute();
            this.#audioBtn.classList.remove('is-on');
            this.#audioBtn.setAttribute('aria-pressed', 'false');
            this.#audioBtn.setAttribute('aria-label', 'Unmute video');
          } else {
            this.#ytPlayer.unMute();
            this.#ytPlayer.setVolume(100);
            this.#audioBtn.classList.add('is-on');
            this.#audioBtn.setAttribute('aria-pressed', 'true');
            this.#audioBtn.setAttribute('aria-label', 'Mute video');
          }
        });
      }

      if (this.#playBtn) {
        this.#on(this.#playBtn, 'click', () => {
          if (!this.#ytPlayer) return;
          if (this.#playing) this.#ytPlayer.pauseVideo();
          else this.#ytPlayer.playVideo();
        });
      }

      if (this.#fsBtn) {
        this.#on(this.#fsBtn, 'click', () => {
          const fn =
            this.#player.requestFullscreen ||
            this.#player.webkitRequestFullscreen ||
            this.#player.msRequestFullscreen;
          fn?.call(this.#player);
        });
      }

      this.#on(document, 'keydown', (e) => {
        if (e.key === 'Escape' && this.#open) this.close();
        this.#trapFocus(e);
      });

      if (this.#sheet) {
        let startY = 0;
        let deltaY = 0;
        this.#on(this.#sheet, 'touchstart', (e) => {
          startY = e.touches[0].clientY;
          deltaY = 0;
        }, { passive: true });
        this.#on(this.#sheet, 'touchmove', (e) => {
          deltaY = e.touches[0].clientY - startY;
          if (deltaY > 0) {
            this.#sheet.style.transform = `translate3d(0, ${deltaY * 0.55}px, 0) scale(${1 - deltaY * 0.0004})`;
          }
        }, { passive: true });
        this.#on(this.#sheet, 'touchend', () => {
          if (deltaY > 90) this.close();
          this.#sheet.style.transform = '';
        });
      }
    }

    destroy() {
      this.close();
      util.unbindAll(this.#listeners);
    }
  };
})(window);
