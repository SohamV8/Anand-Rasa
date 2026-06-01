/* Anand Rasa — consolidated theme interactions. */

/* ===== animations.js ===== */
(function () {
const SCROLL_ANIMATION_TRIGGER_CLASSNAME = 'scroll-trigger';
const SCROLL_ANIMATION_OFFSCREEN_CLASSNAME = 'scroll-trigger--offscreen';
const SCROLL_ZOOM_IN_TRIGGER_CLASSNAME = 'animate--zoom-in';
const SCROLL_ANIMATION_CANCEL_CLASSNAME = 'scroll-trigger--cancel';

// Scroll in animation logic
function onIntersection(elements, observer) {
  elements.forEach((element, index) => {
    if (element.isIntersecting) {
      const elementTarget = element.target;
      if (elementTarget.classList.contains(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME)) {
        elementTarget.classList.remove(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
        if (elementTarget.hasAttribute('data-cascade'))
          elementTarget.setAttribute('style', `--animation-order: ${index};`);
      }
      observer.unobserve(elementTarget);
    } else {
      element.target.classList.add(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
      element.target.classList.remove(SCROLL_ANIMATION_CANCEL_CLASSNAME);
    }
  });
}

function initializeScrollAnimationTrigger(rootEl = document, isDesignModeEvent = false) {
  const animationTriggerElements = Array.from(rootEl.getElementsByClassName(SCROLL_ANIMATION_TRIGGER_CLASSNAME));
  if (animationTriggerElements.length === 0) return;

  if (isDesignModeEvent) {
    animationTriggerElements.forEach((element) => {
      element.classList.add('scroll-trigger--design-mode');
    });
    return;
  }

  const observer = new IntersectionObserver(onIntersection, {
    rootMargin: '0px 0px -50px 0px',
  });
  animationTriggerElements.forEach((element) => observer.observe(element));
}

// Zoom in animation logic
function initializeScrollZoomAnimationTrigger() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const animationTriggerElements = Array.from(document.getElementsByClassName(SCROLL_ZOOM_IN_TRIGGER_CLASSNAME));

  if (animationTriggerElements.length === 0) return;

  const scaleAmount = 0.2 / 100;

  animationTriggerElements.forEach((element) => {
    let elementIsVisible = false;
    const observer = new IntersectionObserver((elements) => {
      elements.forEach((entry) => {
        elementIsVisible = entry.isIntersecting;
      });
    });
    observer.observe(element);

    element.style.setProperty('--zoom-in-ratio', 1 + scaleAmount * percentageSeen(element));

    window.addEventListener(
      'scroll',
      throttle(() => {
        if (!elementIsVisible) return;

        element.style.setProperty('--zoom-in-ratio', 1 + scaleAmount * percentageSeen(element));
      }),
      { passive: true }
    );
  });
}

function percentageSeen(element) {
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY;
  const elementPositionY = element.getBoundingClientRect().top + scrollY;
  const elementHeight = element.offsetHeight;

  if (elementPositionY > scrollY + viewportHeight) {
    // If we haven't reached the image yet
    return 0;
  } else if (elementPositionY + elementHeight < scrollY) {
    // If we've completely scrolled past the image
    return 100;
  }

  // When the image is in the viewport
  const distance = scrollY + viewportHeight - elementPositionY;
  let percentage = distance / ((viewportHeight + elementHeight) / 100);
  return Math.round(percentage);
}

window.addEventListener('DOMContentLoaded', () => {
  initializeScrollAnimationTrigger();
  initializeScrollZoomAnimationTrigger();
});

if (Shopify.designMode) {
  document.addEventListener('shopify:section:load', (event) => initializeScrollAnimationTrigger(event.target, true));
  document.addEventListener('shopify:section:reorder', () => initializeScrollAnimationTrigger(document, true));
}
})();


/* ===== astro-faq-recommendations.js ===== */
(function () {
  'use strict';

  function initSection(root) {
    if (!root || root.dataset.afrInit === 'true') return;
    root.dataset.afrInit = 'true';

    initReveal(root);
    initAccordion(root);
    initCarousel(root);
  }

  function initReveal(root) {
    root.classList.add('is-visible');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
            }
          });
        },
        { rootMargin: '0px 0px -5% 0px', threshold: 0.05 }
      );
      observer.observe(root);
    }

    setTimeout(function () {
      root.classList.add('is-visible');
    }, 80);
  }

  function initAccordion(root) {
    var items = root.querySelectorAll('.afr__faq-item');

    items.forEach(function (item) {
      var btn = item.querySelector('.afr__faq-trigger');
      var panel = item.querySelector('.afr__faq-panel');
      if (!btn || !panel) return;

      panel.removeAttribute('hidden');

      if (item.classList.contains('is-open')) {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }

      btn.addEventListener('click', function () {
        toggleItem(item, btn, panel);
      });

      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
    });

    window.addEventListener('resize', debounce(function () {
      root.querySelectorAll('.afr__faq-item.is-open').forEach(function (item) {
        var panel = item.querySelector('.afr__faq-panel');
        if (panel) panel.style.maxHeight = panel.scrollHeight + 'px';
      });
    }, 150));
  }

  function toggleItem(item, btn, panel) {
    var isOpen = item.classList.contains('is-open');
    var list = item.closest('.afr__faq-list');

    if (list) {
      list.querySelectorAll('.afr__faq-item.is-open').forEach(function (sibling) {
        if (sibling !== item) closeItem(sibling);
      });
    }

    if (isOpen) {
      closeItem(item);
    } else {
      item.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      panel.style.maxHeight = panel.scrollHeight + 'px';
    }
  }

  function closeItem(item) {
    var btn = item.querySelector('.afr__faq-trigger');
    var panel = item.querySelector('.afr__faq-panel');
    item.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (panel) panel.style.maxHeight = '0';
  }

  function initCarousel(root) {
    var wrap = root.querySelector('.afr__track-wrap');
    if (!wrap) return;

    var track = wrap.querySelector('.afr__track');
    var prev = wrap.querySelector('.afr__track-btn--prev');
    var next = wrap.querySelector('.afr__track-btn--next');
    if (!track || !prev || !next) return;

    function getScrollStep() {
      var card = track.querySelector('.afr__prod');
      if (!card) return track.clientWidth;
      var gap = parseFloat(window.getComputedStyle(track).gap) || 16;
      return card.offsetWidth + gap;
    }

    function updateButtons() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = maxScroll <= 4 || track.scrollLeft >= maxScroll - 4;
    }

    function scrollTrack(direction) {
      track.scrollBy({
        left: direction * getScrollStep(),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    }

    prev.addEventListener('click', function () {
      scrollTrack(-1);
    });

    next.addEventListener('click', function () {
      scrollTrack(1);
    });

    track.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', debounce(updateButtons, 120));
    updateButtons();
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function boot() {
    document.querySelectorAll('[data-afr-section]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var section = e.target.querySelector('[data-afr-section]');
    if (section) initSection(section);
  });
})();


