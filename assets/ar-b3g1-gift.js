/**
 * Anand Rasa — Buy 3 Attars Get 1 Mohini Free
 * Listens to cart updates; auto-adds/removes gift; prevents loops.
 */
(function () {
  'use strict';

  if (window.__arB3g1GiftBooted) return;
  window.__arB3g1GiftBooted = true;

  var SOURCE = 'ar-b3g1';
  var config = null;
  var syncing = false;
  var queued = false;
  var timer = null;

  function readConfig() {
    var el = document.getElementById('ar-b3g1-gift-config');
    if (!el || !el.textContent) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  function routes() {
    return window.routes || {};
  }

  function cartUrl() {
    return routes().cart_url || '/cart';
  }

  function cartAddUrl() {
    return routes().cart_add_url || '/cart/add.js';
  }

  function cartChangeUrl() {
    return routes().cart_change_url || '/cart/change.js';
  }

  function cartJsUrl() {
    var base = cartUrl().replace(/\/$/, '');
    return base + '.js';
  }

  function isGiftItem(item) {
    if (!item || !item.properties) return false;
    var key = config.propertyKey;
    var val = String(config.propertyValue);
    if (item.properties[key] != null && String(item.properties[key]) === val) return true;
    return false;
  }

  function isEligibleAttar(item) {
    if (!item || isGiftItem(item)) return false;

    var type = String(item.product_type || '').toLowerCase();
    var title = String(item.product_title || item.title || '').toLowerCase();
    var handle = String(item.handle || '').toLowerCase();
    var blob = type + '|' + title + '|' + handle;

    if (blob.indexOf('incense') !== -1 || blob.indexOf('agarbatti') !== -1) return false;

    if (
      type.indexOf('attar') !== -1 ||
      type.indexOf('perfume oil') !== -1 ||
      type.indexOf('perfume-oil') !== -1 ||
      type.indexOf('fragrance oil') !== -1
    ) {
      return true;
    }

    if (title.indexOf('attar') !== -1 || handle.indexOf('attar') !== -1) return true;

    return false;
  }

  function countEligible(items) {
    var total = 0;
    (items || []).forEach(function (item) {
      if (isEligibleAttar(item)) total += Number(item.quantity) || 0;
    });
    return total;
  }

  function getGiftLines(items) {
    return (items || []).filter(isGiftItem);
  }

  function desiredGiftQty(eligibleQty) {
    if (eligibleQty < config.threshold) return 0;
    var sets = Math.floor(eligibleQty / config.threshold);
    return Math.min(config.maxGifts || 1, sets);
  }

  function sectionPayload() {
    return {
      sections: (config.sections || []).join(','),
      sections_url: window.location.pathname
    };
  }

  function publishUpdate(cartData) {
    try {
      if (typeof publish === 'function' && window.PUB_SUB_EVENTS) {
        publish(window.PUB_SUB_EVENTS.cartUpdate, {
          source: SOURCE,
          cartData: cartData
        });
      }
    } catch (e) {
      /* ignore */
    }
    try {
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: cartData, bubbles: true }));
    } catch (e2) {
      /* ignore */
    }
  }

  function applySections(state) {
    if (!state || !state.sections) return;
    var drawer = document.querySelector('cart-drawer');
    if (drawer && typeof drawer.renderContents === 'function' && state.sections['cart-drawer']) {
      drawer.renderContents(state);
    }

    /* Cart page sections */
    ['main-cart-items', 'main-cart-footer', 'cart-icon-bubble'].forEach(function (id) {
      if (!state.sections[id]) return;
      var host = document.getElementById(id) || document.getElementById('shopify-section-' + id);
      if (!host) return;
      try {
        var doc = new DOMParser().parseFromString(state.sections[id], 'text/html');
        if (id === 'cart-icon-bubble') {
          var bubbleTarget = document.getElementById('shopify-section-cart-icon-bubble') || host;
          var bubbleSource = doc.querySelector('.shopify-section') || doc.body;
          if (bubbleTarget && bubbleSource) bubbleTarget.innerHTML = bubbleSource.innerHTML;
          return;
        }
        var jsContents = host.querySelector('.js-contents');
        var sourceContents = doc.querySelector('.js-contents');
        if (jsContents && sourceContents) {
          jsContents.innerHTML = sourceContents.innerHTML;
        }
      } catch (err) {
        /* ignore section paint errors */
      }
    });
  }

  function fetchCart() {
    return fetch(cartJsUrl(), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('cart fetch failed');
      return res.json();
    });
  }

  function addGift(qty) {
    var props = {};
    props[config.propertyKey] = config.propertyValue;

    var body = Object.assign(
      {
        items: [
          {
            id: Number(config.giftVariantId),
            quantity: qty,
            properties: props
          }
        ]
      },
      sectionPayload()
    );

    return fetch(cartAddUrl(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || data.status) {
          throw new Error(data.description || data.message || 'gift add failed');
        }
        return data;
      });
    });
  }

  function changeLine(key, quantity) {
    var body = Object.assign(
      {
        id: key,
        quantity: quantity
      },
      sectionPayload()
    );

    return fetch(cartChangeUrl(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || data.errors) {
          throw new Error(data.errors || data.description || 'gift change failed');
        }
        return data;
      });
    });
  }

  function sync(cart) {
    if (!config || !config.giftVariantId) return Promise.resolve();
    if (syncing) {
      queued = true;
      return Promise.resolve();
    }

    syncing = true;
    var mutated = false;

    var run = function (state) {
      var items = state.items || [];
      var eligible = countEligible(items);
      var want = config.enabled ? desiredGiftQty(eligible) : 0;
      var gifts = getGiftLines(items);
      var have = gifts.reduce(function (sum, g) {
        return sum + (Number(g.quantity) || 0);
      }, 0);

      if (want === 0 && have === 0) return Promise.resolve(state);

      if (want === 0 && have > 0) {
        mutated = true;
        return gifts
          .reduce(function (chain, gift) {
            return chain.then(function () {
              return changeLine(gift.key, 0);
            });
          }, Promise.resolve())
          .then(function (last) {
            return last && last.items ? last : fetchCart();
          });
      }

      if (want > 0 && have === 0) {
        mutated = true;
        return addGift(want).then(function (added) {
          if (added && added.sections) return added;
          return fetchCart();
        });
      }

      if (want > 0 && have > 0) {
        var primary = gifts[0];
        var extras = gifts.slice(1);
        var needsQtyFix = Number(primary.quantity) !== want;
        var needsCleanup = extras.length > 0;

        if (!needsQtyFix && !needsCleanup) {
          return Promise.resolve(state);
        }

        mutated = true;
        var chain = Promise.resolve();
        extras.forEach(function (gift) {
          chain = chain.then(function () {
            return changeLine(gift.key, 0);
          });
        });

        return chain
          .then(function () {
            if (needsQtyFix) return changeLine(primary.key, want);
            return null;
          })
          .then(function (last) {
            if (last && last.items) return last;
            return fetchCart();
          });
      }

      return Promise.resolve(state);
    };

    var start = cart && cart.items ? Promise.resolve(cart) : fetchCart();

    return start
      .then(run)
      .then(function (finalState) {
        if (!mutated) return finalState;
        if (!finalState) return fetchCart();
        if (finalState.sections) {
          applySections(finalState);
          publishUpdate(finalState);
          return finalState;
        }
        return fetch(cartUrl() + '?sections=' + (config.sections || []).join(','), {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (sectionMap) {
            if (sectionMap) {
              finalState.sections = sectionMap;
              applySections(finalState);
            }
            publishUpdate(finalState);
            return finalState;
          })
          .catch(function () {
            publishUpdate(finalState);
            return finalState;
          });
      })
      .catch(function (err) {
        if (window.console) console.warn('[ar-b3g1]', err);
      })
      .then(function (result) {
        syncing = false;
        if (queued) {
          queued = false;
          schedule(80);
        }
        return result;
      });
  }

  function schedule(delay) {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      timer = null;
      sync();
    }, delay == null ? 120 : delay);
  }

  function onCartEvent(event) {
    if (event && event.source === SOURCE) return;
    if (event && event.detail && event.detail.source === SOURCE) return;
    schedule(150);
  }

  function boot() {
    config = readConfig();
    if (!config || !config.giftVariantId) return;

    if (typeof subscribe === 'function' && window.PUB_SUB_EVENTS) {
      subscribe(window.PUB_SUB_EVENTS.cartUpdate, onCartEvent);
    }

    document.addEventListener('cart:updated', onCartEvent);
    document.addEventListener('cart-drawer:rendered', function () {
      schedule(200);
    });

    /* Initial sync for existing carts */
    schedule(400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
