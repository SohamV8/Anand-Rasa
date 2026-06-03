/**
 * Build Your Attar Box — luxury ritual configurator
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

  var planButtons = [].slice.call(root.querySelectorAll('[data-byb-plan]'));
  var gridSection = root.querySelector('[data-byb-grid-section]');
  var grid = root.querySelector('[data-byb-grid]');
  var cards = [].slice.call(root.querySelectorAll('[data-byb-card]'));
  var dock = root.querySelector('[data-byb-dock]');
  var dockCount = root.querySelector('[data-byb-dock-count]');
  var dockStatus = root.querySelector('[data-byb-dock-status]');
  var dockProgress = root.querySelector('[data-byb-dock-progress]');
  var dockCompare = root.querySelector('[data-byb-dock-compare]');
  var dockRitual = root.querySelector('[data-byb-dock-ritual]');
  var dockSavings = root.querySelector('[data-byb-dock-savings]');
  var dockPricing = root.querySelector('[data-byb-dock-pricing]');
  var dockSubmit = root.querySelector('[data-byb-dock-submit]');
  var dockSubmitText = root.querySelector('[data-byb-dock-submit-text]');
  var dockPreviews = root.querySelector('[data-byb-dock-previews]');
  var toast = root.querySelector('[data-byb-toast]');
  var heroCta = root.querySelector('[data-byb-hero-cta]');
  var plansAnchor = root.querySelector('#build-box-plans');

  var state = {
    planSize: null,
    selected: [],
    celebrated: false,
    confettiReady: false,
  };

  var toastTimer;

  function formatMoney(cents) {
    var amount = Math.round(cents) / 100;
    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, config.moneyFormat || '{{amount}}');
    }
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: config.currency || 'INR',
        maximumFractionDigits: 0,
      }).format(amount);
    } catch (e) {
      return '₹' + amount.toLocaleString('en-IN');
    }
  }

  function getPlanConfig() {
    if (!state.planSize || !config.plans) return null;
    return config.plans[String(state.planSize)] || null;
  }

  function getMax() {
    return state.planSize || 0;
  }

  function getBundleCents() {
    var plan = getPlanConfig();
    return plan ? plan.bundleCents : 0;
  }

  function getRetailTotal() {
    var total = 0;
    state.selected.forEach(function (vid) {
      var card = findCard(vid);
      if (card) {
        total += parseInt(card.getAttribute('data-variant-price'), 10) || 0;
      }
    });
    return total;
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3000);
  }

  function findCard(variantId) {
    var id = String(variantId);
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute('data-variant-id') === id) return cards[i];
    }
    return null;
  }

  function loadConfetti(cb) {
    if (window.BuildBoxConfetti) {
      state.confettiReady = true;
      if (cb) cb(window.BuildBoxConfetti.fire);
      return;
    }
    var existing = document.querySelector('script[data-byb-confetti]');
    if (existing) {
      existing.addEventListener('load', function () {
        if (window.BuildBoxConfetti && cb) cb(window.BuildBoxConfetti.fire);
      });
      return;
    }
    var s = document.createElement('script');
    s.src =
      (document.querySelector('[data-byb-confetti-src]') &&
        document.querySelector('[data-byb-confetti-src]').getAttribute('data-byb-confetti-src')) ||
      '';
    if (!s.src && root.dataset.confettiSrc) s.src = root.dataset.confettiSrc;
    if (!s.src) {
      var link = document.querySelector('script[src*="build-box-confetti"]');
      if (link) s.src = link.src;
    }
    if (!s.src) return;
    s.defer = true;
    s.setAttribute('data-byb-confetti', '');
    s.onload = function () {
      state.confettiReady = true;
      if (cb && window.BuildBoxConfetti) cb(window.BuildBoxConfetti.fire);
    };
    document.body.appendChild(s);
  }

  function fireCelebration() {
    if (state.celebrated) return;
    state.celebrated = true;
    root.classList.add('is-ritual-complete');

    function run(fire) {
      if (fire) fire({ root: dock || root });
    }

    if (window.BuildBoxConfetti) {
      run(window.BuildBoxConfetti.fire);
    } else {
      loadConfetti(run);
    }
  }

  function animateFlyToDock(card) {
    if (!dockPreviews || !card) return;
    var img = card.querySelector('.byb-card__img');
    if (!img || !img.src) return;

    var from = img.getBoundingClientRect();
    var slot = dockPreviews.querySelector('.byb-dock__thumb:last-child:not(.byb-dock__thumb--empty)');
    if (!slot) slot = dockPreviews.querySelector('.byb-dock__thumb');
    if (!slot) return;

    var to = slot.getBoundingClientRect();
    var ghost = img.cloneNode(true);
    ghost.className = 'byb-fly-ghost';
    ghost.style.cssText =
      'position:fixed;left:' +
      from.left +
      'px;top:' +
      from.top +
      'px;width:' +
      from.width +
      'px;height:' +
      from.height +
      'px;z-index:60;pointer-events:none;object-fit:contain;transition:transform 0.55s cubic-bezier(0.22,1,0.36,1),opacity 0.55s ease;border-radius:8px;';
    document.body.appendChild(ghost);

    requestAnimationFrame(function () {
      var dx = to.left + to.width / 2 - (from.left + from.width / 2);
      var dy = to.top + to.height / 2 - (from.top + from.height / 2);
      var scale = Math.min(to.width / from.width, to.height / from.height, 0.45);
      ghost.style.transform =
        'translate3d(' + dx + 'px,' + dy + 'px,0) scale(' + scale + ')';
      ghost.style.opacity = '0.92';
    });

    setTimeout(function () {
      ghost.style.opacity = '0';
      setTimeout(function () {
        ghost.remove();
      }, 400);
    }, 520);
  }

  function renderDockPreviews(prevCount) {
    if (!dockPreviews) return;
    var max = getMax();
    var html = '';

    for (var i = 0; i < max; i++) {
      var vid = state.selected[i];
      if (vid) {
        var card = findCard(vid);
        var src = card ? card.getAttribute('data-product-image') : '';
        html +=
          '<div class="byb-dock__thumb">' +
          (src ? '<img src="' + src + '" alt="" width="80" height="80" loading="lazy" decoding="async">' : '') +
          '</div>';
      } else {
        html += '<div class="byb-dock__thumb byb-dock__thumb--empty"></div>';
      }
    }

    dockPreviews.innerHTML = html;

    if (prevCount !== undefined && state.selected.length > prevCount) {
      var lastCard = findCard(state.selected[state.selected.length - 1]);
      animateFlyToDock(lastCard);
    }
  }

  function renderPricing(isComplete) {
    var plan = getPlanConfig();
    var bundleCents = getBundleCents();
    var retail = getRetailTotal();
    var count = state.selected.length;

    if (!plan || !state.planSize) {
      if (dockPricing) dockPricing.classList.remove('is-active', 'is-complete');
      if (dockCompare) {
        dockCompare.textContent = '';
        dockCompare.setAttribute('aria-hidden', 'true');
      }
      if (dockRitual) dockRitual.textContent = '';
      if (dockSavings) dockSavings.hidden = true;
      return;
    }

    if (dockRitual) {
      dockRitual.textContent = count > 0 ? plan.display || formatMoney(bundleCents) : plan.display;
    }

    if (dockCompare) {
      if (isComplete && retail > bundleCents) {
        dockCompare.textContent = formatMoney(retail);
        dockCompare.removeAttribute('aria-hidden');
      } else {
        dockCompare.textContent = '';
        dockCompare.setAttribute('aria-hidden', 'true');
      }
    }

    if (dockPricing) {
      dockPricing.classList.toggle('is-active', count > 0);
      dockPricing.classList.toggle('is-complete', isComplete);
    }

    if (dockSavings) {
      var showSavings = isComplete && retail > bundleCents;
      dockSavings.hidden = !showSavings;
      dockSavings.classList.toggle('is-revealed', showSavings);
    }
  }

  function render() {
    var max = getMax();
    var count = state.selected.length;
    var isComplete = max > 0 && count === max;
    var prevCount = render._prevCount || 0;
    render._prevCount = count;

    if (!isComplete) state.celebrated = false;

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
    root.classList.toggle('is-ritual-complete', isComplete);
    if (dock) dock.classList.toggle('is-complete', isComplete);

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
        card.classList.remove('is-selected', 'is-pulse');
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
      if (!state.planSize) {
        dockCount.textContent = 'Select a ritual size';
      } else {
        dockCount.textContent = count + ' of ' + max + ' Rituals Selected';
      }
    }

    if (dockStatus) {
      if (!state.planSize) {
        dockStatus.textContent = 'Choose your plan to begin curating';
      } else if (isComplete) {
        dockStatus.textContent = 'Your Ritual is Ready';
      } else if (count === 0) {
        dockStatus.textContent = 'Your Ritual Box is waiting — add your first attar';
      } else {
        dockStatus.textContent = 'Your Ritual Box is Almost Complete';
      }
    }

    if (dockProgress && max) {
      dockProgress.style.width = Math.min(100, (count / max) * 100) + '%';
    }

    if (dockSubmit) {
      dockSubmit.disabled = !isComplete;
      dockSubmit.setAttribute('aria-disabled', isComplete ? 'false' : 'true');
      dockSubmit.classList.toggle('is-ready', isComplete);
    }

    if (dockSubmitText) {
      if (!state.planSize) {
        dockSubmitText.textContent = config.ctaReady || 'Add Ritual Box to Cart';
      } else if (isComplete) {
        dockSubmitText.textContent = config.ctaReady || 'Add Ritual Box to Cart';
      } else {
        var plan = getPlanConfig();
        dockSubmitText.textContent = (plan && plan.label) || 'Complete Your Ritual';
      }
    }

    renderPricing(isComplete);
    renderDockPreviews(prevCount);

    if (isComplete && !state.celebrated) {
      fireCelebration();
    }
  }

  function selectPlan(size) {
    if (state.planSize !== size) {
      state.selected = [];
      state.celebrated = false;
    }
    state.planSize = size;
    render();

    if (gridSection) {
      gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function toggleCard(card) {
    if (!state.planSize) {
      showToast('Choose a ritual size first.');
      if (plansAnchor) plansAnchor.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    var vid = card.getAttribute('data-variant-id');
    if (!vid || card.getAttribute('data-available') === 'false') return;

    var idx = state.selected.indexOf(vid);
    var max = getMax();

    if (idx > -1) {
      state.selected.splice(idx, 1);
      card.classList.add('is-removing');
      setTimeout(function () {
        card.classList.remove('is-removing');
      }, 400);
      render();
      return;
    }

    if (state.selected.length >= max) {
      showToast(config.msgComplete || 'Your ritual box is complete.');
      return;
    }

    state.selected.push(vid);
    card.classList.add('is-pulse');
    setTimeout(function () {
      card.classList.remove('is-pulse');
    }, 600);
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
    if (!drawer || !sectionIds) return Promise.resolve();

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
          window.location.href = (window.routes && window.routes.cart_url) || '/cart';
        });
      })
      .then(function () {
        showToast(config.msgAdded || 'Your ritual box was added to cart.');
        if (dockSubmitText) dockSubmitText.textContent = 'Added ✓';
        root.classList.add('is-cart-success');
      })
      .catch(function (err) {
        showToast(err.message || 'Something went wrong. Please try again.');
        if (dockSubmitText) dockSubmitText.textContent = config.ctaReady || 'Add Ritual Box to Cart';
      })
      .finally(function () {
        if (dockSubmit) dockSubmit.classList.remove('is-loading');
        render();
      });
  }

  planButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectPlan(parseInt(btn.getAttribute('data-plan-size'), 10));
    });
  });

  cards.forEach(function (card) {
    var toggle = card.querySelector('[data-byb-toggle]');
    if (toggle) {
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleCard(card);
      });
    }
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('a')) return;
        e.preventDefault();
        toggleCard(card);
      }
    });
  });

  if (dockSubmit) dockSubmit.addEventListener('click', addToCart);

  if (heroCta) {
    heroCta.addEventListener('click', function () {
      var scrollTarget = plansAnchor || gridSection;
      if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  var hero = root.querySelector('.byb-hero--cinematic');
  if (hero) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        hero.classList.add('byb-hero--animate');
      });
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
      { threshold: 0.06 }
    );
    revealObs.observe(root);
  } else {
    root.classList.add('is-visible');
  }

  [].slice.call(root.querySelectorAll('.byb-grid__item')).forEach(function (item, i) {
    item.style.setProperty('--byb-i', String(i));
  });

  // Fixed-plan pages (no picker): pre-select ritual size so the grid is unlocked immediately.
  var defaultPlan = parseInt(root.getAttribute('data-byb-default-plan'), 10);
  if (defaultPlan > 0 && planButtons.length === 0) {
    state.planSize = defaultPlan;
  } else if (planButtons.length === 1) {
    var onlySize = parseInt(planButtons[0].getAttribute('data-plan-size'), 10);
    if (onlySize > 0) state.planSize = onlySize;
  }

  render();
})();
