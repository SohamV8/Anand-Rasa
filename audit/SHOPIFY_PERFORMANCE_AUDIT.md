# Anand Rasa — Shopify Theme Performance Audit

**Prepared as:** Senior Shopify Performance Engineering review (pre-launch grade)
**Theme:** Anand Rasa (heavily customized Dawn fork) — astrology-personalised attar / perfume / incense store
**Scope:** Full static engineering audit of every page template, section, snippet, and asset
**Method & limitation:** This is a **static / source-level audit**. Numbers for bytes, file counts, loop counts, and API-call counts are **measured** from the repository. Core Web Vitals, render time, TTI, and Lighthouse scores are **engineering estimates** derived from payload size, render-blocking dependency graph, and known cost of the patterns found — not live lab traces. To convert estimates into measured values, run the *Verification* step at the end against the live storefront (WebPageTest / Lighthouse / Chrome DevTools).

---

## 1. Executive Summary

Anand Rasa is an ambitious, design-forward theme. The branding, SEO architecture, and accessibility intent are genuinely above average for a Shopify store. However, the theme is **carrying a large amount of avoidable weight** that will prevent it from feeling "instant / Apple-quality" on real devices, especially mid-range Android on Indian mobile networks (the primary audience).

The three dominant problems:

1. **A 615 KB Three.js + Vanta WebGL stack is loaded *render-blocking* (no `defer`)** on the homepage and the collection-list page, just to draw an animated cloud background. This single decision is the largest measurable performance regression in the theme.
2. **Massive Liquid duplication** — 53+ near-identical product/collection section files (~400 KB of duplicated Liquid + inline CSS/JS), plus an unlimited bestsellers loop and an O(9·N·T) nested planet-matching loop on the homepage.
3. **Uncontrolled media** — a 1.9 MB hero/testimonial image, multiple ~250 KB images, a 3 MB `.webm`, an animated GIF used for the Nakshatra hero, and a 179 KB `sparkle.gif`.

On top of that: 5–6 font families (several loaded via render-blocking CSS `@import`), `base.css` at 86 KB loaded blocking on every page, `theme-interactions.js` shipped site-wide, and a handful of JS memory leaks (perpetual `requestAnimationFrame` loops and scroll listeners that are never torn down).

None of these are architectural dead-ends. The fixes are well-understood and mostly low-risk. The single highest-leverage change (defer the WebGL stack + lazy-load it) can be done in under a day.

### Overall Scores (estimated, /100)

| Dimension | Score | Grade | One-line rationale |
|---|---:|:--:|---|
| **Performance** | **48** | F | Render-blocking 615 KB WebGL + heavy media + 86 KB blocking CSS |
| **User Experience** | **72** | C | Looks premium; hurt by load jank, layout shift risk, animation cost |
| **Accessibility** | **78** | C+ | Skip links, ARIA, reduced-motion respected; gaps in spinners/contrast |
| **SEO** | **90** | A- | Excellent: JSON-LD suite, robots logic, canonical, RSS, hreflang |
| **Maintainability** | **38** | F | 53+ duplicated sections, 148 inline scripts, 89 `!important`, dead code |
| **Scalability** | **52** | D+ | Per-product section files won't scale; homepage loops unbounded |
| **Developer Experience** | **45** | F | Inline CSS/JS everywhere; collisions; hard to reason about |
| **Production Readiness** | **55** | D | Ships and works, but not launch-ready at "premium" bar |

> **Estimated Lighthouse Mobile Performance: 35–50.** Estimated Desktop: 65–80. The gap is dominated by JS payload, render-blocking resources, and image weight.

---

## 2. Core Web Vitals (estimated)

Estimates assume mid-range mobile (4G, ~1.6 Mbps effective, 4× CPU throttle) — Shopify's own benchmark profile.

| Metric | Homepage (est.) | Collection (est.) | Product/Attar (est.) | Target | Verdict |
|---|---|---|---|---|---|
| **TTFB** | 0.4–0.8 s | 0.4–0.8 s | 0.5–0.9 s | < 0.8 s | OK (Shopify CDN) |
| **FCP** | 2.2–3.2 s | 2.0–2.8 s | 2.4–3.4 s | < 1.8 s | Poor |
| **LCP** | **4.5–7.0 s** | 3.5–5.0 s | **4.0–6.0 s** | < 2.5 s | **Critical** |
| **CLS** | 0.05–0.20 | 0.05–0.15 | 0.05–0.15 | < 0.1 | At risk |
| **TBT** | **600–1200 ms** | 400–800 ms | 500–1000 ms | < 200 ms | **Critical** |
| **INP** | 200–400 ms | 200–350 ms | 250–450 ms | < 200 ms | Poor |
| **Speed Index** | 4.5–7 s | 3.5–5 s | 4–6 s | < 3.4 s | Poor |

**Primary CWV offenders**
- **LCP**: render-blocking `three.min.js` (615 KB) delays the main thread before the hero image/text paints; large hero images compound it.
- **TBT/INP**: ~1 MB of JS, continuous `requestAnimationFrame` loops (Vanta WebGL, BEV carousel, community carousel), and `theme-interactions.js` on every page.
- **CLS**: web-font swap (5–6 families, `font-display: swap`), images without explicit `width`/`height` in some custom snippets, and reveal-on-scroll transforms.

---

## 3. Asset Inventory (measured)

Total `assets/` payload on disk: **12.88 MB** across 281 files.

