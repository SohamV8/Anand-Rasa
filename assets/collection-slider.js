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
