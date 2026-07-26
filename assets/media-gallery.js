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
        this._lmgMobileMql = window.matchMedia('(max-width: 749px)');
        this._lmgReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this._lmgVideoResizeTimer = null;
        this._lmgActiveVideo = null;

        if (this.elements.viewer) {
          this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
        }

        const desktopLayout = this.dataset.desktopLayout || '';
        if (desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();

        if (this.elements.thumbnails) {
          this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
            const button = mediaToSwitch.querySelector('button');
            const target = mediaToSwitch.dataset && mediaToSwitch.dataset.target;
            if (!button || !target) return;
            button.addEventListener('click', () => this.setActiveMedia(target, false));
          });
        }

        if (this.classList.contains('lmg-dawn')) {
          this.initLuxuryVideoController();
          this.initLuxuryThumbRail();
          this.initLuxuryViewerNav();
          if (this.elements.thumbnails) this.initLuxuryAutoplay();
          // Auto-load featured video without waiting for a click (respect reduced motion).
          if (!this._lmgReducedMotion.matches) {
            requestAnimationFrame(() => {
              const active =
                this.elements.viewer &&
                this.elements.viewer.querySelector('.product__media-item.is-active');
              if (active) this.playActiveMedia(active);
            });
          }
        }
      }

      // Perf/memory: tear down timers / observers when the element leaves the DOM.
      disconnectedCallback() {
        if (typeof this._lmgClearTimers === 'function') this._lmgClearTimers();
        if (this._lmgModalObserver) {
          this._lmgModalObserver.disconnect();
          this._lmgModalObserver = null;
        }
        this.teardownLuxuryVideoController();
        this.teardownLuxuryThumbRail();
        this.teardownLuxuryViewerNav();
      }

      getLuxuryMediaTargets() {
        if (this.elements.thumbnails) {
          const fromThumbs = Array.from(this.elements.thumbnails.querySelectorAll('[data-target]'))
            .map((el) => el.dataset.target)
            .filter(Boolean);
          if (fromThumbs.length) return fromThumbs;
        }
        if (!this.elements.viewer) return [];
        return Array.from(this.elements.viewer.querySelectorAll('.product__media-item[data-media-id]'))
          .map((el) => el.dataset.mediaId)
          .filter(Boolean);
      }

      getLuxuryMediaIndex(targets) {
        const active = this.elements.viewer && this.elements.viewer.querySelector('.product__media-item.is-active');
        const id = active && active.dataset.mediaId;
        const idx = targets.indexOf(id);
        return idx >= 0 ? idx : 0;
      }

      initLuxuryViewerNav() {
        if (this._lmgViewerNavReady || !this.elements.viewer) return;
        this._lmgViewerNavReady = true;

        const prev = this.elements.viewer.querySelector('.slider-buttons button[name="previous"]');
        const next = this.elements.viewer.querySelector('.slider-buttons button[name="next"]');
        if (!prev || !next) return;

        this._lmgNavPrev = prev;
        this._lmgNavNext = next;

        const unlock = () => {
          prev.removeAttribute('disabled');
          next.removeAttribute('disabled');
          prev.setAttribute('aria-disabled', 'false');
          next.setAttribute('aria-disabled', 'false');
        };

        const go = (dir, event) => {
          if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
          const targets = this.getLuxuryMediaTargets();
          if (targets.length < 2) return;
          unlock();
          const current = this.getLuxuryMediaIndex(targets);
          const nextIdx = (current + dir + targets.length) % targets.length;
          this._lmgAutoplayAdvance = true;
          this.setActiveMedia(targets[nextIdx], false);
          this._lmgAutoplayAdvance = false;
          if (typeof this._lmgPauseAutoplay === 'function') this._lmgPauseAutoplay(10000);
          if (typeof this._lmgSyncThumbs === 'function') {
            requestAnimationFrame(() => this._lmgSyncThumbs());
          }
        };

        this._lmgNavPrevHandler = (event) => go(-1, event);
        this._lmgNavNextHandler = (event) => go(1, event);

        // Capture phase so Dawn SliderComponent scroll logic never wins.
        prev.addEventListener('click', this._lmgNavPrevHandler, true);
        next.addEventListener('click', this._lmgNavNextHandler, true);

        unlock();
        // Dawn disables buttons when scroll paging thinks you're at the end — keep them usable.
        this._lmgNavUnlockObs = new MutationObserver(unlock);
        this._lmgNavUnlockObs.observe(prev, { attributes: true, attributeFilter: ['disabled'] });
        this._lmgNavUnlockObs.observe(next, { attributes: true, attributeFilter: ['disabled'] });
      }

      teardownLuxuryViewerNav() {
        if (this._lmgNavPrev && this._lmgNavPrevHandler) {
          this._lmgNavPrev.removeEventListener('click', this._lmgNavPrevHandler, true);
        }
        if (this._lmgNavNext && this._lmgNavNextHandler) {
          this._lmgNavNext.removeEventListener('click', this._lmgNavNextHandler, true);
        }
        if (this._lmgNavUnlockObs) {
          this._lmgNavUnlockObs.disconnect();
          this._lmgNavUnlockObs = null;
        }
        this._lmgViewerNavReady = false;
      }

      initLuxuryThumbRail() {
        if (this._lmgThumbRailReady || !this.elements.thumbnails || !this.elements.viewer) return;
        this._lmgThumbRailReady = true;

        this._lmgSyncThumbs = () => {
          if (!this.mql.matches) {
            this.style.removeProperty('--lmg-thumb');
            return;
          }

          const list = this.elements.thumbnails.querySelector('.thumbnail-list');
          const items = list ? list.querySelectorAll('.thumbnail-list__item') : [];
          const count = items.length || parseInt(this.dataset.lmgCount, 10) || 1;
          const viewerHeight = this.elements.viewer.getBoundingClientRect().height;
          if (!viewerHeight || count < 1) return;

          const gap = 8;
          const raw = (viewerHeight - gap * Math.max(count - 1, 0)) / count;
          const size = Math.max(80, Math.min(140, Math.floor(raw)));
          this.style.setProperty('--lmg-thumb', `${size}px`);
          this.style.setProperty('--lmg-thumb-gap', `${gap}px`);
          this.style.setProperty('--lmg-count', String(count));
        };

        this._lmgThumbResize = () => {
          if (this._lmgThumbResizeTimer) window.clearTimeout(this._lmgThumbResizeTimer);
          this._lmgThumbResizeTimer = window.setTimeout(() => this._lmgSyncThumbs(), 100);
        };

        window.addEventListener('resize', this._lmgThumbResize, { passive: true });
        if (typeof ResizeObserver !== 'undefined') {
          this._lmgThumbRO = new ResizeObserver(this._lmgThumbResize);
          this._lmgThumbRO.observe(this.elements.viewer);
        }

        requestAnimationFrame(() => this._lmgSyncThumbs());
        // Recalc after images settle (prevents CLS / wrong first size).
        window.setTimeout(() => this._lmgSyncThumbs(), 250);
        window.setTimeout(() => this._lmgSyncThumbs(), 800);
      }

      teardownLuxuryThumbRail() {
        window.removeEventListener('resize', this._lmgThumbResize);
        if (this._lmgThumbResizeTimer) window.clearTimeout(this._lmgThumbResizeTimer);
        this._lmgThumbResizeTimer = null;
        if (this._lmgThumbRO) {
          this._lmgThumbRO.disconnect();
          this._lmgThumbRO = null;
        }
        this._lmgThumbRailReady = false;
      }

      centerActiveThumbnail() {
        if (!this.elements.thumbnails || this.mql.matches) return;
        const active = this.elements.thumbnails.querySelector('button[aria-current="true"]');
        if (!active || typeof active.scrollIntoView !== 'function') return;
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }

      initLuxuryVideoController() {
        if (this._lmgVideoControllerReady) return;
        this._lmgVideoControllerReady = true;

        this._lmgOnVisibility = () => {
          if (document.hidden) this.pauseGalleryVideos();
          else this.playActiveGalleryVideo();
        };
        document.addEventListener('visibilitychange', this._lmgOnVisibility);

        this._lmgOnResize = () => {
          if (this._lmgVideoResizeTimer) window.clearTimeout(this._lmgVideoResizeTimer);
          this._lmgVideoResizeTimer = window.setTimeout(() => {
            this.applyMobileVideoChrome(this._lmgActiveVideo);
            if (typeof this._lmgSyncThumbs === 'function') this._lmgSyncThumbs();
          }, 150);
        };
        window.addEventListener('resize', this._lmgOnResize, { passive: true });

        if ('IntersectionObserver' in window) {
          this._lmgVideoIO = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                const video = entry.target;
                if (!entry.isIntersecting) {
                  this.pauseVideo(video);
                  return;
                }
                if (video === this._lmgActiveVideo) this.safePlayVideo(video);
              });
            },
            { threshold: 0.35, rootMargin: '0px' }
          );
        }
      }

      teardownLuxuryVideoController() {
        document.removeEventListener('visibilitychange', this._lmgOnVisibility);
        window.removeEventListener('resize', this._lmgOnResize);
        if (this._lmgVideoResizeTimer) window.clearTimeout(this._lmgVideoResizeTimer);
        this._lmgVideoResizeTimer = null;
        if (this._lmgVideoIO) {
          this._lmgVideoIO.disconnect();
          this._lmgVideoIO = null;
        }
        this.pauseGalleryVideos();
        this._lmgActiveVideo = null;
        this._lmgVideoControllerReady = false;
      }

      getGalleryVideos() {
        if (!this.elements.viewer) return [];
        return Array.from(this.elements.viewer.querySelectorAll('video.product-gallery-video, video'));
      }

      pauseVideo(video) {
        if (!video) return;
        try {
          video.pause();
        } catch (e) {
          /* noop */
        }
      }

      pauseGalleryVideos(except) {
        this.getGalleryVideos().forEach((video) => {
          if (except && video === except) return;
          this.pauseVideo(video);
        });
      }

      applyMobileVideoChrome(video) {
        if (!video) return;
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute('muted', '');
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.loop = true;
        video.setAttribute('loop', '');
        if (!video.getAttribute('preload') || video.getAttribute('preload') === 'auto') {
          video.preload = 'metadata';
          video.setAttribute('preload', 'metadata');
        }
        video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
        video.disablePictureInPicture = true;
        video.setAttribute('disablepictureinpicture', '');
        video.setAttribute('disableremoteplayback', '');

        // Always hide native chrome — muted reel, no volume / fullscreen UI.
        video.controls = false;
        video.removeAttribute('controls');

        video.style.transform = 'translateZ(0)';
        video.style.backfaceVisibility = 'hidden';
      }

      safePlayVideo(video) {
        if (!video) return;
        if (this._lmgReducedMotion && this._lmgReducedMotion.matches) {
          this.pauseVideo(video);
          return;
        }
        this.applyMobileVideoChrome(video);
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            /* Autoplay may be blocked; poster / tap remains available. */
          });
        }
      }

      playActiveGalleryVideo() {
        const active =
          this.elements.viewer &&
          this.elements.viewer.querySelector('.product__media-item.is-active');
        if (!active) return;
        const video = active.querySelector('video.product-gallery-video, video');
        if (!video) return;
        this._lmgActiveVideo = video;
        this.pauseGalleryVideos(video);
        if (this._lmgVideoIO) this._lmgVideoIO.observe(video);
        this.safePlayVideo(video);
      }

      prepareActiveVideo(activeItem) {
        if (!activeItem) return;
        const deferredMedia = activeItem.querySelector('deferred-media, .deferred-media');
        if (deferredMedia && typeof deferredMedia.loadContent === 'function') {
          deferredMedia.loadContent(false);
        }

        const video = activeItem.querySelector('video.product-gallery-video, video');
        if (!video) {
          // Template may resolve a frame later in some browsers.
          window.requestAnimationFrame(() => {
            const lateVideo = activeItem.querySelector('video.product-gallery-video, video');
            if (!lateVideo) return;
            this._lmgActiveVideo = lateVideo;
            this.pauseGalleryVideos(lateVideo);
            this.applyMobileVideoChrome(lateVideo);
            if (this._lmgVideoIO) this._lmgVideoIO.observe(lateVideo);
            this.safePlayVideo(lateVideo);
          });
          return;
        }

        this._lmgActiveVideo = video;
        this.pauseGalleryVideos(video);
        this.applyMobileVideoChrome(video);
        if (this._lmgVideoIO) this._lmgVideoIO.observe(video);
        this.safePlayVideo(video);
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
        const thumbnail = this.elements.thumbnails
          ? this.elements.thumbnails.querySelector(`[data-target="${currentElement.dataset.mediaId}"]`)
          : null;
        this.setActiveThumbnail(thumbnail);
        if (this._lmgPauseAutoplay && !this._lmgAutoplayAdvance) {
          this._lmgPauseAutoplay(10000);
        }
        // Stop any previous video and play the newly visible slide media.
        this.playActiveMedia(currentElement);
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
          const list = activeMedia.parentElement;
          // Only horizontal-scroll when the list is actually a peek carousel.
          if (list && list.scrollWidth > list.clientWidth + 8) {
            list.scrollTo({ left: activeMedia.offsetLeft, behavior: 'smooth' });
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
        const button = thumbnail.querySelector('button');
        if (button) button.setAttribute('aria-current', true);
        this.centerActiveThumbnail();
        if (typeof this._lmgSyncThumbs === 'function') {
          requestAnimationFrame(() => this._lmgSyncThumbs());
        }
        if (this.elements.thumbnails.isSlideVisible && this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;
        if (this.elements.thumbnails.slider) {
          this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
        }
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
        this._lmgActiveVideo = null;
        this.pauseGalleryVideos();
        if (!activeItem) return;
        this.prepareActiveVideo(activeItem);
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
