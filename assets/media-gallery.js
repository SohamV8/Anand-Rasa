if (!customElements.get('media-gallery')) {
  customElements.define(
    'media-gallery',
    class MediaGallery extends HTMLElement {
      constructor() {
        super();
        this.elements = {
          liveRegion: this.querySelector('[id^="GalleryStatus"]'),
          viewer: this.querySelector('[id^="GalleryViewer"]'),
          thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
        };
        this.mql = window.matchMedia('(min-width: 750px)');

        if (this.elements.viewer) {
          this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
        }

        const desktopLayout = this.dataset.desktopLayout || '';
        if (desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();

        if (!this.elements.thumbnails) return;

        this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
          const button = mediaToSwitch.querySelector('button');
          const target = mediaToSwitch.dataset && mediaToSwitch.dataset.target;
          if (!button || !target) return;
          button.addEventListener('click', () => this.setActiveMedia(target, false));
        });

        if (this.classList.contains('lmg-dawn')) {
          this.initLuxuryAutoplay();
        }
      }

      // Perf/memory: tear down the autoplay interval and modal MutationObserver
      // when the element leaves the DOM (navigation / Theme Editor section reload)
      // so they don't leak. No behavioural change while connected.
      disconnectedCallback() {
        if (typeof this._lmgClearTimers === 'function') this._lmgClearTimers();
        if (this._lmgModalObserver) {
          this._lmgModalObserver.disconnect();
          this._lmgModalObserver = null;
        }
      }

      initLuxuryAutoplay() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (this.dataset.lmgAutoplay === 'off') return;

        const thumbItems = Array.from(this.elements.thumbnails.querySelectorAll('[data-target]'));
        if (thumbItems.length < 2) return;

        const interval = parseInt(this.dataset.lmgAutoplay, 10) || 7000;
        let timer = null;
        let resumeTimer = null;
        let paused = false;
        this._lmgAutoplayAdvance = false;

        const getTargets = () => thumbItems.map((el) => el.dataset.target).filter(Boolean);

        const getCurrentIndex = (targets) => {
          const activeBtn = this.elements.thumbnails.querySelector('button[aria-current="true"]');
          if (!activeBtn) return 0;
          const item = activeBtn.closest('[data-target]');
          const id = item && item.dataset.target;
          const idx = targets.indexOf(id);
          return idx >= 0 ? idx : 0;
        };

        const clearTimers = () => {
          if (timer) window.clearInterval(timer);
          if (resumeTimer) window.clearTimeout(resumeTimer);
          timer = null;
          resumeTimer = null;
        };

        const start = () => {
          clearTimers();
          if (paused) return;
          timer = window.setInterval(() => {
            const targets = getTargets();
            if (targets.length < 2) return;
            const next = (getCurrentIndex(targets) + 1) % targets.length;
            this._lmgAutoplayAdvance = true;
            this.setActiveMedia(targets[next], false);
            this._lmgAutoplayAdvance = false;
          }, interval);
        };

        const pause = (resumeAfterMs) => {
          paused = true;
          clearTimers();
          if (resumeAfterMs) {
            resumeTimer = window.setTimeout(() => {
              paused = false;
              start();
            }, resumeAfterMs);
          }
        };

        const resume = () => {
          paused = false;
          start();
        };

        this._lmgPauseAutoplay = pause;
        this._lmgResumeAutoplay = resume;
        this._lmgClearTimers = clearTimers;

        const originalSetActiveMedia = this.setActiveMedia.bind(this);
        this.setActiveMedia = (mediaId, prepend) => {
          originalSetActiveMedia(mediaId, prepend);
          if (!this._lmgAutoplayAdvance) pause(10000);
        };

        this.addEventListener('mouseenter', () => pause());
        this.addEventListener('mouseleave', () => resume());
        this.addEventListener('touchstart', () => pause(), { passive: true });
        this.addEventListener('touchend', () => pause(7000), { passive: true });
        this.addEventListener('focusin', (e) => {
          if (e.target.closest('.lmg-dawn__thumb, .product__media-toggle, modal-opener')) pause();
        });
        this.addEventListener('focusout', (e) => {
          if (!this.contains(e.relatedTarget)) resume();
        });

        this.addEventListener(
          'click',
          (e) => {
            if (e.target.closest('modal-opener, .product__media-toggle')) pause(12000);
          },
          true
        );

        const sectionId = this.id.replace('MediaGallery-', '');
        const modal = document.querySelector(`#ProductModal-${sectionId}`);
        if (modal) {
          const modalObserver = new MutationObserver(() => {
            if (modal.hasAttribute('open')) pause();
            else resume();
          });
          modalObserver.observe(modal, { attributes: true, attributeFilter: ['open'] });
          this._lmgModalObserver = modalObserver;
        }

        document.addEventListener('visibilitychange', () => {
          if (document.hidden) pause();
          else resume();
        });

        start();
      }

      onSlideChanged(event) {
        const currentElement = event.detail && event.detail.currentElement;
        if (!currentElement || !currentElement.dataset || !currentElement.dataset.mediaId) return;
        const thumbnail = this.elements.thumbnails.querySelector(
          `[data-target="${currentElement.dataset.mediaId}"]`
        );
        this.setActiveThumbnail(thumbnail);
        if (this._lmgPauseAutoplay && !this._lmgAutoplayAdvance) {
          this._lmgPauseAutoplay(10000);
        }
      }

      setActiveMedia(mediaId, prepend) {
        const activeMedia =
          this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`) ||
          this.elements.viewer.querySelector('[data-media-id]');
        if (!activeMedia) {
          return;
        }
        this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
          element.classList.remove('is-active');
        });
        activeMedia?.classList?.add('is-active');

        if (prepend) {
          activeMedia.parentElement.firstChild !== activeMedia && activeMedia.parentElement.prepend(activeMedia);

          if (this.elements.thumbnails) {
            const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
            activeThumbnail.parentElement.firstChild !== activeThumbnail && activeThumbnail.parentElement.prepend(activeThumbnail);
          }

          if (this.elements.viewer.slider) this.elements.viewer.resetPages();
        }

        this.preventStickyHeader();
        window.setTimeout(() => {
          if (!this.mql.matches || this.elements.thumbnails) {
            activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
          }
          // Never hijack page scroll during luxury autoplay or when gallery is off-screen.
          if (this._lmgAutoplayAdvance) return;
          const activeMediaRect = activeMedia.getBoundingClientRect();
          const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
          if (activeMediaRect.bottom < 0 || activeMediaRect.top > viewportHeight) return;
          if (activeMediaRect.top > -0.5) return;
          const top = activeMediaRect.top + window.scrollY;
          window.scrollTo({ top: top, behavior: 'smooth' });
        });
        this.playActiveMedia(activeMedia);

        if (!this.elements.thumbnails) return;
        const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
        this.setActiveThumbnail(activeThumbnail);
        if (activeThumbnail && activeThumbnail.dataset && activeThumbnail.dataset.mediaPosition) {
          this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
        }
      }

      setActiveThumbnail(thumbnail) {
        if (!this.elements.thumbnails || !thumbnail) return;

        this.elements.thumbnails
          .querySelectorAll('button')
          .forEach((element) => element.removeAttribute('aria-current'));
        thumbnail.querySelector('button').setAttribute('aria-current', true);
        if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

        this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
      }

      announceLiveRegion(activeItem, position) {
        const image = activeItem.querySelector('.product__modal-opener--image img');
        if (!image) return;
        image.onload = () => {
          this.elements.liveRegion.setAttribute('aria-hidden', false);
          this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace('[index]', position);
          setTimeout(() => {
            this.elements.liveRegion.setAttribute('aria-hidden', true);
          }, 2000);
        };
        image.src = image.src;
      }

      playActiveMedia(activeItem) {
        window.pauseAllMedia();
        const deferredMedia = activeItem.querySelector('.deferred-media');
        if (deferredMedia) deferredMedia.loadContent(false);
      }

      preventStickyHeader() {
        this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
        if (!this.stickyHeader) return;
        this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
      }

      removeListSemantic() {
        if (!this.elements.viewer.slider) return;
        this.elements.viewer.slider.setAttribute('role', 'presentation');
        this.elements.viewer.sliderItems.forEach((slide) => slide.setAttribute('role', 'presentation'));
      }
    }
  );
}