| Type | Count | Total | Notes |
|---|---:|---:|---|
| `.webp` images | 41 | **7.40 MB** | Good format choice; several massively oversized |
| `.webm` video | 1 | **3.06 MB** | `NakshatraGif1.webm` |
| `.js` | 51 | **1.03 MB** | `three.min.js` alone is 615 KB (60%) |
| `.css` | 85 | **735 KB** | `base.css` 86 KB; lots of per-section bundles |
| `.jpeg` | 1 | 290 KB | `incense.jpeg` — should be webp |
| `.gif` | 1 | 179 KB | `sparkle.gif` — animated GIF, should be webp/CSS |
| `.png` | 2 | 100 KB | logos |
| `.svg` | 87 | 86 KB | icon set (fine) |

> Note: this is *theme bundle* weight. Merchant-uploaded images (hero GIF, product photos, shop_images trust icons) are served from `cdn.shopify.com` and add further weight at runtime — e.g. the homepage `zh_video` setting points to **`NakshatraGif1.gif`** (an *animated GIF* hero), which is typically multi-MB and a major LCP/decode cost.

### Largest individual assets

| Rank | File | Size | Problem |
|---:|---|---:|---|
| 1 | `three.min.js` | 615 KB | Render-blocking WebGL lib for a decorative background |
| 2 | `NakshatraGif1.webm` | 3.06 MB | Oversized video; verify it's actually used / compressed |
| 3 | `vashist_shubham_2005.webp` | **1.93 MB** | Wildly oversized for any web display size |
| 4 | `vinayakrao27_.webp` | 548 KB | Oversized testimonial/influencer image |
| 5 | `soham_vashist_8.webp` | 300 KB | Oversized |
| 6 | `incense.jpeg` | 290 KB | JPEG not WebP/AVIF |
| 7 | `wooden_attar_box.webp` | 287 KB | Oversized |
| 8 | `home.webp` | 271 KB | Likely a hero/LCP image |
| 9–15 | `chakra-*-attar.webp` ×7 | ~250–270 KB ea (~1.8 MB) | All oversized for card display |
| 16 | `collection_hero.webp` | 216 KB | Hero — should be responsive `srcset` |
| 17 | `sparkle.gif` | 179 KB | Animated GIF |

### Largest JS (custom + vendor)

| File | Size | Loading | Notes |
|---|---:|---|---|
| `three.min.js` | 615 KB | **blocking** | Vanta dependency |
| `global.js` | 44 KB | defer (every page) | Dawn baseline |
| `partner-dashboard.js` | 30 KB | defer (partner page) | scoped — OK |
| `theme-interactions.js` | 21 KB | defer (**every page**) | should be conditional |
| `build-your-attar-box.js` | 20 KB | defer (build pages) | scoped |
| `build-your-attar-box-quickview.js` | 19 KB | defer | scoped |
| `quick-order-list.js` | 18 KB | defer | scoped |
| `product-info.js` | 17 KB | defer (product) | scoped |
| `vanta.clouds.min.js` | 15 KB | **blocking** | with three.js |

### Largest CSS

| File | Size | Loading | Notes |
|---|---:|---|---|
| `base.css` | 86 KB | **blocking, every page** | 55 box-shadows, deep selectors, infinite spinners |
| `build-your-attar-box.css` | 45 KB | build pages | 14 backdrop-filters |
| `build-your-incense-box.css` | 33 KB | build pages | 5 infinite animations |
| `section-main-product.css` | 33 KB | product | |
| `component-facets.css` | 31 KB | collection/search | |
| `theme-product.css` | 29 KB | product/collection | duplicate `@import` |
| `premium-collections.css` | 23 KB | collection list | |

### Largest sections (Liquid source)

| File | Size | Notes |
|---|---:|---|
| `main-product.liquid` | 110 KB | core PDP |
| `header.liquid` | 76 KB | inline mega-menu, 22 URL renders |
| `anand-rasa-homepage.liquid` | 67 KB | ~590 lines inline CSS + JS |
| `featured-product.liquid` | 64 KB | full PDP clone |
| `product-incenses.liquid` | 58 KB | 11 nested loops |
| `nakshatra-product-base.liquid` | 57 KB | legacy PDP duplicate |
| `main-incense.liquid` + 6 incense clones | ~52 KB × 7 (~360 KB) | copy-pasted PDPs |

---

## 4. Per-Page Analysis

Render/JS/weight columns are **relative engineering estimates** (Low / Med / High / Critical) based on the assets and sections each template pulls in.

| Page (template) | DOM | CSS load | JS load | Image/Video | Render-blocking | Est. LCP | Grade |
|---|---|---|---|---|---|---|---|
| **Home** (`index.json`) | High (1 mega-section, 30 blocks, 5–6 carousels) | base+components+hero-vanta+~25 KB inline | global+interactions+**three/vanta(635 KB blocking)**+community/bev | hero GIF + sparkle.gif + product imgs | **Critical** (three.js) | 4.5–7 s | **F** |
| **Collection** (`collection.json` → premium-collections) | High | base+facets+collections+premium(23) | global+interactions+facets+**three/vanta blocking** | collection_hero + cards | **Critical** | 3.5–5 s | **D** |
| **Product / Attar** (`product.json`) | Very High | base+main-product(33)+theme-product(29)+gallery+features+bev+trust | global+interactions+product-info+media-gallery+bev+ambient | gallery imgs + YouTube Shorts | High | 4–6 s | **D** |
| **Incense PDP** (`main-incense` etc.) | Very High | base + ~400-line inline CSS + @import fonts | product stack | gallery | High | 4–6 s | **D** |
| **Search** (`search.json`) | Med | base+facets+predictive | global+facets+predictive | results imgs | Med | 3–4 s | **C** |
| **Predictive search** (drawer) | Low (async) | predictive (async) | predictive.js | thumbs | Low | n/a | **B** |
| **Cart** (`cart.json`) | Med | base+cart bundle | cart.js+cart-drawer | line imgs | Low | 2.5–3.5 s | **B** |
| **Blog** (`blog.json`) | Med | base+featured-blog | global+interactions | article imgs | Med | 2.5–3.5 s | **B-** |
| **Article** (`article.json`) | Med | base+article+anand-rasa-article | global+interactions | body imgs | Med | 2.5–3.5 s | **B-** |
| **About** (`page.about.json`) | Med | base + section CSS | global+interactions | story imgs (1.9 MB risk) | Med | 3–4 s | **C** |
| **Contact** (`page.contact.json`) | Low | base+contact-form | global | minimal | Low | 2–3 s | **B+** |
| **FAQ** (`page.faq.json` / `main-faq`) | Low-Med | base+collapsible | global | minimal | Low | 2–3 s | **B** |
| **Policy pages** | Low | base | global | none | Low | 1.8–2.5 s | **A-** |
| **404** (`404.json`) | Low | base + inline redirect JS | global | minimal | Low | 2–3 s | **B** |
| **Build-a-box** (custom) | High | base+build-your-attar-box(45)/incense(33) | build bundle (~40 KB)+confetti | product imgs | Med-High | 3.5–5 s | **C-** |
| **Custom perfume quiz** | Med-High | base+custom-perfume-quiz(16) | ~300 lines inline quiz JS | step imgs | Med | 3–4 s | **C** |
| **Partner / Influencer dashboards** | Med | dashboard CSS | dashboard JS (30 KB) | charts/QR | Med | 3–4 s | **C** |
| **Customer (login/account/order)** | Low | base+customer | global+customer | none | Low | 2–3 s | **B+** |

