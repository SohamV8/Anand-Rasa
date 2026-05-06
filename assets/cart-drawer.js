class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this._domParser = new DOMParser();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());

    this.addEventListener('click', (event) => {
      if (event.target.closest('#CartDrawer-Overlay')) {
        event.preventDefault();
        this.close();
      }
    });

    this.setCartTriggerAccessibility();
    this.bindGlobalCartTriggers();
    this.bindGlobalAddToCartSubmit();
  }

  setCartTriggerAccessibility() {
    const cartTriggers = document.querySelectorAll('[data-open-cart-drawer], #cart-icon-bubble');
    if (!cartTriggers.length) return;
    cartTriggers.forEach((trigger) => {
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'SPACE') {
          event.preventDefault();
          this.open(trigger);
        }
      });
    });
  }

  bindGlobalCartTriggers() {
    if (window.__arCartDrawerClickBound) return;
    window.__arCartDrawerClickBound = true;
    document.addEventListener('click', (event) => {
      const cartTrigger = event.target.closest('[data-open-cart-drawer], #cart-icon-bubble');
      if (!cartTrigger) return;
      event.preventDefault();
      this.open(cartTrigger);
    });
  }

  bindGlobalAddToCartSubmit() {
    if (window.__arCartDrawerSubmitBound) return;
    window.__arCartDrawerSubmitBound = true;

    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (event.defaultPrevented) return;
      if (form.closest('product-form')) return;

      const action = form.getAttribute('action') || '';
      if (!/\/cart\/add(?:$|\?)/.test(action)) return;

      event.preventDefault();
      this.addToCartFast(form);
    });
  }

  addToCartFast(form) {
    this.open();
    this.classList.add('is-loading');

    const formData = new FormData(form);
    formData.append(
      'sections',
      this.getSectionsToRender()
        .map((section) => section.id)
        .join(',')
    );
    formData.append('sections_url', window.location.pathname);

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/javascript' },
      body: formData,
    })
      .then((response) => response.json())
      .then((state) => {
        if (state.status) {
          if (window.console) console.warn('Cart add error:', state.description || state.message);
          return;
        }
        this.renderContents(state);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        this.classList.remove('is-loading');
      });
  }

  open(triggeredBy) {
    if (this.classList.contains('active')) return;
    if (triggeredBy) this.setActiveElement(triggeredBy);

    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) {
      this.setSummaryAccessibility(cartDrawerNote);
    }

    this.classList.add('animate', 'active');
    document.body.classList.add('overflow-hidden');

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        if (containerToTrapFocusOn && focusElement && typeof trapFocus === 'function') {
          trapFocus(containerToTrapFocusOn, focusElement);
        }
      },
      { once: true }
    );
  }

  close() {
    this.classList.remove('active');
    if (typeof removeTrapFocus === 'function') removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling && cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    if (typeof onKeyUpEscape === 'function') {
      cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
    }
  }

  renderContents(parsedState) {
    if (this.classList.contains('is-empty')) this.classList.remove('is-empty');
    this.productId = parsedState.id;

    if (!parsedState.sections) return;

    this.getSectionsToRender().forEach((section) => {
      const html = parsedState.sections[section.id];
      if (!html) return;
      const target = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);
      if (!target) return;
      const parsed = this._domParser.parseFromString(html, 'text/html');
      const sourceSelector = section.selector || '.shopify-section';
      const source = parsed.querySelector(sourceSelector);
      if (!source) return;
      target.innerHTML = source.innerHTML;
    });

    document.dispatchEvent(new CustomEvent('cart-drawer:rendered'));
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return this._domParser.parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return this._domParser.parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
