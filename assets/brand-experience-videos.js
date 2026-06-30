/**
 * Brand Experience Videos — orchestrator
 */
(function () {
  'use strict';

  const { util } = window.Bev;
  const registry = new WeakMap();

  class BrandExperience {
    #root;
    #pool;
    #carousel;
    #modal;
    #visibleIo = null;
    #headerIo = null;
    #listeners = [];
    #pauseOffscreen = true;

    constructor(root) {
      this.#root = root;
      const rail = root.querySelector('[data-brand-videos-rail]');
      const viewport = root.querySelector('[data-brand-videos-viewport]');
      const firstRow = root.querySelector('[data-brand-videos-row]');
      const cards = [...root.querySelectorAll('[data-brand-videos-card][data-video-id]')];

      this.#pool = new window.Bev.VideoPool(root);
      this.#modal = new window.Bev.ModalPlayer({
        root,
        onClose: () => {
          this.#carousel?.setModalOpen(false);
          this.#carousel?.readMetrics();
        }
      });

      this.#carousel = new window.Bev.CarouselEngine({
        root,
        rail,
        viewport,
        firstRow,
        cards,
        pool: this.#pool,
        onMetricsChange: () => {}
      });
    }

    #on(el, type, fn, opts) {
      el.addEventListener(type, fn, opts);
      this.#listeners.push([el, type, fn, opts]);
    }

  #openFromCard(card) {
      const btn = card.querySelector('[data-brand-videos-open]');
      const id = card.dataset.videoId;
      const poster = card.querySelector('.bev-card__poster');
      if (!id) return;

      this.#carousel.setModalOpen(true);
      this.#modal.open({
        videoId: id,
        title: card.dataset.videoTitle,
        posterSrc: poster?.currentSrc || poster?.src,
        sourceBtn: btn
      });
    }

    mount() {
      const root = this.#root;
      const speedRaw = parseFloat(root.dataset.speed || '4');
      const scrollOn = root.dataset.scroll !== 'false';
      const playOn = root.dataset.play !== 'false';
      const reduced = util.prefersReducedMotion();
      this.#pauseOffscreen = root.dataset.pauseOffscreen !== 'false';

      this.#carousel.configure({ scrollOn, playOn, speedRaw, reduced });
      this.#modal.bind();

      this.#carousel.bindTouch();
      this.#carousel.bindKeyboard((card) => this.#openFromCard(card));

      root.querySelectorAll('[data-brand-videos-card]').forEach((card) => {
        const btn = card.querySelector('[data-brand-videos-open]');
        if (!btn) return;
        this.#on(btn, 'click', (e) => {
          if (this.#carousel.dragMoved) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          this.#openFromCard(card);
        });
      });

      if ('IntersectionObserver' in window) {
        this.#visibleIo = new IntersectionObserver(
          ([entry]) => {
            const off = !entry.isIntersecting;
            if (this.#pauseOffscreen) this.#carousel.setOffscreen(off);
          },
          { threshold: 0.06, rootMargin: '80px 0px' }
        );
        this.#visibleIo.observe(root);
      }

      const header = root.querySelector('[data-brand-videos-header]');
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

      this.#carousel.start();
    }

    destroy() {
      this.#visibleIo?.disconnect();
      this.#headerIo?.disconnect();
      this.#carousel?.destroy();
      this.#modal?.destroy();
      this.#pool?.destroy();
      util.unbindAll(this.#listeners);
    }
  }

  function init(scope) {
    (scope || document).querySelectorAll('[data-brand-videos]').forEach((root) => {
      registry.get(root)?.destroy();
      const app = new BrandExperience(root);
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
