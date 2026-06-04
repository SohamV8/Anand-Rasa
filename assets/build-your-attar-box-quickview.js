/**
 * Build Your Attar Box — luxury quick view (section only)
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-byb-root]');
  if (!root) return;

  var modalRoot = root.querySelector('[data-byb-qv]');
  if (!modalRoot) return;

  var backdrop = modalRoot.querySelector('[data-byb-qv-backdrop]');
  var dialog = modalRoot.querySelector('[data-byb-qv-dialog]');
  var closeBtn = modalRoot.querySelector('[data-byb-qv-close]');
  var loader = modalRoot.querySelector('[data-byb-qv-loader]');
  var body = modalRoot.querySelector('[data-byb-qv-body]');
  var stage = modalRoot.querySelector('[data-byb-qv-stage]');
  var heroImg = modalRoot.querySelector('[data-byb-qv-hero]');
  var thumbsWrap = modalRoot.querySelector('[data-byb-qv-thumbs]');
  var categoryEl = modalRoot.querySelector('[data-byb-qv-category]');
  var titleEl = modalRoot.querySelector('[data-byb-qv-title]');
  var taglineEl = modalRoot.querySelector('[data-byb-qv-tagline]');
  var priceEl = modalRoot.querySelector('[data-byb-qv-price]');
  var compareEl = modalRoot.querySelector('[data-byb-qv-compare]');
  var stockEl = modalRoot.querySelector('[data-byb-qv-stock]');
  var notesWrap = modalRoot.querySelector('[data-byb-qv-notes]');
  var notesGrid = modalRoot.querySelector('[data-byb-qv-notes-grid]');
  var storyWrap = modalRoot.querySelector('[data-byb-qv-story]');
  var storyText = modalRoot.querySelector('[data-byb-qv-story-text]');
  var benefitsWrap = modalRoot.querySelector('[data-byb-qv-benefits]');
  var benefitsList = modalRoot.querySelector('[data-byb-qv-benefits-list]');
  var productLink = modalRoot.querySelector('[data-byb-qv-product-link]');
  var addBtn = modalRoot.querySelector('[data-byb-qv-add]');
  var addLabel = modalRoot.querySelector('[data-byb-qv-add-label]');

  var activeCard = null;
  var activeData = null;
  var galleryImages = [];
  var galleryIndex = 0;
  var lastFocus = null;
  var productCache = {};

  function getApi() {
    return window.__bybApi || null;
  }

  function formatMoney(cents) {
    var api = getApi();
    if (api && api.formatMoney) return api.formatMoney(cents);
    return '₹' + (Math.round(cents) / 100).toLocaleString('en-IN');
  }

  function parseCardData(card) {
    var el = card.querySelector('[data-byb-qv-json]');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  function splitNotes(str) {
    if (!str || typeof str !== 'string') return [];
    return str
      .replace(/·/g, ',')
      .split(/[,;|/]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function uniqueUrls(urls) {
    var seen = {};
    return urls.filter(function (u) {
      if (!u || seen[u]) return false;
      seen[u] = true;
      return true;
    });
  }

  function buildGallery(data, product) {
    var urls = [];
    if (data.heroImage) urls.push(data.heroImage);
    if (product && product.images && product.images.length) {
      product.images.forEach(function (img) {
        if (img) urls.push(img);
      });
    } else if (product && product.featured_image) {
      urls.push(product.featured_image);
    }
    if (!data.assetsOnly && product && product.media) {
      product.media.forEach(function (m) {
        if (m && m.src) urls.push(m.src);
      });
    }
    return uniqueUrls(urls);
  }

  function setHeroSrc(src, alt) {
    if (!src) return;
    heroImg.classList.add('is-fading');
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      heroImg.src = src;
      heroImg.alt = alt || '';
      heroImg.width = img.naturalWidth || 900;
      heroImg.height = img.naturalHeight || 900;
      requestAnimationFrame(function () {
        heroImg.classList.remove('is-fading');
      });
    };
    img.onerror = function () {
      heroImg.src = src;
      heroImg.alt = alt || '';
      heroImg.classList.remove('is-fading');
    };
    img.src = src;
  }

  function setGalleryIndex(idx) {
    if (!galleryImages.length) return;
    galleryIndex = idx;
    var src = galleryImages[galleryIndex];
    setHeroSrc(src, (activeData && activeData.title) || '');
    if (thumbsWrap) {
      var btns = thumbsWrap.querySelectorAll('[data-byb-qv-thumb]');
      btns.forEach(function (btn, i) {
        btn.classList.toggle('is-active', i === galleryIndex);
        btn.setAttribute('aria-selected', i === galleryIndex ? 'true' : 'false');
      });
    }
  }

  function renderThumbs() {
    if (!thumbsWrap) return;
    thumbsWrap.innerHTML = '';
    if (galleryImages.length < 2) {
      thumbsWrap.hidden = true;
      return;
    }
    thumbsWrap.hidden = false;
    galleryImages.forEach(function (src, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'byb-qv__thumb' + (i === galleryIndex ? ' is-active' : '');
      btn.setAttribute('data-byb-qv-thumb', '');
      btn.setAttribute('role', 'listitem');
      btn.setAttribute('aria-label', 'View image ' + (i + 1));
      btn.setAttribute('aria-selected', i === galleryIndex ? 'true' : 'false');
      var img = document.createElement('img');
      img.alt = '';
      img.width = 72;
      img.height = 72;
      img.decoding = 'async';
      img.loading = i === 0 ? 'eager' : 'lazy';
      if (i === galleryIndex || i < 3) {
        img.src = src;
      } else {
        img.dataset.src = src;
        if ('IntersectionObserver' in window) {
          var obs = new IntersectionObserver(
            function (entries, o) {
              entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                if (el.dataset.src) {
                  el.src = el.dataset.src;
                  delete el.dataset.src;
                }
                o.unobserve(el);
              });
            },
            { root: thumbsWrap, rootMargin: '40px' }
          );
          obs.observe(img);
        } else {
          img.src = src;
        }
      }
      btn.appendChild(img);
      btn.addEventListener('click', function () {
        setGalleryIndex(i);
      });
      thumbsWrap.appendChild(btn);
    });
  }

  function renderNoteGroup(label, items) {
    if (!items.length) return null;
    var block = document.createElement('div');
    block.className = 'byb-qv__note-group';
    var title = document.createElement('p');
    title.className = 'byb-qv__note-tier';
    title.textContent = label;
    block.appendChild(title);
    var chips = document.createElement('div');
    chips.className = 'byb-qv__chips';
    items.forEach(function (note) {
      var chip = document.createElement('span');
      chip.className = 'byb-qv__chip';
      chip.textContent = note;
      chips.appendChild(chip);
    });
    block.appendChild(chips);
    return block;
  }

  function renderNotes(data) {
    notesGrid.innerHTML = '';
    var hasAny = false;
    var top = splitNotes(data.topNotes);
    var heart = splitNotes(data.heartNotes);
    var base = splitNotes(data.baseNotes);
    var main = splitNotes(data.mainNotes);

    if (!top.length && !heart.length && !base.length && main.length) {
      top = main;
    }

    [['Top notes', top], ['Heart notes', heart], ['Base notes', base]].forEach(function (pair) {
      var node = renderNoteGroup(pair[0], pair[1]);
      if (node) {
        notesGrid.appendChild(node);
        hasAny = true;
      }
    });

    notesWrap.hidden = !hasAny;
  }

  var DESC_ALLOWED = {
    P: 'byb-qv__desc-p',
    H2: 'byb-qv__desc-heading byb-qv__desc-heading--h2',
    H3: 'byb-qv__desc-heading byb-qv__desc-heading--h3',
    H4: 'byb-qv__desc-heading byb-qv__desc-heading--h4',
    UL: 'byb-qv__desc-list',
    OL: 'byb-qv__desc-list byb-qv__desc-list--ol',
    BLOCKQUOTE: 'byb-qv__desc-quote',
    LI: '',
    STRONG: '',
    EM: '',
    BR: '',
    A: 'byb-qv__desc-link',
  };

  function stripHtml(html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').trim();
  }

  function sanitizeDescription(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html || '';
    wrap.querySelectorAll('script, style, iframe, object, embed, form, input').forEach(function (n) {
      n.remove();
    });
    wrap.querySelectorAll('a').forEach(function (a) {
      a.setAttribute('rel', 'noopener noreferrer');
      a.setAttribute('target', '_blank');
    });
    return wrap;
  }

  function appendTextBlocks(container, text) {
    text.split(/\n{2,}/).forEach(function (block) {
      var trimmed = block.trim();
      if (!trimmed) return;
      var p = document.createElement('p');
      p.className = 'byb-qv__desc-p';
      p.textContent = trimmed;
      container.appendChild(p);
    });
  }

  function cloneAllowedNode(node) {
    if (node.nodeType !== 1) return null;
    var tag = node.tagName;
    if (!DESC_ALLOWED.hasOwnProperty(tag)) {
      if (tag === 'DIV' || tag === 'SPAN') {
        var frag = document.createDocumentFragment();
        Array.prototype.forEach.call(node.childNodes, function (child) {
          var cloned = cloneAllowedNode(child);
          if (cloned) frag.appendChild(cloned);
        });
        return frag.childNodes.length ? frag : null;
      }
      return null;
    }
    var el = document.createElement(tag.toLowerCase());
    var cls = DESC_ALLOWED[tag];
    if (cls) el.className = cls;
    if (tag === 'LI') {
      el.textContent = node.textContent.trim();
      return el;
    }
    if (tag === 'A') {
      el.href = node.getAttribute('href') || '#';
      el.textContent = node.textContent.trim();
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
      return el;
    }
    if (tag === 'BR') return el;
    Array.prototype.forEach.call(node.childNodes, function (child) {
      if (child.nodeType === 3) {
        var t = child.textContent;
        if (t) el.appendChild(document.createTextNode(t));
      } else {
        var c = cloneAllowedNode(child);
        if (c) el.appendChild(c);
      }
    });
    if (!el.childNodes.length && node.textContent.trim()) {
      el.textContent = node.textContent.trim();
    }
    return el.childNodes.length || el.textContent ? el : null;
  }

  function formatDescription(html) {
    var source = sanitizeDescription(html);
    var prose = document.createElement('div');
    prose.className = 'byb-qv__description-prose';

    var blockCount = 0;
    Array.prototype.forEach.call(source.childNodes, function (node) {
      if (node.nodeType === 3) {
        var text = node.textContent.trim();
        if (text) {
          appendTextBlocks(prose, text);
          blockCount += 1;
        }
        return;
      }
      var cloned = cloneAllowedNode(node);
      if (!cloned) return;
      if (cloned.nodeType === 11) {
        Array.prototype.forEach.call(cloned.childNodes, function (c) {
          prose.appendChild(c);
          blockCount += 1;
        });
      } else {
        prose.appendChild(cloned);
        blockCount += 1;
      }
    });

    if (!blockCount) {
      var plain = source.textContent.trim();
      if (plain) appendTextBlocks(prose, plain.replace(/\n{3,}/g, '\n\n'));
    }

    return prose;
  }

  function renderDescription(html) {
    storyText.innerHTML = '';
    if (!html || !stripHtml(html)) {
      storyWrap.hidden = true;
      return;
    }
    storyText.appendChild(formatDescription(html));
    storyWrap.hidden = false;
  }

  function renderBenefits(data, product) {
    benefitsList.innerHTML = '';
    var items = [];
    if (data.tags && data.tags.length) {
      data.tags.slice(0, 4).forEach(function (t) {
        if (t && items.indexOf(t) === -1) items.push(t);
      });
    }
    if (data.category) items.unshift(data.category + ' ritual');
    items = items.slice(0, 5);
    if (!items.length) {
      benefitsWrap.hidden = true;
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      benefitsList.appendChild(li);
    });
    benefitsWrap.hidden = false;
  }

  function updateAddButton() {
    var api = getApi();
    var inBox = api && api.isInBox && api.isInBox(activeData.variantId);
    addBtn.disabled = !activeData.available;
    addBtn.classList.toggle('is-in-box', !!inBox);
    addLabel.textContent = inBox ? 'In Your Ritual' : 'Add to Ritual';
  }

  function fetchProduct(handle) {
    if (productCache[handle]) return Promise.resolve(productCache[handle]);
    var base = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
    return fetch(base + 'products/' + encodeURIComponent(handle) + '.js')
      .then(function (res) {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then(function (json) {
        productCache[handle] = json;
        return json;
      });
  }

  function renderModal(data, product) {
    activeData = data;
    galleryImages = buildGallery(data, product);
    galleryIndex = 0;

    if (galleryImages.length) {
      setHeroSrc(galleryImages[0], data.title);
    } else {
      heroImg.removeAttribute('src');
    }
    renderThumbs();

    if (data.category) {
      categoryEl.textContent = data.category;
      categoryEl.hidden = false;
    } else {
      categoryEl.hidden = true;
    }

    titleEl.textContent = data.title;

    var tagline = data.tagline || (product && product.type) || '';
    if (tagline) {
      taglineEl.textContent = tagline;
      taglineEl.hidden = false;
    } else {
      taglineEl.hidden = true;
    }

    priceEl.textContent = formatMoney(data.price);
    if (data.compareAt && data.compareAt > data.price) {
      compareEl.textContent = formatMoney(data.compareAt);
      compareEl.hidden = false;
    } else {
      compareEl.hidden = true;
    }

    if (data.available) {
      stockEl.textContent = 'In stock';
      stockEl.className = 'byb-qv__stock byb-qv__stock--in';
      stockEl.hidden = false;
    } else {
      stockEl.textContent = 'Currently unavailable';
      stockEl.className = 'byb-qv__stock byb-qv__stock--out';
      stockEl.hidden = false;
    }

    renderNotes(data);

    renderDescription(product && product.description ? product.description : '');

    renderBenefits(data, product);

    var url = (product && product.url) || '/products/' + data.handle;
    productLink.href = url;

    updateAddButton();
  }

  function trapFocus(e) {
    if (e.key !== 'Tab' || modalRoot.hidden) return;
    var focusable = dialog.querySelectorAll(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
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

  function open(card) {
    var data = parseCardData(card);
    if (!data) return;

    lastFocus = document.activeElement;
    activeCard = card;
    modalRoot.hidden = false;
    modalRoot.setAttribute('aria-hidden', 'false');
    document.body.classList.add('byb-qv-open');
    loader.hidden = false;
    body.hidden = true;
    dialog.focus();

    fetchProduct(data.handle)
      .then(function (product) {
        renderModal(data, product);
        loader.hidden = true;
        body.hidden = false;
      })
      .catch(function () {
        renderModal(data, null);
        loader.hidden = true;
        body.hidden = false;
      });
  }

  function close() {
    modalRoot.hidden = true;
    modalRoot.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('byb-qv-open');
    activeCard = null;
    activeData = null;
    heroImg.removeAttribute('src');
    heroImg.alt = '';
    thumbsWrap.innerHTML = '';
    storyText.innerHTML = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onAddClick() {
    var api = getApi();
    if (!api || !api.addToBox || !activeCard) return;
    api.addToBox(activeCard);
    updateAddButton();
    if (api.isInBox && api.isInBox(activeData.variantId)) {
      close();
    }
  }

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  addBtn.addEventListener('click', onAddClick);
  modalRoot.querySelector('[data-byb-qv-quick]').addEventListener('click', function (e) {
    e.preventDefault();
  });

  document.addEventListener('keydown', function (e) {
    if (modalRoot.hidden) return;
    if (e.key === 'Escape') close();
    trapFocus(e);
  });

  window.BuildYourAttarBoxQV = { open: open, close: close };

  root.addEventListener('mouseover', function (e) {
    var card = e.target.closest('[data-byb-card]');
    if (!card || !root.contains(card)) return;
    var data = parseCardData(card);
    if (data && data.handle) fetchProduct(data.handle);
  });

  root.addEventListener('click', function (e) {
    if (e.target.closest('[data-byb-toggle]')) return;
    var card = e.target.closest('[data-byb-card]');
    if (!card || !root.contains(card)) return;
    e.preventDefault();
    open(card);
  });

  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('[data-byb-toggle]')) return;
    var card = e.target.closest('[data-byb-card]');
    if (!card || !root.contains(card)) return;
    if (e.target.closest('a[href]') && !e.target.hasAttribute('data-byb-open-qv')) return;
    e.preventDefault();
    open(card);
  });
})();