**Fastest pages:** Policy → Contact → Customer → Cart.
**Slowest pages:** Home → Collection → Product/Attar/Incense PDP → Build-a-box.

---

## 5. Section Rankings (heaviest → lightest)

Score combines Liquid complexity, attached CSS/JS, animation/GPU cost, and network. Rank legend: **Critical / Heavy / Average / Fast / Very Fast**.

| Section | Render | JS | Paint/GPU | Network | Score |
|---|---|---|---|---|---|
| Hero Vanta (`snippet-home-products-find` / `premium-collections`) | Med | **Critical** (635 KB blocking + WebGL rAF) | **Critical** (continuous WebGL) | **Critical** | **CRITICAL** |
| Homepage mega-section (`anand-rasa-homepage`) | **High** (5–6 carousels, unbounded loops) | High | High | High | **CRITICAL** |
| Brand Experience Videos (`brand-experience-videos`) | Med | **High** (perpetual rAF, per-frame DOM writes, N YouTube iframes) | **High** | High (YT) | **HEAVY** |
| Product page (`main-product`) | **High** (nested rec loops) | High | Med | Med | **HEAVY** |
| Incense PDP clones ×7 | High (945+ lines each, inline CSS) | Med | Med | Med | **HEAVY** |
| Header / Mega Menu (`header`) | Med (22 URL renders) | Low | Low | Low | **HEAVY** |
| Community carousel (`anand-rasa-community`) | Low | **High** (perpetual rAF leak) | Med | Low | **HEAVY** |
| Collection grids (nakshatra/zodiac/planet) | **High** (3 renders/product, bucket-sort 40–62 assigns) | Low | Low | Med | **HEAVY** |
| Featured Product (`featured-product`) | High | High | Med | Med | **HEAVY** |
| Testimonials (`snippet-home-testimonials`) | Med (~1100 lines inline) | Med | Med | Med | **AVERAGE** |
| Facets (`facets` / `component-facets`) | Med (17 nested loops) | Med | Med (layered shadows) | Med | **AVERAGE** |
| Planetary Mantra reel | Low | Med (YouTube postMessage) | Low | Med (YT) | **AVERAGE** |
| Trust marquee | Low | Low (1 ResizeObserver) | Low (infinite marquee, all PDPs) | Low | **AVERAGE** |
| Slideshow / Image banner | Low | Low (setInterval autoplay) | Low | Med (img) | **AVERAGE** |
| Cart drawer | Low | Low (global doc listeners) | Low | Low | **FAST** |
| Predictive search | Low (async CSS) | Low | Low | Low | **FAST** |
| Footer | Low | Low | Low | Low | **FAST** |
| Rich text / Collapsible / Multicolumn | Low | None | Low | Low | **VERY FAST** |
| Contact form / Newsletter | Low | None | Low | Low | **VERY FAST** |

**Fastest sections:** Rich text, Collapsible content, Footer, Contact form.
**Slowest sections:** Hero Vanta, Homepage mega-section, Brand Experience Videos, Product page, Incense PDP clones.

---

## 6. JavaScript Audit

**Measured API usage across `assets/*.js`:** 308 `addEventListener` (only ~32 `removeEventListener`), 49 `setTimeout`, 33 `requestAnimationFrame`, 27 `IntersectionObserver`, 26 `getBoundingClientRect`, 6 `setInterval`, 3 `ResizeObserver`, 1 `MutationObserver`.

### Critical
1. **Render-blocking WebGL stack (~635 KB)** — `three.min.js` + `vanta.clouds.min.js` + `hero-vanta.js` are emitted with Shopify's `script_tag` filter, which produces a plain `<script src>` (parser-blocking, no `defer`). Present in `snippets/snippet-home-products-find.liquid` and `sections/premium-collections.liquid`. This blocks HTML parsing and delays LCP on the two highest-traffic page types. **Risk of double-load**: if a template ever renders both the find snippet and premium-collections, Three.js loads twice.
2. **`theme-interactions.js` (21 KB) on every page** — `config/settings_data.json` has `animations_reveal_on_scroll: true`, so `theme.liquid` loads it globally even on pages with none of its DOM hooks.

