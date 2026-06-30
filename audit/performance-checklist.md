# Anand Rasa — Performance Optimization Checklist

Tick items as they're shipped. Grouped by phase. See `SHOPIFY_PERFORMANCE_AUDIT.md` for full rationale and `optimization-roadmap.md` for sequencing.

## Phase 1 — Quick Wins (~1 day, highest ROI)

- [ ] Replace `script_tag` with `defer` for `three.min.js`, `vanta.clouds.min.js`, `hero-vanta.js` (in `snippet-home-products-find.liquid` and `premium-collections.liquid`)
- [ ] Load Three.js **only once** and **only when** a `.hero-vanta` enters the viewport (dynamic `import()` / IO gate)
- [ ] Switch homepage Nakshatra hero from animated GIF (`NakshatraGif1.gif`) to compressed `<video>` (`muted`, `playsinline`, `preload="none"`, `poster`, lazy mount)
- [ ] Re-export `vashist_shubham_2005.webp` (1.9 MB) and other oversized photos at real display sizes
- [ ] Move merchant/influencer/product photos out of `assets/` so Shopify serves responsive `srcset`
- [ ] Add `limit:` to `snippet-home-products-bestsellers.liquid` product loop (and any other uncapped loops)
- [ ] Make `theme-interactions.js` load only on pages that contain its DOM hooks (or split it)
- [ ] Ensure the LCP/hero image has `fetchpriority="high"`, explicit `width`/`height`, and is NOT `loading="lazy"`
- [ ] Delete dead assets: `influencer-dashboard.js`, `influencer-dashboard.css`, `vanta.clouds2.min.js`
- [ ] Remove duplicate `@import` in `theme-product.css` (lines 4 and 735)
- [ ] Fix perpetual `requestAnimationFrame` leak + resize listener in `anand-rasa-community.js`; pause when offscreen / `document.hidden`

## Phase 2 — Medium Improvements (~1 week)

- [ ] Consolidate fonts to 2 families; remove all CSS `@import` font loading
- [ ] Serve fonts via a single `<link>`; preload the 2 critical woff2; trim unused weights
- [ ] Split `base.css` into critical (inline ~10–15 KB) + deferred remainder
- [ ] Async-load non-critical component CSS (`media="print" onload` pattern already used for cart-items/predictive)
- [ ] Pre-capture all header collection URLs once in `header.liquid` (remove ~20 `ar-collection-url` renders)
- [ ] Assign `image_url` / `money` / metafields once to locals inside product-card loops
- [ ] Replace infinite paint-triggering animations with transform/opacity:
  - [ ] `theme-product.css` mantra `box-shadow` pulse
  - [ ] `hero-vanta.css` `background-position` fallback shift
  - [ ] skeleton shimmer `background-position`
- [ ] Pause trust marquee + decorative animations when offscreen
- [ ] Convert YouTube embeds to facade (thumbnail → load player on click)
- [ ] Fix remaining JS leaks:
  - [ ] `bev-carousel.js` pointer/keyboard listeners removed in `destroy()`
  - [ ] `theme-interactions.js` scroll-zoom window listeners removed
  - [ ] `media-gallery.js` MutationObserver disconnected
  - [ ] `global.js` SliderComponent ResizeObserver disconnected
- [ ] Audit GTM container + installed Shopify apps; consent-gate and defer 3P tags
- [ ] Cap `backdrop-filter` blur radius / reduce count on mobile
- [ ] Add explicit `width`/`height` (or `aspect-ratio`) to all custom-snippet images (CLS)
- [ ] Reduce `prv-data-loader.liquid` to render only the category needed for the page
- [ ] Verify text contrast ≥ 4.5:1 on muted greys over gradients/glass

## Phase 3 — Major Refactors (2–4 weeks)

- [ ] Collapse 27 nakshatra + 12 zodiac + 9 planet + 5 chakra wrapper sections into 4 parameterized sections driven by product metafields/metaobjects
- [ ] Merge the 7 incense PDP clones into one shared section/snippet
- [ ] Delete legacy `nakshatra-product-base.liquid` duplicate
- [ ] Resolve `main-third-eye` / `main-crown` naming collision (chakra vs incense)
- [ ] Extract all inline `<style>` (66) and `<script>` (148) into cacheable assets
- [ ] Split homepage mega-section into 6–8 JSON-template sections (lazy below-fold, merchant control)
- [ ] Refactor collection grids (nakshatra/zodiac/planet) to one luxury-grid section: 1 card render per product, drop bucket-sort assigns (use Shopify sort / metafield ordering)
- [ ] Reduce `theme-product-gallery.css` 89 `!important` declarations
- [ ] Add a report-only CSP after inline scripts are externalized
- [ ] Update or remove Three.js r134 / Vanta 0.5.24

## Phase 4 — Verification (each phase, on LIVE storefront)

- [ ] Lighthouse Mobile on Home / Collection / Product (before & after)
- [ ] WebPageTest from India (Moto G4, 4G): LCP, TBT, filmstrip, waterfall
- [ ] DevTools Performance trace: confirm no render-blocking Three.js; check Long Tasks
- [ ] DevTools Coverage: quantify unused CSS/JS reduction
- [ ] PageSpeed Insights field data (CrUX): LCP / INP / CLS pass rates
