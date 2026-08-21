/**
 * Anand Rasa — promotional popup
 * Vanilla JS · GPU-friendly · Shopify customer/contact forms
 */
(function () {
  'use strict';

  if (window.__arPromoPopupBooted) return;
  window.__arPromoPopupBooted = true;

  var STORAGE_KEY = 'ar_promo_popup_v1';
  var SESSION_KEY = 'ar_promo_popup_session_v1';

  function parseConfig(root) {
    var script =
      (root && root.querySelector && root.querySelector('[data-ar-promo-config]')) ||
      (root && root.previousElementSibling && root.previousElementSibling.matches && root.previousElementSibling.matches('[data-ar-promo-config]')
        ? root.previousElementSibling
        : null) ||
      (root && root.parentElement && root.parentElement.querySelector('[data-ar-promo-config]'));

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

  function readStorage() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function writeStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* private browsing / quota */
    }
  }

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function writeSession(data) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  }

  function track(eventName, payload) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, payload || {}));
    } catch (e) {
      /* ignore analytics failures */
    }
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function normalizePhone(value) {
    return String(value || '').replace(/[\s\-().]/g, '');
  }

  function isValidIndianMobile(value) {
    var v = normalizePhone(value);
    if (/^\+91[6-9]\d{9}$/.test(v)) return true;
    if (/^[6-9]\d{9}$/.test(v)) return true;
    return false;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  function focusableElements(container) {
    return Array.prototype.slice
      .call(
        container.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      .filter(function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      });
  }

  function PromoPopup(root) {
    this.root = root;
    this.config = parseConfig(root);
    this.panel = root.querySelector('[data-ar-promo-panel]');
    this.form = root.querySelector('[data-ar-promo-form]');
    this.submitBtn = root.querySelector('[data-ar-promo-submit]');
    this.phoneInput = root.querySelector('[data-ar-promo-phone]');
    this.emailInput = root.querySelector('[data-ar-promo-email]');
    this.consentInput = root.querySelector('[data-ar-promo-consent]');
    this.formError = root.querySelector('[data-ar-promo-form-error]');
    this.phoneError = root.querySelector('[data-ar-promo-phone-error]');
    this.emailError = root.querySelector('[data-ar-promo-email-error]');
    this.copyButtons = Array.prototype.slice.call(root.querySelectorAll('[data-ar-promo-copy]'));
    this.codeFields = Array.prototype.slice.call(root.querySelectorAll('[data-ar-promo-code]'));
    this.copyBtn = this.copyButtons[0] || null;
    this.codeField = this.codeFields[0] || null;
    this.shopBtn = root.querySelector('[data-ar-promo-shop]');
    this.mediaImg = root.querySelector('[data-ar-promo-image]');
    this.timer = null;
    this.hideTimer = null;
    this.opened = false;
    this.submitting = false;
    this.lastFocus = null;
    this.listeners = [];
    this._onKeydown = this.onKeydown.bind(this);
  }

  PromoPopup.prototype.bind = function (el, type, fn, opts) {
    if (!el || !fn) return;
    el.addEventListener(type, fn, opts);
    this.listeners.push([el, type, fn, opts]);
  };

  PromoPopup.prototype.destroy = function () {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.opened = false;
    document.documentElement.classList.remove('ar-promo-popup-open');
    document.body.classList.remove('ar-promo-popup-open');
    document.removeEventListener('keydown', this._onKeydown);
    this.listeners.forEach(function (entry) {
      entry[0].removeEventListener(entry[1], entry[2], entry[3]);
    });
    this.listeners.length = 0;
    this.root.__arPromoPopup = null;
  };

  PromoPopup.prototype.shouldShow = function () {
    if (!this.config.enabled) return false;
    if (this.config.designMode) return true;
    if (this.config.skipPage) return false;

    var storage = readStorage();
    if (storage.submitted) return false;

    var frequency = this.config.frequency || 'days';
    var days = Number(this.config.frequencyDays) || 7;

    if (frequency === 'session') {
      var session = readSession();
      if (session.dismissed || session.shown) return false;
    }

    if (frequency === 'days' && storage.dismissedAt) {
      var elapsed = Date.now() - Number(storage.dismissedAt);
      if (elapsed < days * 86400000) return false;
    }

    return true;
  };

  PromoPopup.prototype.schedule = function () {
    var self = this;
    if (!this.shouldShow()) return;

    var delay = this.config.designMode ? 600 : Number(this.config.delayMs);
    if (!delay || delay < 0 || isNaN(delay)) delay = 4000;

    var start = function () {
      if (self.timer) window.clearTimeout(self.timer);
      self.timer = window.setTimeout(function () {
        self.timer = null;
        self.open();
      }, delay);
    };

    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
      /* Fallback if load is delayed by a stuck resource */
      window.setTimeout(function () {
        if (!self.opened && !self.timer && self.shouldShow()) start();
      }, Math.max(delay + 1500, 5000));
    }
  };

  PromoPopup.prototype.loadImage = function () {
    if (!this.mediaImg || this.mediaImg.dataset.loaded === 'true') return;
    var src = this.mediaImg.getAttribute('data-src');
    var mobileSrc = this.mediaImg.getAttribute('data-src-mobile');
    if (mobileSrc && window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
      src = mobileSrc;
    }
    if (!src) return;
    this.mediaImg.onload = function () {
      this.classList.add('is-loaded');
      this.dataset.loaded = 'true';
    }.bind(this.mediaImg);
    this.mediaImg.onerror = function () {
      this.style.display = 'none';
    }.bind(this.mediaImg);
    this.mediaImg.src = src;
  };

  PromoPopup.prototype.open = function () {
    if (this.opened || !this.shouldShow()) return;
    this.opened = true;
    this.lastFocus = document.activeElement;
    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    this.loadImage();

    if (!prefersReducedMotion()) {
      requestAnimationFrame(
        function () {
          this.root.classList.add('is-open');
        }.bind(this)
      );
    } else {
      this.root.classList.add('is-open');
    }

    document.documentElement.classList.add('ar-promo-popup-open');
    document.body.classList.add('ar-promo-popup-open');
    document.addEventListener('keydown', this._onKeydown);

    if (!this.config.designMode) {
      writeSession(Object.assign(readSession(), { shown: true }));
    }

    track('popup_view', {
      popup_id: this.config.sectionId,
      popup_heading: this.config.heading || ''
    });

    var focusables = focusableElements(this.panel);
    if (focusables.length) focusables[0].focus();
  };

  PromoPopup.prototype.close = function (reason) {
    if (!this.opened) return;
    this.opened = false;
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('ar-promo-popup-open');
    document.body.classList.remove('ar-promo-popup-open');
    document.removeEventListener('keydown', this._onKeydown);

    if (this.hideTimer) window.clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(
      function () {
        this.root.hidden = true;
        this.hideTimer = null;
      }.bind(this),
      prefersReducedMotion() ? 0 : 450
    );

    if (!this.config.designMode) {
      if (this.config.frequency === 'session') {
        writeSession(Object.assign(readSession(), { dismissed: true }));
      } else {
        writeStorage(Object.assign(readStorage(), { dismissedAt: Date.now() }));
      }
    }

    track('popup_close', {
      popup_id: this.config.sectionId,
      close_reason: reason || 'unknown'
    });

    if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
      try {
        this.lastFocus.focus();
      } catch (e) {
        /* ignore */
      }
    }
  };

  PromoPopup.prototype.onKeydown = function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close('escape');
      return;
    }

    if (event.key !== 'Tab' || !this.panel) return;
    var focusables = focusableElements(this.panel);
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  PromoPopup.prototype.setFieldError = function (el, msgEl, message) {
    if (el) el.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (msgEl) msgEl.textContent = message || '';
  };

  PromoPopup.prototype.validate = function () {
    var ok = true;
    var cfg = this.config;
    this.setFieldError(this.phoneInput, this.phoneError, '');
    this.setFieldError(this.emailInput, this.emailError, '');
    if (this.formError) this.formError.textContent = '';

    if (cfg.showPhone) {
      var phoneVal = this.phoneInput ? this.phoneInput.value.trim() : '';
      if (!phoneVal) {
        this.setFieldError(this.phoneInput, this.phoneError, 'Please enter your mobile number.');
        ok = false;
      } else if (!isValidIndianMobile(phoneVal)) {
        this.setFieldError(this.phoneInput, this.phoneError, 'Enter a valid 10-digit Indian mobile number.');
        ok = false;
      }
    }

    if (cfg.showEmail) {
      var emailVal = this.emailInput ? this.emailInput.value.trim() : '';
      var emailRequired = cfg.showEmail && (!cfg.showPhone || cfg.emailRequired);
      if (emailRequired && !emailVal) {
        this.setFieldError(this.emailInput, this.emailError, 'Please enter your email address.');
        ok = false;
      } else if (emailVal && !isValidEmail(emailVal)) {
        this.setFieldError(this.emailInput, this.emailError, 'Enter a valid email address.');
        ok = false;
      }
    }

    if (cfg.showConsent && this.consentInput && !this.consentInput.checked) {
      if (this.formError) {
        this.formError.textContent = 'Please agree to receive offers before continuing.';
      }
      ok = false;
    }

    if (!cfg.showPhone && !cfg.showEmail) {
      if (this.formError) {
        this.formError.textContent = 'Enable at least one capture field in the theme editor.';
      }
      ok = false;
    }

    return ok;
  };

  PromoPopup.prototype.formatPhoneE164 = function (value) {
    var v = normalizePhone(value);
    if (/^[6-9]\d{9}$/.test(v)) return '+91' + v;
    if (/^\+91[6-9]\d{9}$/.test(v)) return v;
    return v;
  };

  PromoPopup.prototype.submitCustomer = function (email, acceptsMarketing) {
    var body = new URLSearchParams();
    body.append('form_type', 'customer');
    body.append('utf8', '✓');
    body.append('contact[email]', email);
    body.append('contact[tags]', this.config.customerTags || 'newsletter, promo-popup');
    if (acceptsMarketing) body.append('contact[accepts_marketing]', 'true');

    return fetch('/contact', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
      credentials: 'same-origin'
    });
  };

  PromoPopup.prototype.submitContact = function (phone, email) {
    var body = new URLSearchParams();
    body.append('form_type', 'contact');
    body.append('utf8', '✓');
    body.append('contact[form_type]', 'Promo Popup');
    if (phone) body.append('contact[phone]', this.formatPhoneE164(phone));
    if (email) body.append('contact[email]', email);
    body.append(
      'contact[body]',
      'Promo popup signup' + (phone ? ' — phone: ' + this.formatPhoneE164(phone) : '')
    );

    return fetch('/contact', {
      method: 'POST',
      headers: {
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
      credentials: 'same-origin'
    });
  };

  PromoPopup.prototype.showSuccess = function () {
    this.root.classList.add('is-success');
    if (!this.config.designMode) {
      writeStorage(Object.assign(readStorage(), { submitted: true, submittedAt: Date.now() }));
      writeSession(Object.assign(readSession(), { submitted: true }));
    }
    track('popup_submit', { popup_id: this.config.sectionId });

    var focusables = focusableElements(this.panel);
    if (focusables.length) focusables[0].focus();
  };

  PromoPopup.prototype.onSubmit = function (event) {
    event.preventDefault();
    if (this.submitting) return;
    if (!this.validate()) return;

    var cfg = this.config;
    var phone = this.phoneInput ? this.phoneInput.value.trim() : '';
    var email = this.emailInput ? this.emailInput.value.trim() : '';
    var accepts = cfg.showConsent && this.consentInput ? this.consentInput.checked : true;

    this.submitting = true;
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.textContent = cfg.submittingText || 'Submitting…';
    }

    var self = this;
    var tasks = [];

    if (cfg.showEmail && email) {
      tasks.push(this.submitCustomer(email, accepts));
    }

    if (cfg.showPhone && phone) {
      tasks.push(this.submitContact(phone, email));
    }

    if (!tasks.length) {
      this.submitting = false;
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = cfg.ctaText || 'Claim offer';
      }
      if (this.formError) this.formError.textContent = 'Unable to submit. Please try again.';
      return;
    }

    Promise.all(tasks)
      .then(function (responses) {
        /* Only treat real HTTP success as success. Do not treat 422 as OK. */
        var ok = responses.every(function (res) {
          return res && res.ok;
        });
        if (!ok) throw new Error('submit failed');
        self.showSuccess();
      })
      .catch(function () {
        if (self.formError) {
          self.formError.textContent =
            'Something went wrong. Please try again or contact us for help.';
        }
      })
      .finally(function () {
        self.submitting = false;
        if (self.submitBtn && !self.root.classList.contains('is-success')) {
          self.submitBtn.disabled = false;
          self.submitBtn.textContent = cfg.ctaText || 'Claim offer';
        }
      });
  };

  PromoPopup.prototype.onCopy = function () {
    var code = this.config.discountCode;
    if (!code) return;

    var self = this;
    var done = function () {
      self.copyButtons.forEach(function (btn) {
        btn.classList.add('is-copied');
        btn.textContent = self.config.copiedText || 'Copied';
      });
      window.setTimeout(function () {
        self.copyButtons.forEach(function (btn) {
          btn.classList.remove('is-copied');
          btn.textContent = self.config.copyText || 'Copy code';
        });
      }, 2000);
      track('coupon_copy', {
        popup_id: self.config.sectionId,
        coupon_code: code
      });
    };

    copyText(code).then(done).catch(function () {
      if (self.formError) {
        self.formError.textContent = 'Could not copy code. Please copy it manually.';
      }
    });
  };

  PromoPopup.prototype.onCodeClick = function () {
    var field = this;
    if (field && field.target) field = field.target;
    if (!field || typeof field.select !== 'function') return;
    try {
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
    } catch (e) {
      /* ignore selection failures */
    }
  };

  PromoPopup.prototype.init = function () {
    var self = this;
    this.bind(this.root.querySelector('[data-ar-promo-close]'), 'click', function () {
      self.close('button');
    });
    this.bind(this.root.querySelector('[data-ar-promo-backdrop]'), 'click', function () {
      self.close('backdrop');
    });
    if (this.form) this.bind(this.form, 'submit', this.onSubmit.bind(this));
    this.copyButtons.forEach(function (btn) {
      self.bind(btn, 'click', self.onCopy.bind(self));
    });
    this.codeFields.forEach(function (field) {
      self.bind(field, 'click', self.onCodeClick);
      self.bind(field, 'focus', self.onCodeClick);
    });
    if (this.shopBtn) {
      this.bind(this.shopBtn, 'click', function () {
        track('popup_cta_click', {
          popup_id: self.config.sectionId,
          destination: self.shopBtn.getAttribute('href') || ''
        });
      });
    }
    this.schedule();
  };

  function boot(scope) {
    var roots = (scope || document).querySelectorAll('[data-ar-promo-popup]');
    roots.forEach(function (root) {
      if (root.__arPromoPopup) return;
      var instance = new PromoPopup(root);
      root.__arPromoPopup = instance;
      instance.init();
    });
  }

  function teardown(scope) {
    (scope || document).querySelectorAll('[data-ar-promo-popup]').forEach(function (root) {
      if (root.__arPromoPopup) root.__arPromoPopup.destroy();
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