### High
3. **`anand-rasa-community.js` — perpetual `requestAnimationFrame` leak.** The auto-scroll `tick()` runs forever; the returned cleanup is never stored/called, and its `resize` listener is never removed.
4. **`bev-carousel.js` — perpetual rAF + per-frame style writes** on every card, plus 5 pointer/keyboard listeners that are **not removed in `destroy()`** (leaks on Theme Editor section reload). Spins up N YouTube iframe players via a pool.
5. **`media-gallery.js` — `MutationObserver` never disconnected** on product modal.
6. **`theme-interactions.js` `initializeScrollZoomAnimationTrigger`** adds per-element `window` scroll listeners that are never removed, each reading `getBoundingClientRect` + `offsetHeight` (layout thrash on scroll).

### Medium
7. **`global.js`** — `SliderComponent` `ResizeObserver` never disconnected; slideshow `setInterval`; slider `update()` reads `clientWidth`/`offsetLeft`/`scrollLeft` on scroll+resize (classic slider thrash, partly batched).
8. **`cart-drawer.js`** — permanent capture-phase document listeners on every page (singleton-guarded; small but permanent).
9. **GTM injected synchronously** in `<head>` IIFE (it loads `gtm.js` async, but the inline bootstrap + GTM-managed tags add main-thread time and third-party requests you don't control).

### Dead / duplicate code
- `vanta.clouds2.min.js` — on disk, never referenced.
- `influencer-dashboard.js` (8 KB) + `influencer-dashboard.css` (17 KB) — section is a redirect stub; never enqueued.

**Well-engineered (keep as reference):** `hero-vanta.js` (WeakMap tracking, IO-gated init, `effect.destroy()` cleanup), `theme-product.js` (full `destroy()` teardown of all listeners), `bev-modal.js` / `brand-experience-videos.js` (tracked listeners via `unbindAll`), `product-info.js` (pubsub unsubscribe on disconnect).

---

## 7. CSS Audit

**Measured across `assets/*.css`:** ~322 `box-shadow`, ~96 `animation:`, ~91 gradients, ~52 `@keyframes`, **36 `backdrop-filter`**, **29 infinite animations**, 26 `clip-path`, ~190 `!important`, 17 `will-change`, 0 `transition: all` (good), 0 bare `*{}` (good), 27 `prefers-reduced-motion` blocks.

### Critical / High
1. **`base.css` (86 KB) render-blocking on every page** — 55 box-shadows, `mix-blend-mode`, clip-path blobs, 43 long/deep selectors, infinite spinners. This is the single largest blocking stylesheet.
2. **`theme-product-gallery.css` — 89 `!important`** declarations. A specificity arms race against Dawn; raises cascade cost and blocks clean refactors.
3. **Glassmorphism cluster — 36 `backdrop-filter`** (14 in `build-your-attar-box.css`, up to `blur(28px) saturate(1.35)`). Each creates an offscreen blur compositing layer — expensive on mobile GPUs.
4. **Paint-triggering continuous animations**: `ng-mantra-shadow-pulse` animates **box-shadow** (4.2 s infinite, on every attar PDP); `hero-vanta-fallback-shift` animates **background-position** across 4 gradient layers (26 s infinite); shimmer skeletons animate `background-position`. These force repaint every frame.
5. **Font `@import` inside CSS** — `theme-product.css`, `theme-collections.css`, `theme-features.css`, `attar-ritual-guide.css`, `planetary-mantra-experience.css` use `@import url(fonts.googleapis...)`. CSS `@import` is render-blocking *and* discovered late (chained request). `theme-product.css` even imports the **same font twice** (lines 4 and 735).

### Medium
6. **`will-change` misuse** — `hero-vanta.css` uses `will-change: transform, opacity, filter` (filter promotes a costly layer); `brand-experience-videos.css` uses `will-change: width` (non-compositor; prefer `transform: scaleX`).
7. **Dead CSS** — `influencer-dashboard.css` (~932 lines), `section-footer.css` (~489 lines, live footer is inline), `component-list-payment.css`, `component-list-menu.css` — shipped but unreferenced.
8. **Reduced-motion gaps** — newer custom sections respect it well, but Dawn `.spinner` / `.path` / indeterminate progress bars animate regardless.

---

## 8. Liquid Performance Audit

**Measured across `sections/` + `snippets/`:** 337 `for` loops, 507 `{% render %}`, 382 `image_url`, 233 `| money`, 110 `.metafields.`, 56 `all_products`, 826 `assign`, 66 inline `<style>`, 148 inline `<script>`. (No `{% section %}` nesting — good.)

### Critical — Duplication (the maintainability story)
- **27** `main-<nakshatra>.liquid` wrappers (~232 KB), **12** `main-<zodiac>.liquid` (~134 KB), **9** `main-<planet>.liquid` (~38 KB), **5** `main-<chakra>.liquid` (~22 KB) — each is mostly schema JSON wrapping a single `{% render %}`.
- **7 incense PDP clones** (`main-incense`, `kesachandan`, `lavender`, `muskrose`, `nagchampa`, `third-eye`, `crown`) at ~52 KB each (~360 KB) — full copy-pasted markup + inline CSS, **not** sharing a snippet.
- **Naming collision**: `main-third-eye.liquid` / `main-crown.liquid` exist in *both* the chakra wrapper set and the incense clone set.
- **Estimated ~400 KB+ of Liquid** that could collapse to ~5 shared sections + ~5 shared snippets driven by metafields/metaobjects.

### Critical — Homepage runtime
- **`snippet-home-products-bestsellers.liquid`** loops `bs.products` with **no `limit:`** — the only uncapped product loop on the homepage.
- **`planet-attar-cards.liquid`** runs `for i in (0..8)` → `for cp in pl_col.products` → `for term in match_terms` = **O(9·N·T)** per homepage load, plus up to 9 `all_products[...]` fallbacks.
- Homepage is effectively **5–6 collection-driven carousels** rendered in one section on every index hit.

### High
- **`header.liquid`** renders `ar-collection-url` ~22 times (11 desktop + 11 drawer), each probing multiple `collections[handle]`. Pre-capture once.
- **Collection grids** (`collection-nakshatra/zodiac/planet`) use string **bucket-sort** with 40–62 `assign` per file and 3 `{% render %}` per product (up to ~150 snippet invocations/page).
- **Repeated work in loops**: 6–8 `image_url` per product card, repeated `| money`, metafields re-read per iteration — assign once to locals.
- **66 inline `<style>` + 148 inline `<script>`** blocks — re-parsed every request, not CDN-cacheable. Worst: `anand-rasa-homepage` (~590 lines CSS), `header` (~780 lines), `snippet-home-testimonials` (~1100 lines), 7 incense PDPs (~400 lines each).

---

## 9. Image Audit

| Check | Finding |
|---|---|
| Format | WebP used widely (good); 1 stray JPEG (`incense.jpeg` 290 KB); animated GIFs (`sparkle.gif` 179 KB, homepage `NakshatraGif1.gif`) |
| AVIF | Not used — opportunity for ~20–30% additional savings on hero images |
| Oversized originals | `vashist_shubham_2005.webp` **1.93 MB**, `vinayakrao27_.webp` 548 KB, `soham_vashist_8.webp` 300 KB, 7× `chakra-*-attar.webp` ~250 KB, `wooden_attar_box.webp` 287 KB — all far larger than any display size |
| Responsive `srcset` | Present in bestseller/zodiac/incense cards (good); inconsistent on hero/feature images served from `asset_url` (fixed size) |
| Lazy loading | `loading="lazy"` used in home snippets; verify above-the-fold LCP image uses `fetchpriority="high"` and is **not** lazy |
| `width`/`height` | Inconsistent in custom snippets → CLS risk; theme should always set intrinsic dimensions or `aspect-ratio` |
| Decode | No explicit `decoding="async"` in most custom snippets |
| Theme-bundled photos | Product/influencer photos should **not** live in `assets/` (no `srcset`, no auto-resize) — upload to Files/products so Shopify serves responsive variants |

**Biggest image win:** re-export the testimonial/influencer photos at real display sizes (≤1600px, ~150–250 KB) and serve responsive variants — instantly removes ~3–4 MB of worst-case payload.

---

## 10. Video Audit

| Item | Finding |
|---|---|
| `NakshatraGif1.webm` (3 MB) | Oversized; confirm usage. If it's the Nakshatra hero, the homepage setting currently points to `NakshatraGif1.**gif**` (animated GIF) instead — switch to the `.webm`/`.mp4` with `poster`, `muted`, `playsinline`, `preload="none"`, and lazy mount |
| Animated GIF hero | Worst-case video delivery (no compression, decodes on CPU). Replace with `<video>` or a static poster + on-view play |
| YouTube (Brand Experience Videos, Planetary Mantra, product Shorts) | Loaded via IFrame API + a pooled player. Good (pool + IO pause), but each iframe is ~hundreds of KB + third-party JS. Use lite-youtube / facade thumbnail until click |
| `autoplay`/`preload` | BEV/Vanta pause offscreen via IO/visibility (good). Ensure no `preload="auto"` videos above the fold |

---

## 11. Font Audit

| Check | Finding |
|---|---|
| Families | **5–6**: Caudex + Poppins (primary, `<link>` in `theme.liquid`), Cormorant Garamond + Jost (PDP sections via `@import`), Noto Sans Devanagari (mantra/collection CSS), plus gift card adds more Poppins weights |
| Delivery | Mixed: `<link rel=stylesheet>` (head) **and** render-blocking CSS `@import` in ~15 files → chained, late-discovered requests |
| Duplicate | `theme-product.css` imports the same Cormorant+Devanagari set **twice** (L4 + L735) |
| `font-display` | `swap` used consistently (good — avoids FOIT, accepts FOUT/CLS) |
| Preload | Only `settings.type_body_font` preloaded; the actual Google-hosted Caudex/Poppins woff2 are **not** preloaded, so first text paint waits on the CSS round-trip |
| Weights | Many weights requested (Poppins 400/500/600/700 + italics, etc.) — trim to used weights |

**Net:** an attar PDP can pull **4–6 font families** from 3–4 separate stylesheet requests. Consolidate to 2 families, self-host or single `<link>`, preload the 2 critical woff2, drop unused weights.

---

## 12. Third-Party Audit

| Source | Where | Cost | Recommendation |
|---|---|---|---|
| Google Tag Manager (`GTM-KHX4KC75`) | inline `<head>` IIFE | Async fetch of `gtm.js` + whatever tags are configured (often the biggest hidden 3P cost) | Audit GTM container; move tags to server-side / consent-gated; load after interaction |
| Google Fonts | `<link>` + many `@import` | Render-blocking, multiple requests | Consolidate / self-host / preload |
| YouTube (IFrame API) | BEV, Mantra, product Shorts | Heavy 3P JS + iframes | Facade until click |
| Pinterest domain verify | `<meta>` | Negligible | Keep |
| Shopify `content_for_header` | head | App embeds/pixels injected here | Audit installed apps in Admin → remove unused |

No review-app / chat-widget / heatmap scripts were found *in the theme code* — but any installed Shopify apps inject via `content_for_header` and should be audited in the Admin (each typically adds 50–300 KB of 3P JS).

---

## 13. Network

- **CDN/HTTP2/3**: Handled by Shopify (good) — assets on `cdn.shopify.com`, Brotli, HTTP/2+.
- **Render-blocking chain**: HTML → `base.css` (86 KB) + 5 component CSS + Google Fonts CSS → **three.min.js (615 KB, blocking)** → paint. This serial critical path is the core problem.
- **Late-discovered requests**: CSS `@import` fonts can't be preloaded by the browser preload scanner → extra RTTs.
- **Duplicate requests risk**: Three.js can load twice (two snippets); same font imported repeatedly across CSS files.
- **Parallelism**: Fine on Shopify CDN; the bottleneck is *blocking* + *payload*, not connection count.

---

## 14. Accessibility

**Strengths:** skip-to-content link, `role="main"`, ARIA live regions (`a11y-refresh-page-message`), `aria-labelledby` on hero, `prefers-reduced-motion` respected across most custom sections, `focus-visible` outlines, semantic headings.

**Gaps:**
- Dawn spinners / indeterminate progress bars animate regardless of reduced-motion.
- Contrast risk on muted greys over gradients/glass panels (e.g. `#5c554c` text, overlay text on imagery) — verify ≥ 4.5:1.
- Grayscale-on-hover trust icons + low-contrast labels (`#4b5563` on white is OK; verify smaller text).
- WebGL/animated backgrounds: ensure decorative-only (`aria-hidden`) — mostly handled.
- Touch targets in dense carousels/pills — verify ≥ 44×44 px.
- Keyboard traps in custom modals (BEV/quickview) — they implement focus trap; verify Escape + restore-focus on all.

---

## 15. Responsiveness

The theme uses fluid `clamp()` typography and responsive grids (good). Risks to verify on device:
- **Overflow**: 3D BEV carousel transforms and wide marquees can cause horizontal scroll on small phones.
- **Reflow**: bucket-sorted collection grids and mega-menu drawer.
- **Touch**: pills/swatches/carousel dots target size.
- **Performance on low-end mobile**: WebGL Vanta + multiple infinite animations + YouTube iframes will be the worst experience here — exactly the primary audience (Indian mobile).

Breakpoints present: 640 / 900 / 1024 / 1200 px (homepage discovery grid). Reasonable; test landscape + small-phone (≤360 px).

---

## 16. Animation Audit

| Animation | Type | Concern |
|---|---|---|
| Vanta clouds (hero) | WebGL, continuous rAF | Highest CPU/GPU; render-blocking lib |
| BEV carousel | rAF, per-frame transform/filter/opacity on all cards | Main-thread + GPU heavy when visible |
| Community carousel | rAF auto-scroll | **Never cancelled** (leak) |
| Trust marquee | CSS transform, infinite | On every PDP; OK (compositor) but always running |
| Mantra shadow-pulse | CSS **box-shadow**, infinite | Repaints every frame |
| Hero fallback gradient | CSS **background-position**, infinite | Repaints every frame |
| Skeleton shimmers | CSS background-position | Repaint while visible |
| Reveal-on-scroll | transform/opacity (good) | Many simultaneous transitions |
| Card hover 3D lift | transform + box-shadow + filter | Mixed; box-shadow/filter repaint |

**Rule of thumb to enforce:** animate only `transform` and `opacity`; pause/teardown rAF when offscreen or `document.hidden`; never animate `box-shadow`/`background-position`/`width`/`top`/`left` in infinite loops.

---

## 17. Memory

- **Detached/leaked rAF**: `anand-rasa-community.js` (perpetual), `bev-carousel.js` pointer listeners not removed on destroy.
- **Observers never disconnected**: `media-gallery.js` MutationObserver, `global.js` SliderComponent ResizeObserver, `trust-marquee.js` ResizeObserver (section-static, lower risk).
- **WebGL contexts**: `hero-vanta.js` correctly calls `effect.destroy()` — good; ensure Vanta is destroyed on section unload everywhere it's used.
- **YouTube iframes**: pooled (good), but verify players are destroyed when BEV unmounts.
- **Global document listeners**: `cart-drawer.js` permanent (small).

---

## 18. SEO

**Strong — this is the theme's best area.**
- Page-type-aware `robots` directive with `noindex, follow` for thin/utility/filtered surfaces and an enriched directive (`max-image-preview:large`, etc.) for indexable pages.
- Full JSON-LD suite: `schema-global`, `schema-breadcrumbs`, `schema-product-core` (+ supplemental), `schema-collection`, `schema-article-blogposting`, `schema-list-collections`.
- `meta-tags` snippet (OG/Twitter), canonical via `content_for_header`, hreflang via Shopify markets, RSS/Atom feeds for blog/article, metafield-driven SEO titles/descriptions with sensible fallbacks, `robots.txt.liquid`.
- DNS-prefetch/preconnect for fonts + CDN.

**Minor:** the homepage `<script>window.location.replace()</script>` redirects for legacy `?view=` URLs are client-side (a 301 at the redirect level is better for crawl equity); confirm `sitemap.xml` includes the canonical build/find pages and excludes the `?view=` variants.

---

## 19. Security

| Check | Finding |
|---|---|
| CSP | None set by theme (Shopify default). Consider a report-only CSP given inline scripts. |
| Inline scripts | **148 inline `<script>` blocks** + inline GTM — a CSP would require `nonce`/`hash`; large attack-surface and blocks strict CSP. |
| External scripts | GTM, Google Fonts, YouTube — all reputable; pinned by Shopify/Google. |
| Mixed content | None found (all `https`). |
| Security headers | `X-Content-Type-Options: nosniff` + `Referrer-Policy` set via meta (good intent; HTTP headers are stronger). |
| Deprecated libs | Three.js r134 + Vanta 0.5.24 are old; update if kept, or remove. |
| `target=_blank` | Verify `rel="noopener"` on external links. |

---

## 20. Lighthouse (estimated)

| Category | Mobile (est.) | Desktop (est.) |
|---|---:|---:|
| Performance | **35–50** | 65–80 |
| Accessibility | 85–92 | 88–95 |
| Best Practices | 75–85 | 80–90 |
| SEO | **95–100** | 95–100 |

Expected top Lighthouse flags: *Eliminate render-blocking resources*, *Reduce unused JavaScript*, *Properly size images*, *Serve images in next-gen formats (AVIF)*, *Reduce unused CSS*, *Minimize main-thread work*, *Avoid enormous network payloads*, *Largest Contentful Paint element*, *Ensure text remains visible during webfont load* (covered), *Image elements do not have explicit width and height*.

---

## 21. Top 50 Bottlenecks (ranked by impact)

Difficulty: �​S=hours, M=1–3 days, L=1–2 weeks, XL=2–4 weeks. Priority: 🔴 High / 🟠 Med / 🟢 Low.

| # | Issue | Location | Impact | Est. improvement | Diff | Pri |
|---:|---|---|---|---|:--:|:--:|
| 1 | 615 KB Three.js loaded render-blocking | `snippet-home-products-find`, `premium-collections` | LCP/TBT huge | -1.5 to -3 s LCP | S | 🔴 |
| 2 | Vanta + hero-vanta loaded blocking | same | TBT | bundled w/ #1 | S | 🔴 |
| 3 | Animated GIF hero (`NakshatraGif1.gif`) | `index.json` setting | LCP, decode, payload | -1–3 MB | S | 🔴 |
| 4 | 1.93 MB testimonial image | `vashist_shubham_2005.webp` | payload/LCP | -1.8 MB | S | 🔴 |
| 5 | `base.css` 86 KB render-blocking | `theme.liquid` | FCP | -0.3–0.6 s FCP | M | 🔴 |
| 6 | `theme-interactions.js` on every page | `theme.liquid` (settings) | TBT | -21 KB + logic | S | 🔴 |
| 7 | Unlimited bestsellers loop | `snippet-home-products-bestsellers` | server render + DOM | faster TTFB/CLS | S | 🔴 |
| 8 | O(9·N·T) planet matching loop | `planet-attar-cards` | server render | faster homepage | M | 🔴 |
| 9 | Oversized images (chakra ×7, wooden box, etc.) | `assets/` | payload | -1.5 MB | M | 🔴 |
| 10 | Font `@import` in CSS (×15) | theme-product/collections/etc | render-blocking chain | -0.2–0.5 s | M | 🔴 |
| 11 | 5–6 font families | global | CWV/CLS | fewer requests | M | 🔴 |
| 12 | Perpetual rAF leak | `anand-rasa-community.js` | INP/memory | smoother scroll | S | 🔴 |
| 13 | BEV pointer listeners not removed | `bev-carousel.js` | memory leak | stability | S | 🟠 |
| 14 | Scroll-zoom listeners never removed | `theme-interactions.js` | INP/thrash | smoother scroll | M | 🟠 |
| 15 | 27+12+9+5 wrapper sections | `sections/main-*` | maintainability/scale | huge DX win | XL | 🟠 |
| 16 | 7 incense PDP clones (~360 KB) | `sections/main-incense*` | maintainability | -300 KB src | L | 🟠 |
| 17 | 89 `!important` in gallery CSS | `theme-product-gallery.css` | maintainability | cleaner cascade | M | 🟠 |
| 18 | 36 backdrop-filter | multiple CSS | GPU/paint | smoother mobile | M | 🟠 |
| 19 | box-shadow infinite animation | `theme-product.css` (mantra) | repaint/INP | smoother PDP | S | 🟠 |
| 20 | background-position infinite (hero fallback) | `hero-vanta.css` | repaint | smoother | S | 🟠 |
| 21 | 22 `ar-collection-url` renders | `header.liquid` | server render | faster header | M | 🟠 |
| 22 | 3 renders/product + bucket-sort | `collection-nakshatra/zodiac/planet` | server render | faster collection | L | 🟠 |
| 23 | 148 inline `<script>` blocks | sections/snippets | parse + no cache + CSP | cacheable JS | L | 🟠 |
| 24 | 66 inline `<style>` blocks | sections/snippets | render-blocking, no cache | cacheable CSS | L | 🟠 |
| 25 | YouTube iframes eager | BEV / mantra / shorts | 3P JS/network | facade load | M | 🟠 |
| 26 | Dead JS/CSS (`influencer-*`, `vanta.clouds2`) | `assets/` | bundle weight | -42 KB | S | 🟢 |
| 27 | Duplicate `@import` same font | `theme-product.css` | extra request | -1 request | S | 🟢 |
| 28 | `media-gallery` MutationObserver leak | `media-gallery.js` | memory | stability | S | 🟢 |
| 29 | SliderComponent ResizeObserver leak | `global.js` | memory | stability | S | 🟢 |
| 30 | `incense.jpeg` not WebP | `assets/` | payload | -150 KB | S | 🟢 |
| 31 | `sparkle.gif` animated GIF | `assets/` | payload | -150 KB | S | 🟢 |
| 32 | Missing width/height in custom imgs | home/PDP snippets | CLS | -0.05–0.1 CLS | M | 🟠 |
| 33 | LCP image may be lazy/no fetchpriority | hero snippets | LCP | -0.3–0.8 s | S | 🔴 |
| 34 | No AVIF | hero/feature imgs | payload | -20–30% img | M | 🟢 |
| 35 | `will-change: filter/width` | hero-vanta/BEV CSS | layer memory | smoother | S | 🟢 |
| 36 | Spinners ignore reduced-motion | `base.css` | a11y | compliance | S | 🟢 |
| 37 | Homepage = 5–6 carousels one section | `anand-rasa-homepage` | render/DOM | split sections | L | 🟠 |
| 38 | `nakshatra-product-base` legacy duplicate | section | maintainability | delete | M | 🟢 |
| 39 | `prv-data-loader` 22 conditional renders | snippet | server render | load 1 category | M | 🟠 |
| 40 | `main-collection-banner` 11 collection probes | section | server render | assign once | M | 🟢 |
| 41 | `facets.liquid` 17 nested loops (dup mobile/desktop) | snippet | render | share partial | M | 🟢 |
| 42 | GTM tags unaudited | head | 3P TBT | consent/defer | M | 🟠 |
| 43 | No CSP | platform | security | report-only CSP | L | 🟢 |
| 44 | Three.js r134 / Vanta old | assets | security/perf | update or drop | M | 🟢 |
| 45 | Trust marquee infinite on all PDPs | `trust-marquee` | always-running anim | pause offscreen | S | 🟢 |
| 46 | Client-side `?view=` redirects | `theme.liquid` | SEO crawl | 301 redirects | M | 🟢 |
| 47 | Contrast on muted text/glass | multiple | a11y | verify 4.5:1 | M | 🟠 |
| 48 | Repeated image_url/money/metafields in loops | card snippets | render | assign once | M | 🟢 |
| 49 | cart-drawer permanent doc listeners | `cart-drawer.js` | minor | guard exists | S | 🟢 |
| 50 | Many Google Font weights | global | payload | trim weights | S | 🟢 |

---

## 22. Optimization Roadmap

### 🔴 Quick Wins (~1 day, highest ROI)
1. **Defer the WebGL stack.** Replace `script_tag` with `defer` (or dynamic `import()` gated by IntersectionObserver) for `three.min.js`, `vanta.clouds.min.js`, `hero-vanta.js`. Load Three.js **once**, only when a `.hero-vanta` enters the viewport. *(Bottlenecks 1, 2)*
2. **Fix the hero media.** Point the homepage hero to the compressed `.webm`/`.mp4` (poster + `preload="none"` + lazy) instead of the animated GIF. *(3)*
3. **Re-export oversized images** at real display sizes (testimonial/influencer/chakra) and move merchant photos out of `assets/` so Shopify serves responsive `srcset`. *(4, 9)*
4. **Add `limit:` to the bestsellers loop** and other uncapped product loops. *(7)*
5. **Make `theme-interactions.js` conditional** (only load where its DOM hooks exist), or split it. *(6)*
6. **Ensure the LCP image** uses `fetchpriority="high"`, explicit `width`/`height`, and is **not** `loading="lazy"`. *(33, 32)*
7. **Delete dead assets** (`influencer-dashboard.js/.css`, `vanta.clouds2.min.js`) and the duplicate `@import` in `theme-product.css`. *(26, 27)*
8. **Fix the perpetual rAF leak** in `anand-rasa-community.js`; pause when offscreen/`document.hidden`. *(12)*

### 🟠 Medium Improvements (~1 week)
9. **Consolidate fonts** to 2 families; remove all CSS `@import`; serve via one `<link>` and preload the 2 critical woff2; trim weights. *(10, 11, 50)*
10. **Split `base.css`** into critical (inline ~10–15 KB) + deferred remainder; async-load non-critical component CSS. *(5)*
11. **Pre-capture header collection URLs once**; fix `main-collection-banner` probes; assign image/money/metafields once in card loops. *(21, 40, 48)*
12. **Replace infinite paint-triggering animations** (box-shadow / background-position) with transform/opacity equivalents; pause marquee/animations offscreen. *(19, 20, 45)*
13. **YouTube facades** (thumbnail → load on click). *(25)*
14. **Fix remaining JS leaks** (BEV pointer listeners, scroll-zoom listeners, MutationObserver, ResizeObserver). *(13, 14, 28, 29)*
15. **Audit GTM + installed apps**; consent-gate and defer 3P tags. *(42)*
16. **Reduce backdrop-filter usage** / cap blur radius on mobile. *(18)*

### 🟢 Major Refactors (2–4 weeks)
17. **Collapse per-product section duplication** — one parameterized section each for nakshatra/zodiac/planet/chakra, driven by product **metafields/metaobjects** instead of 53 schema files. *(15, 38)*
18. **Merge the 7 incense PDP clones** into one shared section/snippet. *(16)*
19. **Extract all inline `<style>`/`<script>`** into cacheable assets; split the homepage mega-section into 6–8 JSON-template sections (enables lazy below-fold loading + merchant control). *(23, 24, 37)*
20. **Refactor collection grids** to a single luxury-grid section: one `card` render per product, drop bucket-sort assigns (use Shopify sort order / metafield ordering). *(22)*
21. **Tame the gallery CSS specificity war** (89 `!important`). *(17)*
22. **Add a report-only CSP** once inline scripts are externalized; update or remove Three.js/Vanta. *(43, 44)*

---

## 23. Verification (turn estimates into measured numbers)

Run these against the **live** storefront before/after each phase:
- **Lighthouse** (Chrome DevTools, Mobile, applied throttling) on Home / Collection / Product.
- **WebPageTest** (Mumbai/India location, Moto G4, 4G) — capture LCP, TBT, filmstrip, waterfall.
- **Chrome DevTools → Performance** trace: confirm Three.js blocking on main thread; record Long Tasks.
- **Coverage tab**: quantify unused CSS/JS (validate `base.css` / `theme-interactions.js` waste).
- **PageSpeed Insights field data (CrUX)** for real-user LCP/INP/CLS once live.

Companion deliverables in this folder:
- `performance-audit.csv` — per-page & per-section metrics table.
- `performance-audit.json` — machine-readable metrics + bottleneck list.
- `performance-checklist.md` — actionable checkbox checklist.
- `optimization-roadmap.md` — High / Medium / Low grouped plan.
