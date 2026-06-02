/**
 * Build Your Attar Box — plan selection, product picker, batched cart add.
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-byb-root]');
  if (!root) return;

  var configEl = root.querySelector('[data-byb-config]');
  if (!configEl) return;

  var config;
  try {
    config = JSON.parse(configEl.textContent);
  } catch (e) {
    return;
  }

  var planButtons = Array.prototype.slice.call(root.querySelectorAll('[data-byb-plan]'));
  var gridSection = root.querySelector('[data-byb-grid-section]');
  var grid = root.querySelector('[data-byb-grid]');
  var cards = grid
    ? Array.prototype.slice.call(grid.querySelectorAll('[data-byb-card]'))
    : [];
  var dock = root.querySelector('[data-byb-dock]');
  var dockCount = root.querySelector('[data-byb-dock-count]');
  var dockLabel = root.querySelector('[data-byb-dock-label]');
  var dockSubmit = root.querySelector('[data-byb-dock-submit]');
  var dockSubmitText = root.querySelector('[data-byb-dock-submit-text]');
  var dockPreviews = root.querySelector('[data-byb-dock-previews]');
  var toast = root.querySelector('[data-byb-toast]');
  var heroCta = root.querySelector('[data-byb-hero-cta]');
  var plansAnchor = root.querySelector('#build-box-plans');

  var state = {
    planSize: null,
    planPriceLabel: '',
    selected: [],
  };

  var toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2800);
  }

  function getMax() {
    return state.planSize || 0;
  }

  function findCard(variantId) {
    var id = String(variantId);
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute('data-variant-id') === id) return cards[i];
    }
    return null;
  }

  function renderDockPreviews() {
    if (!dockPreviews) return;
    dockPreviews.innerHTML = '';
    var max = getMax();
    for (var i = 0; i < max; i++) {
      var thumb = document.createElement('div');
      thumb.className = 'byb-dock__thumb';
      var vid = state.selected[i];
      if (vid) {
        var card = findCard(vid);
        if (card) {
          var imgSrc = card.getAttribute('data-product-image');
          if (imgSrc) {
            var img = document.createElement('img');
            img.src = imgSrc;
            img.alt = '';
            img.width = 80;
            img.height = 80;
            img.loading = 'lazy';
            img.decoding = 'async';
            thumb.appendChild(img);
          }
        }
      } else {
        thumb.classList.add('byb-dock__thumb--empty');
      }
      dockPreviews.appendChild(thumb);
    }
  }

  function render() {
    var max = getMax();
    var count = state.selected.length;
    var isComplete = max > 0 && count >= max;

    planButtons.forEach(function (btn) {
      var size = parseInt(btn.getAttribute('data-plan-size'), 10);
      btn.classList.toggle('is-active', size === state.planSize);
      btn.setAttribute('aria-pressed', size === state.planSize ? 'true' : 'false');
    });

    if (gridSection) {
      gridSection.classList.toggle('is-locked', !state.planSize);
      gridSection.classList.toggle('is-complete', isComplete);
    }

    root.classList.toggle('is-plan-active', !!state.planSize);

    cards.forEach(function (card) {
      var vid = card.getAttribute('data-variant-id');
      var idx = state.selected.indexOf(vid);
      var available = card.getAttribute('data-available') !== 'false';
      var toggleAdd = card.querySelector('[data-byb-toggle-add]');
      var toggleOn = card.querySelector('[data-byb-toggle-on]');

      if (idx > -1) {
        card.classList.add('is-selected');
        card.classList.remove('is-disabled');
        card.setAttribute('aria-pressed', 'true');
        if (toggleAdd) toggleAdd.hidden = true;
        if (toggleOn) toggleOn.hidden = false;
      } else {
        card.classList.remove('is-selected');
        card.setAttribute('aria-pressed', 'false');
        if (toggleAdd) toggleAdd.hidden = false;
        if (toggleOn) toggleOn.hidden = true;

        if (!state.planSize || !available || (count >= max && max > 0)) {
          card.classList.add('is-disabled');
        } else {
          card.classList.remove('is-disabled');
        }
      }
    });

    if (dockCount) {
      dockCount.textContent = max ? count + ' / ' + max + ' Selected' : 'Select a plan';
    }

    if (dockLabel) {
      if (!state.planSize) {
        dockLabel.textContent = 'Choose your ritual size to begin';
      } else if (isComplete) {
        dockLabel.textContent = 'Ready to add your ritual box';
      } else {
        dockLabel.textContent = state.planPriceLabel + ' · pick ' + (max - count) + ' more';
      }
    }

    if (dockSubmit) {
      var ready = isComplete;
      dockSubmit.disabled = !ready;
      dockSubmit.setAttribute('aria-disabled', ready ? 'false' : 'true');
    }

    if (dockSubmitText) {
      if (!state.planSize) {
        dockSubmitText.textContent = 'Add Ritual Box to Cart';
      } else if (isComplete) {
        dockSubmitText.textContent = config.ctaReady || 'Add Ritual Box to Cart';
      } else {
        dockSubmitText.textContent = state.planPriceLabel || 'Add Ritual Box to Cart';
      }
    }

    renderDockPreviews();
  }

  function selectPlan(size, priceLabel) {
    if (state.planSize !== size) {
      state.selected = [];
    }
    state.planSize = size;
    state.planPriceLabel = priceLabel;
    render();

    if (gridSection) {
      gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function toggleCard(card) {
    if (!state.planSize) {
      showToast('Choose a plan first.');
      if (plansAnchor) plansAnchor.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    var vid = card.getAttribute('data-variant-id');
    if (!vid || card.getAttribute('data-available') === 'false') return;

    var idx = state.selected.indexOf(vid);
    var max = getMax();

    if (idx > -1) {
      state.selected.splice(idx, 1);
      render();
      return;
    }

    if (state.selected.length >= max) {
      showToast(config.msgComplete || 'Your ritual box is complete.');
      return;
    }

    state.selected.push(vid);
    render();
  }

  function getCartDrawer() {
    return document.querySelector('cart-drawer');
  }

  function getSectionIds(drawer) {
    if (!drawer || typeof drawer.getSectionsToRender !== 'function') return '';
    return drawer
      .getSectionsToRender()
      .map(function (s) {
        return s.id;
      })
      .join(',');
  }

  function openCartWithState(cartState, triggerEl) {
    var drawer = getCartDrawer();
    if (drawer) {
      drawer.open(triggerEl || dockSubmit);
      if (cartState && cartState.sections && typeof drawer.renderContents === 'function') {
        drawer.renderContents(cartState);
      }
    }
    if (typeof publish === 'function' && window.PUB_SUB_EVENTS) {
      publish(window.PUB_SUB_EVENTS.cartUpdate, {
        source: 'build-your-attar-box',
        cartData: cartState,
      });
    }
    document.dispatchEvent(
      new CustomEvent('cart:updated', { detail: cartState, bubbles: true })
    );
  }

  function refreshCartDrawer(triggerEl) {
    var drawer = getCartDrawer();
    var sectionIds = getSectionIds(drawer);
    if (!drawer || !sectionIds) {
      return Promise.resolve();
    }

    var rootUrl = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
    return fetch(rootUrl + '?sections=' + encodeURIComponent(sectionIds))
      .then(function (res) {
        return res.json();
      })
      .then(function (sections) {
        openCartWithState({ sections: sections }, triggerEl);
      });
  }

  function addToCart() {
    var max = getMax();
    if (!max || state.selected.length !== max) return;

    var items = state.selected.map(function (id) {
      return { id: parseInt(id, 10), quantity: 1 };
    });

    var drawer = getCartDrawer();
    var payload = { items: items };
    var sectionIds = getSectionIds(drawer);
    if (sectionIds) {
      payload.sections = sectionIds;
      payload.sections_url = window.location.pathname;
    }

    if (dockSubmit) {
      dockSubmit.disabled = true;
      dockSubmit.classList.add('is-loading');
    }
    if (dockSubmitText) dockSubmitText.textContent = 'Adding…';

    fetch((window.routes && window.routes.cart_add_url) || '/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok || result.body.status) {
          var msg =
            (result.body && (result.body.description || result.body.message)) ||
            'Could not add to cart.';
          throw new Error(msg);
        }
        if (result.body.sections) {
          openCartWithState(result.body, dockSubmit);
          return;
        }
        return refreshCartDrawer(dockSubmit).catch(function () {
          window.location.href =
            (window.routes && window.routes.cart_url) || '/cart';
        });
      })
      .then(function () {
        showToast(config.msgAdded || 'Your ritual box was added to cart.');
        if (dockSubmitText) dockSubmitText.textContent = 'Added ✓';
      })
      .catch(function (err) {
        showToast(err.message || 'Something went wrong. Please try again.');
        if (dockSubmitText) dockSubmitText.textContent = config.ctaReady || 'Add Ritual Box to Cart';
      })
      .finally(function () {
        if (dockSubmit) {
          dockSubmit.classList.remove('is-loading');
          render();
        }
      });
  }

  planButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var size = parseInt(btn.getAttribute('data-plan-size'), 10);
      var price = btn.getAttribute('data-plan-price') || '';
      selectPlan(size, price);
    });
  });

  cards.forEach(function (card) {
    var toggle = card.querySelector('[data-byb-toggle]');
    if (toggle) {
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        toggleCard(card);
      });
    }
    card.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      if (e.target.closest('[data-byb-toggle]')) return;
      toggleCard(card);
    });
  });

  if (dockSubmit) {
    dockSubmit.addEventListener('click', addToCart);
  }

  if (heroCta && plansAnchor) {
    heroCta.addEventListener('click', function () {
      plansAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if ('IntersectionObserver' in window) {
    var revealObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            root.classList.add('is-visible');
            revealObs.disconnect();
          }
        });
      },
      { threshold: 0.08 }
    );
    revealObs.observe(root);
  } else {
    root.classList.add('is-visible');
  }

  render();
})();
