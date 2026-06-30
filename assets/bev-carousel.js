/**
 * Brand Experience Videos — carousel engine (delta-time scroll + 3D layout)
 */
(function (global) {
  'use strict';

  const { CONST, util } = global.Bev;

  global.Bev.CarouselEngine = class CarouselEngine {
    #root;
    #rail;
    #viewport;
    #firstRow;
    #cards;
    #cardsPerRow = 0;
    #pool;
    #metrics = { cardW: 0, gap: 0, step: 0, rowW: 0, mid: 0, viewW: 0 };
    #offset = 0;
    #speedPx = 0;
    #scrollOn = true;
    #playOn = true;
    #reduced = false;
    #offscreen = false;
    #modalOpen = false;
    #raf = 0;
    #lastTs = 0;
    #syncFrame = 0;
    #mountSig = '';
    #drag = { active: false, startX: 0, startOffset: 0, velocity: 0, lastX: 0, lastTs: 0 };
    #suppressClick = false;
    #resizeObs = null;
    #onMetricsChange = null;

    constructor({ root, rail, viewport, firstRow, cards, pool, onMetricsChange }) {
      this.#root = root;
      this.#rail = rail;
      this.#viewport = viewport;
      this.#firstRow = firstRow;
      this.#cards = cards;
      this.#cardsPerRow = firstRow.querySelectorAll('[data-brand-videos-card][data-video-id]').length;
      this.#pool = pool;
      this.#onMetricsChange = onMetricsChange;
    }

    configure({ scrollOn, playOn, speedRaw, reduced }) {
      this.#scrollOn = scrollOn;
      this.#playOn = playOn;
      this.#reduced = reduced;
      this.#speedPx = reduced || !scrollOn ? 0 : Math.max(0, speedRaw) * CONST.SPEED_BASE;
    }

    setOffscreen(v) {
      this.#offscreen = v;
      if (v) this.#pool.detachAll();
      else this.#mountSig = '';
    }

    setModalOpen(v) {
      this.#modalOpen = v;
      if (v) this.#pool.detachAll();
      else this.#mountSig = '';
    }

    readMetrics() {
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

      this.#onMetricsChange?.(m);
    }

    #wrap() {
      const { rowW } = this.#metrics;
      if (rowW <= 0) return;
      while (this.#offset >= rowW) this.#offset -= rowW;
      while (this.#offset < 0) this.#offset += rowW;
    }

    #cardLeft(i) {
      const { step, rowW } = this.#metrics;
      const local = i < this.#cardsPerRow ? i : i - this.#cardsPerRow;
      const rowBase = i < this.#cardsPerRow ? 0 : rowW;
      return rowBase + local * step - this.#offset;
    }

    #layout3d() {
      const { cardW, step, mid } = this.#metrics;
      if (!cardW) return;

      const flat = this.#reduced;
      const centerScale = parseFloat(getComputedStyle(this.#root).getPropertyValue('--bev-center-scale')) || 1;

      for (let i = 0, n = this.#cards.length; i < n; i++) {
        const card = this.#cards[i];
        const x = this.#cardLeft(i) + cardW * 0.5;
        const dist = (x - mid) / step;
        const a = Math.abs(dist);

        if (flat) {
          const scale = Math.max(0.86, 1 - a * 0.06);
          card.style.transform = `translate3d(0,0,0) scale(${scale})`;
          card.style.filter = 'none';
        } else {
          const rotY = dist * -16;
          const rotX = util.clamp(dist * 1.2, -4, 4);
          const scale = Math.max(0.74, (1 - a * 0.058) * (a < 0.45 ? centerScale : 1));
          const z = -a * 48;
          const opacity = Math.max(0.5, 1 - a * 0.14);
          const blur = util.clamp(a * 0.35, 0, 1.2);
          const bright = 1 + util.clamp(0.08 - a * 0.04, 0, 0.08);
          const sat = 1 - util.clamp(a * 0.06, 0, 0.12);

          card.style.transform = `translate3d(0,0,${z}px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${scale})`;
          card.style.opacity = String(opacity);
          card.style.filter = a > 0.15 ? `blur(${blur}px) brightness(${bright}) saturate(${sat})` : 'none';
        }

        card.style.zIndex = String(100 - Math.round(a * 8));
        card.classList.toggle('is-center', a < 0.45);
      }
    }

    #priorityIndices() {
      const { cardW, step, viewW } = this.#metrics;
      if (!cardW) return [];

      const visiblePad = step * 0.5;
      const items = [];

      for (let i = 0, n = this.#cards.length; i < n; i++) {
        const left = this.#cardLeft(i);
        const right = left + cardW;
        if (right <= -visiblePad || left >= viewW + visiblePad) continue;

        const cx = left + cardW * 0.5;
        const dist = Math.abs(cx - this.#metrics.mid);
        items.push({ i, dist, left, right });
      }

      items.sort((a, b) => a.dist - b.dist);
      return items.map((x) => x.i);
    }

    #syncVideos() {
      if (!this.#playOn || this.#offscreen || this.#modalOpen) {
        if (!this.#modalOpen && !this.#playOn) this.#pool.detachAll();
        return;
      }

      const ordered = this.#priorityIndices();
      const want = new Set(ordered.slice(0, CONST.PRELOAD_AHEAD + 2));
      const sig = [...want].join(',');

      if (sig === this.#mountSig) return;
      this.#mountSig = sig;

      const attachedIds = new Set();

      for (const idx of ordered) {
        if (!want.has(idx)) continue;

        const card = this.#cards[idx];
        const id = card?.dataset.videoId;
        const embed = card?.querySelector('[data-brand-videos-embed]');
        if (!id || !embed) continue;

        if (attachedIds.has(id)) continue;
        attachedIds.add(id);
        this.#pool.attach(id, embed, card);
      }

      for (let i = 0, n = this.#cards.length; i < n; i++) {
        if (want.has(i)) continue;
        const embed = this.#cards[i]?.querySelector('[data-brand-videos-embed]');
        if (embed) this.#pool.detachSlot(embed);
      }
    }

    get dragMoved() {
      return this.#suppressClick || this.#drag.active || Math.abs(this.#drag.velocity) > 0.15;
    }

    nudge(deltaSteps) {
      this.#offset += deltaSteps * this.#metrics.step;
      this.#wrap();
      this.#mountSig = '';
    }

    bindTouch() {
      this.#viewport.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.#drag.active = true;
        this.#suppressClick = false;
        this.#drag.startX = e.clientX;
        this.#drag.startOffset = this.#offset;
        this.#drag.velocity = 0;
        this.#drag.lastX = e.clientX;
        this.#drag.lastTs = performance.now();
        this.#viewport.setPointerCapture(e.pointerId);
      });

      this.#viewport.addEventListener('pointermove', (e) => {
        if (!this.#drag.active) return;
        const now = performance.now();
        const dx = this.#drag.startX - e.clientX;
        if (Math.abs(dx) > 8) this.#suppressClick = true;
        this.#offset = this.#drag.startOffset + dx;
        const dt = now - this.#drag.lastTs;
        if (dt > 0) {
          this.#drag.velocity = (this.#drag.lastX - e.clientX) / dt;
        }
        this.#drag.lastX = e.clientX;
        this.#drag.lastTs = now;
        this.#wrap();
        this.#mountSig = '';
      });

      const endDrag = (e) => {
        if (!this.#drag.active) return;
        this.#drag.active = false;
        try {
          this.#viewport.releasePointerCapture(e.pointerId);
        } catch (_) {
          /* noop */
        }
        this.#drag.velocity = util.clamp(this.#drag.velocity, -2.5, 2.5);
        if (this.#suppressClick) {
          global.setTimeout(() => {
            this.#suppressClick = false;
          }, 140);
        }
      };

      this.#viewport.addEventListener('pointerup', endDrag);
      this.#viewport.addEventListener('pointercancel', endDrag);
    }

    bindKeyboard(onOpen) {
      this.#viewport.addEventListener('keydown', (e) => {
        if (this.#modalOpen) return;
        const { step, rowW } = this.#metrics;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.nudge(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.nudge(1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          this.#offset = 0;
          this.#mountSig = '';
        } else if (e.key === 'End') {
          e.preventDefault();
          this.#offset = rowW * 0.5;
          this.#mountSig = '';
        } else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.closest('[data-brand-videos-card]')) {
          e.preventDefault();
          onOpen?.(document.activeElement.closest('[data-brand-videos-card]'));
        }
      });
    }

    start() {
      this.readMetrics();
      if (this.#metrics.rowW > 0) this.#offset = this.#metrics.rowW * 0.5;

      if (typeof ResizeObserver !== 'undefined') {
        this.#resizeObs = new ResizeObserver(() => {
          this.readMetrics();
          this.#mountSig = '';
        });
        this.#resizeObs.observe(this.#viewport);
      }

      this.#lastTs = performance.now();
      this.#syncVideos();
      this.#raf = requestAnimationFrame(this.#tick);
    }

    #tick = (ts) => {
      const dt = Math.min(64, ts - this.#lastTs);
      this.#lastTs = ts;

      // Perf: when scrolled out of view the carousel is invisible, so skip the
      // per-frame 3D transforms/filters and video sync (videos already detached
      // via setOffscreen). Keeps the loop alive to resume instantly when shown.
      if (this.#offscreen) {
        this.#raf = requestAnimationFrame(this.#tick);
        return;
      }

      if (!this.#drag.active && Math.abs(this.#drag.velocity) > 0.01) {
        this.#offset += this.#drag.velocity * dt;
        this.#drag.velocity *= 0.94;
        this.#wrap();
        this.#mountSig = '';
      } else if (this.#speedPx > 0 && this.#scrollOn && !this.#offscreen) {
        this.#offset += this.#speedPx * (dt / (1000 / CONST.TARGET_FPS));
        this.#wrap();
      }

      this.#rail.style.transform = `translate3d(${-this.#offset}px,0,0)`;
      this.#layout3d();

      this.#syncFrame++;
      if (this.#syncFrame % CONST.SYNC_INTERVAL === 0) {
        this.#syncVideos();
      }

      this.#raf = requestAnimationFrame(this.#tick);
    };

    destroy() {
      cancelAnimationFrame(this.#raf);
      this.#resizeObs?.disconnect();
      this.#pool.detachAll();
    }
  };
})(window);