/* ===== navagraha-mantra.js ===== */
(function () {
  if (window.__ngMantraInit) return;
  window.__ngMantraInit = true;

  var strips = document.querySelectorAll('[data-ng-reveal]');
  if (!strips.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal(el) {
    el.classList.add('is-visible');
  }

  if (reduced || !('IntersectionObserver' in window)) {
    strips.forEach(reveal);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.12 }
  );

  strips.forEach(function (strip) {
    observer.observe(strip);
  });
})();


/* ===== attar-meaning-editorial.js ===== */
(function () {
  'use strict';

  function initSection(root) {
    if (!root || root.dataset.ameInit === 'true') return;
    root.dataset.ameInit = 'true';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('is-visible');
      return;
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
      );
      observer.observe(root);
      return;
    }

    root.classList.add('is-visible');
  }

  function boot() {
    document.querySelectorAll('[data-ame-section]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var section = e.target.querySelector('[data-ame-section]');
    if (section) initSection(section);
  });
})();


/* ===== fragrance-notes.js ===== */
(function () {
  'use strict';

  var section = document.querySelector('.js-ar-fn');
  if (!section) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section.classList.add('ar-fn--vis');
    return;
  }

  if (!('IntersectionObserver' in window)) {
    section.classList.add('ar-fn--vis');
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      var entry = entries[0];
      if (!entry.isIntersecting) return;
      section.classList.add('ar-fn--vis');
      observer.disconnect();
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  observer.observe(section);
})();


/* ===== collection-slider.js ===== */
(function () {
  const cards = Array.from(document.querySelectorAll('[data-product-card]'));
  if (!cards.length) return;

  const state = new WeakMap();

  const setDot = (card, idx) => {
    const dots = card.querySelectorAll('.ar-card__dot');
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === idx));
  };

  const showImage = (card, index) => {
    const img = card.querySelector('.ar-card__image');
    const cardState = state.get(card);
    if (!img || !cardState) return;
    img.src = cardState.images[index];
    cardState.index = index;
    setDot(card, index);
  };

  const preloadSecondary = (card) => {
    const cardState = state.get(card);
    if (!cardState || cardState.preloaded || cardState.images.length < 2) return;
    cardState.preloaded = true;
    cardState.images.slice(1).forEach((src) => {
      const preImg = new Image();
      preImg.src = src;
    });
  };

  const startSlider = (card) => {
    const cardState = state.get(card);
    if (!cardState || cardState.images.length < 2 || cardState.timer || !cardState.inView) return;
    preloadSecondary(card);
    cardState.timer = window.setInterval(() => {
      const nextIndex = (cardState.index + 1) % cardState.images.length;
      showImage(card, nextIndex);
    }, 2500);
  };

  const stopSlider = (card) => {
    const cardState = state.get(card);
    if (!cardState) return;
    if (cardState.timer) {
      window.clearInterval(cardState.timer);
      cardState.timer = null;
    }
    showImage(card, 0);
  };

  cards.forEach((card) => {
    const imageString = card.dataset.images || '';
    const images = imageString.split(',').map((s) => s.trim()).filter(Boolean);
    state.set(card, {
      images,
      index: 0,
      timer: null,
      inView: false,
      preloaded: false,
    });

    card.addEventListener('mouseenter', () => startSlider(card));
    card.addEventListener('mouseleave', () => stopSlider(card));
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const cardState = state.get(entry.target);
        if (!cardState) return;
        cardState.inView = entry.isIntersecting;
        if (!entry.isIntersecting) stopSlider(entry.target);
      });
    },
    { threshold: 0.2 }
  );

  cards.forEach((card) => observer.observe(card));

  document.addEventListener('click', (event) => {
    const closeTrigger = event.target.closest('[data-mobile-facets-close]');
    if (!closeTrigger) return;
    const disclosure = closeTrigger.closest('.mobile-facets__wrapper')?.querySelector('details.mobile-facets__disclosure');
    if (disclosure?.open) {
      disclosure.removeAttribute('open');
      disclosure.classList.remove('menu-opening');
      closeTrigger.closest('details')?.classList.remove('menu-opening');
    }
  });
})();

