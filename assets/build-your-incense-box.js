/**
 * Build Your Incense Box — bundle builder
 */
(function () {
  'use strict';

  function initBuildIncenseBox() {
    var root = document.querySelector('[data-bib-root]');
    if (!root || root.dataset.bibInit === 'true') return;
    root.dataset.bibInit = 'true';

    var configEl = root.querySelector('[data-bib-config]');
    if (!configEl) return;

    var config;
    try {
      config = JSON.parse(configEl.textContent);
    } catch (e) {
      return;
    }

    var bundleSize = config.bundleSize || 3;
    var discountCode = config.discountCode || '';
    var cards = [].slice.call(root.querySelectorAll('[data-bib-card]'));
    var grid = root.querySelector('[data-bib-grid]');
    var progress = root.querySelector('[data-bib-progress]');
    var progressFill = root.querySelector('[data-bib-progress-fill]');
    var packEls = [].slice.call(root.querySelectorAll('[data-bib-pack]'));
    var counterEls = [].slice.call(root.querySelectorAll('[data-bib-counter]'));
    var dockCounter = root.querySelector('[data-bib-dock-counter]');
    var dockRemain = root.querySelector('[data-bib-dock-remain]');
    var dockItems = root.querySelector('[data-bib-dock-items]');
    var dockCheckout = root.querySelector('[data-bib-checkout]');
    var dockCheckoutText = root.querySelector('[data-bib-checkout-text]');
    var clearBtn = root.querySelector('[data-bib-clear]');
    var toast = root.querySelector('[data-bib-toast]');

    var modal = root.querySelector('[data-bib-modal]');
    var modalDialog = root.querySelector('[data-bib-modal-dialog]');
    var modalBody = root.querySelector('[data-bib-modal-body]');
    var modalHero = root.querySelector('[data-bib-modal-hero]');
    var modalThumbs = root.querySelector('[data-bib-modal-thumbs]');
    var modalTitle = root.querySelector('[data-bib-modal-title]');
    var modalCat = root.querySelector('[data-bib-modal-cat]');
    var modalNote = root.querySelector('[data-bib-modal-note]');
    var modalPrice = root.querySelector('[data-bib-modal-price]');
    var modalDesc = root.querySelector('[data-bib-modal-desc]');
    var modalDescWrap = root.querySelector('[data-bib-modal-desc-wrap]');
    var modalHighlights = root.querySelector('[data-bib-modal-highlights]');
    var modalAdd = root.querySelector('[data-bib-modal-add]');
    var modalAddLabel = root.querySelector('[data-bib-modal-add-label]');
    var modalProfile = root.querySelector('[data-bib-modal-profile]');
    var modalBurn = root.querySelector('[data-bib-modal-burn]');
    var modalBest = root.querySelector('[data-bib-modal-best]');
    var modalIng = root.querySelector('[data-bib-modal-ing]');

    var selected = [];
    var activeCard = null;
    var toastTimer;
    var lastFocus;
    var bibScrollY = 0;
    var celebrated = false;
    var dock = root.querySelector('[data-bib-dock]');

    function fireCelebration() {
      if (celebrated) return;
      celebrated = true;
      root.classList.add('is-box-complete');

      function run(fire) {
        if (fire) fire({ root: dock || root });
      }

      if (window.BuildBoxConfetti) {
        run(window.BuildBoxConfetti.fire);
      } else {
        var link = document.querySelector('script[src*="build-box-confetti"]');
        if (link) {
          link.addEventListener('load', function () {
            if (window.BuildBoxConfetti) run(window.BuildBoxConfetti.fire);
          }, { once: true });
        }
      }
    }

    function money(cents) {
      var amount = Math.round(cents) / 100;
      if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
        return Shopify.formatMoney(cents, config.moneyFormat || '{{amount}}');
      }
      return '₹' + amount.toLocaleString('en-IN');
    }

    function getCardData(card) {
      var el = card.querySelector('[data-bib-product-data]');
      if (!el) return null;
      try {
        return JSON.parse(el.textContent);
      } catch (err) {
        return null;
      }
    }

    function showToast(msg, isError) {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.toggle('is-error', !!isError);
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toast.classList.remove('is-visible');
      }, 2400);
    }

    function toggleInBox(card, silent) {
      var vid = String(card.getAttribute('data-variant-id'));
      var title = card.getAttribute('data-title') || 'Fragrance';
      var idx = selected.findIndex(function (s) { return s.id === vid; });

      if (idx > -1) {
        selected.splice(idx, 1);
        renderState();
        if (!silent) showToast('Removed "' + title + '" from your box.');
        return;
      }

      if (selected.length >= bundleSize) {
        showToast('Box full — remove one pack to swap.', true);
        return;
      }

      selected.push({ id: vid, title: title, card: card });
      renderState();
      if (!silent) showToast('Added "' + title + '" to your box.');
    }

    function renderState() {
      cards.forEach(function (card) {
        var vid = String(card.getAttribute('data-variant-id'));
        var idx = selected.findIndex(function (s) { return s.id === vid; });
        var rankEl = card.querySelector('[data-bib-rank]');
        var addLabel = card.querySelector('[data-bib-add-label]');

        if (idx > -1) {
          card.classList.add('is-selected');
          card.classList.remove('is-disabled');
          if (rankEl) rankEl.hidden = false;
          if (addLabel) addLabel.textContent = 'In Box';
        } else {
          card.classList.remove('is-selected');
          if (rankEl) rankEl.hidden = true;
          if (addLabel) addLabel.textContent = 'Add to Box';
          if (selected.length >= bundleSize) {
            card.classList.add('is-disabled');
          } else {
            card.classList.remove('is-disabled');
          }
        }
      });

      var count = selected.length;
      var pct = (Math.min(count, bundleSize) / bundleSize) * 100;

      counterEls.forEach(function (el) { el.textContent = String(count); });
      if (dockCounter) dockCounter.textContent = String(count);
      if (progressFill) progressFill.style.width = pct + '%';

      packEls.forEach(function (pack, i) {
        pack.classList.toggle('is-done', i < count);
      });

      if (progress) {
        progress.classList.toggle('is-complete', count === bundleSize);
      }

      if (count < bundleSize) {
        celebrated = false;
        root.classList.remove('is-box-complete');
      } else if (count === bundleSize && !celebrated) {
        fireCelebration();
      }

      if (dockRemain) {
        if (count === bundleSize) {
          dockRemain.textContent = 'Your box is ready';
        } else {
          var rem = bundleSize - count;
          dockRemain.textContent = rem + ' pack' + (rem === 1 ? '' : 's') + ' remaining';
        }
      }

      if (dockItems) {
        dockItems.innerHTML = '';
        selected.forEach(function (item, i) {
          var chip = document.createElement('span');
          chip.className = 'bib-dock__chip';
          chip.textContent = (i + 1) + '. ' + item.title;
          dockItems.appendChild(chip);
        });
      }

      if (dockCheckout) {
        dockCheckout.disabled = count !== bundleSize;
        if (dockCheckoutText) {
          dockCheckoutText.textContent = count === bundleSize
            ? config.ctaAdd
            : 'Pick ' + (bundleSize - count) + ' more';
        }
      }

      if (modalAdd && activeCard) {
        var activeVid = String(activeCard.getAttribute('data-variant-id'));
        var inBox = selected.some(function (s) { return s.id === activeVid; });
        if (modalAddLabel) {
          modalAddLabel.textContent = inBox ? 'Remove from Box' : 'Add to Box';
        }
        modalAdd.classList.toggle('is-in-box', inBox);
        modalAdd.setAttribute('aria-pressed', inBox ? 'true' : 'false');
      }
    }

    function lockPageScroll() {
      bibScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + bibScrollY + 'px';
      document.body.style.width = '100%';
      document.body.classList.add('bib-modal-open');
    }

    function unlockPageScroll() {
      document.body.classList.remove('bib-modal-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, bibScrollY);
    }

    function focusWithoutScroll(el) {
      if (!el || !el.focus) return;
      try {
        el.focus({ preventScroll: true });
      } catch (err) {
        el.focus();
      }
    }

    function trapModalFocus(e) {
      if (!modal || modal.hidden || e.key !== 'Tab' || !modalDialog) return;
      var focusable = modalDialog.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      focusable = [].slice.call(focusable).filter(function (el) {
        return el.offsetParent !== null;
      });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function switchModalImage(src) {
      if (!modalHero) return;
      modalHero.classList.add('is-fading');
      setTimeout(function () {
        modalHero.src = src;
        modalHero.classList.remove('is-fading');
      }, 120);
    }

    function openModal(card) {
      if (!modal) return;
      var data = getCardData(card);
      if (!data) return;

      activeCard = card;
      lastFocus = document.activeElement;

      var displayTitle = data.title || '';
      if (modalTitle) modalTitle.textContent = displayTitle.replace(/ Incense Sticks?/i, '').trim() || displayTitle;
      if (modalCat) {
        modalCat.textContent = data.category || 'Incense Stick';
        modalCat.hidden = false;
      }
      if (modalNote) {
        var noteText = data.subtitle || data.note || '';
        modalNote.textContent = noteText;
        modalNote.hidden = !noteText;
      }
      if (modalPrice) modalPrice.textContent = money(data.price || 0);
      if (modalDesc) modalDesc.textContent = data.description || '';
      if (modalDescWrap) modalDescWrap.hidden = !data.description;

      var hasHighlight = false;
      hasHighlight = setMeta(modalProfile, root.querySelector('[data-bib-modal-profile-wrap]'), data.profile) || hasHighlight;
      hasHighlight = setMeta(modalBurn, root.querySelector('[data-bib-modal-burn-wrap]'), data.burnTime) || hasHighlight;
      hasHighlight = setMeta(modalBest, root.querySelector('[data-bib-modal-best-wrap]'), data.bestFor) || hasHighlight;
      hasHighlight = setMeta(modalIng, root.querySelector('[data-bib-modal-ing-wrap]'), data.ingredients) || hasHighlight;
      if (modalHighlights) modalHighlights.hidden = !hasHighlight;

      var images = (data.images && data.images.length) ? data.images : (data.image ? [data.image] : []);
      if (modalHero && images[0]) {
        modalHero.src = images[0];
        modalHero.alt = data.title || '';
        modalHero.classList.remove('is-fading');
      }

      if (modalThumbs) {
        modalThumbs.innerHTML = '';
        if (images.length > 1) {
          modalThumbs.hidden = false;
          images.forEach(function (src, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bib-modal__thumb' + (i === 0 ? ' is-active' : '');
            btn.setAttribute('aria-label', 'View image ' + (i + 1));
            btn.innerHTML = '<img src="' + src + '" alt="" loading="lazy" decoding="async">';
            btn.addEventListener('click', function () {
              switchModalImage(src);
              [].slice.call(modalThumbs.querySelectorAll('.bib-modal__thumb')).forEach(function (t) {
                t.classList.remove('is-active');
              });
              btn.classList.add('is-active');
            });
            modalThumbs.appendChild(btn);
          });
        } else {
          modalThumbs.hidden = true;
        }
      }

      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      if (modalBody) modalBody.hidden = false;
      lockPageScroll();
      focusWithoutScroll(modalDialog);
      renderState();
    }

    function setMeta(el, wrap, val) {
      if (!el || !wrap) return false;
      if (val) {
        el.textContent = val;
        wrap.hidden = false;
        return true;
      }
      wrap.hidden = true;
      return false;
    }

    function closeModal() {
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      unlockPageScroll();
      activeCard = null;
      if (lastFocus && typeof lastFocus.focus === 'function') focusWithoutScroll(lastFocus);
    }

    cards.forEach(function (card) {
      var openZone = card.querySelector('[data-bib-card-open]');
      var addBtnCard = card.querySelector('.bib-card__add');

      function openFromCard(e) {
        if (e.target.closest('.bib-card__add')) return;
        openModal(card);
      }

      if (openZone) {
        openZone.addEventListener('click', openFromCard);
        openZone.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(card);
          }
        });
      }

      if (addBtnCard) {
        addBtnCard.addEventListener('click', function (e) {
          e.stopPropagation();
          toggleInBox(card);
        });
      }
    });

    root.querySelectorAll('[data-bib-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal.querySelector('.bib-modal__backdrop')) closeModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!modal || modal.hidden) return;
      if (e.key === 'Escape') closeModal();
      trapModalFocus(e);
    });

    if (modalAdd) {
      modalAdd.addEventListener('click', function () {
        if (!activeCard) return;
        toggleInBox(activeCard);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!selected.length) return;
        selected = [];
        celebrated = false;
        root.classList.remove('is-box-complete');
        renderState();
        showToast('Box cleared.');
      });
    }

    if (dockCheckout) {
      dockCheckout.addEventListener('click', function () {
        if (selected.length !== bundleSize || dockCheckout.disabled) return;

        dockCheckout.disabled = true;
        dockCheckout.classList.add('is-loading');
        if (dockCheckoutText) dockCheckoutText.textContent = 'Adding…';

        var items = selected.map(function (s) {
          return { id: parseInt(s.id, 10), quantity: 1 };
        });

        fetch((window.routes && window.routes.cart_add_url) || '/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ items: items })
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, data: data };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              var msg = (result.data && (result.data.description || result.data.message)) || 'Could not add bundle to cart.';
              throw new Error(msg);
            }

            try {
              if (window.PUB_SUB_EVENTS && typeof publish === 'function') {
                publish(window.PUB_SUB_EVENTS.cartUpdate, {
                  source: 'build-your-incense-box',
                  productVariantId: items[0].id,
                  cartData: result.data
                });
              }
            } catch (err) { /* no-op */ }

            var redirect = '/cart';
            if (discountCode) {
              redirect = '/discount/' + encodeURIComponent(discountCode) + '?redirect=' + encodeURIComponent('/cart');
            }
            window.location.href = redirect;
          })
          .catch(function (err) {
            dockCheckout.classList.remove('is-loading');
            dockCheckout.disabled = false;
            if (dockCheckoutText) dockCheckoutText.textContent = config.ctaAdd;
            showToast(err.message || 'Something went wrong. Please try again.', true);
          });
      });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              io.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      root.querySelectorAll('[data-bib-reveal]').forEach(function (el) {
        io.observe(el);
      });
    } else {
      root.querySelectorAll('[data-bib-reveal]').forEach(function (el) {
        el.classList.add('is-visible');
      });
    }

    root.classList.add('is-ready');
    var heroEl = root.querySelector('.bib-hero');
    if (heroEl) heroEl.classList.add('is-visible');
    renderState();
  }

  function bootBuildIncenseBox() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBuildIncenseBox);
    } else {
      initBuildIncenseBox();
    }
  }

  bootBuildIncenseBox();

  if (!window.__bibSectionLoadBound) {
    window.__bibSectionLoadBound = true;
    document.addEventListener('shopify:section:load', function (e) {
      if (e.target && e.target.querySelector('[data-bib-root]')) {
        var r = e.target.querySelector('[data-bib-root]');
        if (r) r.dataset.bibInit = '';
        initBuildIncenseBox();
      }
    });
  }
})();
