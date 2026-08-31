/**
 * Product pack selector — syncs native radio qty with Dawn quantity input.
 * Updates display prices for 6ml / 12ml size variants.
 */
(function () {
  'use strict';

  var BASE_LABELS = {
    1: 'Single',
    2: 'Pack of 2',
    3: 'Pack of 3'
  };

  function formatMoney(cents, format) {
    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, format || '{{amount}}');
    }
    return '₹' + (cents / 100).toFixed(2);
  }

  function detectSize(variant) {
    if (!variant) return '';
    var scope = [
      variant.title,
      variant.option1,
      variant.option2,
      variant.option3,
      variant.name,
      variant.public_title
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (scope.indexOf('12ml') !== -1 || scope.indexOf('12 ml') !== -1) return '12ml';
    if (scope.indexOf('6ml') !== -1 || scope.indexOf('6 ml') !== -1) return '6ml';
    return '';
  }

  function parseConfig(root) {
    var script =
      (root.parentElement && root.parentElement.querySelector('[data-ar-pack-config]')) ||
      document.querySelector('[data-ar-pack-config]');
    if (script && script.textContent) {
      try {
        return JSON.parse(script.textContent);
      } catch (e) {
        return {};
      }
    }
    try {
      return JSON.parse(root.getAttribute('data-config') || '{}');
    } catch (e2) {
      return {};
    }
  }

  function PackSelector(root) {
    this.root = root;
    this.config = parseConfig(root);
    this.sectionId = this.config.sectionId;
    this.listeners = [];
    this.unsubscribers = [];
  }

  PackSelector.prototype.bind = function (el, type, fn, opts) {
    if (!el || !fn) return;
    el.addEventListener(type, fn, opts);
    this.listeners.push([el, type, fn, opts]);
  };

  PackSelector.prototype.destroy = function () {
    this.listeners.forEach(function (entry) {
      entry[0].removeEventListener(entry[1], entry[2], entry[3]);
    });
    this.listeners.length = 0;
    this.unsubscribers.forEach(function (unsub) {
      if (typeof unsub === 'function') unsub();
    });
    this.unsubscribers.length = 0;
    this.root.__arPackSelector = null;
  };

  PackSelector.prototype.getQuantityInput = function () {
    return document.getElementById('Quantity-' + this.sectionId);
  };

  PackSelector.prototype.getSelectedQty = function () {
    var checked = this.root.querySelector('.anand-rasa-pack-selector__input:checked');
    return checked ? parseInt(checked.value, 10) : 1;
  };

  PackSelector.prototype.syncQuantity = function () {
    var qtyInput = this.getQuantityInput();
    if (!qtyInput) return;
    var qty = this.getSelectedQty();
    var min = parseInt(qtyInput.getAttribute('min') || qtyInput.dataset.min || '1', 10);
    var maxAttr = qtyInput.getAttribute('max') || qtyInput.dataset.max;
    var max = maxAttr ? parseInt(maxAttr, 10) : null;

    if (max && qty > max) qty = max;
    if (qty < min) qty = min;

    qtyInput.value = qty;
    qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
  };

  PackSelector.prototype.resolvePackTotals = function (sizeLabel, unitCents) {
    var sizes = this.config.sizes || {};
    var sizeCfg = (sizeLabel && sizes[sizeLabel]) || null;
    var pack2 = sizeCfg && sizeCfg.pack2TotalCents > 0 ? sizeCfg.pack2TotalCents : this.config.pack2TotalCents;
    var pack3 = sizeCfg && sizeCfg.pack3TotalCents > 0 ? sizeCfg.pack3TotalCents : this.config.pack3TotalCents;

    if (!(pack2 > 0)) pack2 = unitCents * 2;
    if (!(pack3 > 0)) pack3 = unitCents * 3;

    return { pack2: pack2, pack3: pack3 };
  };

  PackSelector.prototype.updateSizeLabels = function (sizeLabel) {
    var note = this.root.querySelector('[data-ar-pack-size-note]');
    if (note) {
      if (sizeLabel) {
        note.hidden = false;
        note.textContent = 'For ' + String(sizeLabel).toUpperCase();
      } else {
        note.hidden = true;
        note.textContent = '';
      }
    }

    Object.keys(BASE_LABELS).forEach(
      function (qty) {
        var row = this.root.querySelector('[data-ar-pack-row="' + qty + '"]');
        if (!row) return;
        var nameEl = row.querySelector('[data-ar-pack-name]');
        var input = row.querySelector('.anand-rasa-pack-selector__input');
        var label = BASE_LABELS[qty];
        if (sizeLabel) label += ' · ' + sizeLabel;
        if (nameEl) nameEl.textContent = label;
        if (input) {
          var eachEl = row.querySelector('[data-ar-pack-each]');
          var totalEl = row.querySelector('[data-ar-pack-total]');
          var saveEl = row.querySelector('[data-ar-pack-save]');
          var parts = [label];
          if (eachEl) parts.push(eachEl.textContent);
          if (totalEl) parts.push('total ' + totalEl.textContent);
          if (saveEl && !saveEl.hidden && saveEl.textContent) parts.push(saveEl.textContent);
          input.setAttribute('aria-label', parts.join(', '));
        }
      }.bind(this)
    );
  };

  PackSelector.prototype.updatePrices = function (unitCents, sizeLabel) {
    if (!unitCents) return;
    var totals = this.resolvePackTotals(sizeLabel, unitCents);
    var fmt = this.config.moneyFormat;

    var packs = [
      { qty: 1, total: unitCents },
      { qty: 2, total: totals.pack2 },
      { qty: 3, total: totals.pack3 }
    ];

    packs.forEach(
      function (pack) {
        var row = this.root.querySelector('[data-ar-pack-row="' + pack.qty + '"]');
        if (!row) return;

        var eachEl = row.querySelector('[data-ar-pack-each]');
        var totalEl = row.querySelector('[data-ar-pack-total]');
        var saveEl = row.querySelector('[data-ar-pack-save]');

        var retail = unitCents * pack.qty;
        var each = Math.round(pack.total / pack.qty);

        if (totalEl) totalEl.textContent = formatMoney(pack.total, fmt);
        if (eachEl) eachEl.textContent = formatMoney(each, fmt) + ' each';

        if (saveEl) {
          var save = retail - pack.total;
          if (save > 0) {
            saveEl.hidden = false;
            saveEl.textContent = 'You save ' + formatMoney(save, fmt);
          } else {
            saveEl.hidden = true;
            saveEl.textContent = '';
          }
        }
      }.bind(this)
    );

    this.updateSizeLabels(sizeLabel || '');
  };

  PackSelector.prototype.onVariantChange = function (event) {
    if (!event || !event.data) return;
    if (String(event.data.sectionId) !== String(this.sectionId)) return;
    var variant = event.data.variant;
    if (variant && variant.price != null) {
      this.updatePrices(variant.price, detectSize(variant));
    }
    this.syncQuantity();
  };

  PackSelector.prototype.init = function () {
    var self = this;

    this.bind(this.root, 'change', function (event) {
      if (!event.target.classList.contains('anand-rasa-pack-selector__input')) return;
      self.syncQuantity();
    });

    this.syncQuantity();

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      var unsub = subscribe(PUB_SUB_EVENTS.variantChange, function (event) {
        self.onVariantChange(event);
      });
      this.unsubscribers.push(unsub);
    }

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      var unsubQty = subscribe(PUB_SUB_EVENTS.quantityUpdate, function () {
        var qtyInput = self.getQuantityInput();
        if (!qtyInput) return;
        var val = parseInt(qtyInput.value, 10);
        var radio = self.root.querySelector('.anand-rasa-pack-selector__input[value="' + val + '"]');
        if (radio) radio.checked = true;
      });
      this.unsubscribers.push(unsubQty);
    }
  };

  function boot(scope) {
    (scope || document).querySelectorAll('[data-ar-pack-selector]').forEach(function (root) {
      if (root.__arPackSelector) return;
      var instance = new PackSelector(root);
      root.__arPackSelector = instance;
      instance.init();
    });
  }

  function teardown(scope) {
    (scope || document).querySelectorAll('[data-ar-pack-selector]').forEach(function (root) {
      if (root.__arPackSelector) root.__arPackSelector.destroy();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot(document);
    });
  } else {
    boot(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    boot(event.target);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    teardown(event.target);
  });
})();
