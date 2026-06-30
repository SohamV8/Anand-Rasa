# Anand Rasa — Optimization Roadmap (by Priority)

Grouped High / Medium / Low. Each item: **what → why → expected gain → effort**.
Effort: S = hours, M = 1–3 days, L = 1–2 weeks, XL = 2–4 weeks.

---

## 🔴 HIGH PRIORITY (do first — biggest CWV impact, mostly low effort)

### H1. Defer + lazy-load the WebGL hero stack — **S**
- **What:** Stop loading `three.min.js` (615 KB) + `vanta.clouds.min.js` + `hero-vanta.js` with Shopify's `script_tag` (render-blocking). Use `defer`, and ideally dynamic `import()` triggered by IntersectionObserver when `.hero-vanta` is near the viewport. Guarantee Three.js loads at most once per page.
- **Why:** This is the single largest blocker of LCP and main-thread time on the two highest-traffic page types (home, collection).
- **Gain:** −1.5 to −3 s LCP, −300–600 ms TBT on home/collection.
- **Files:** `snippets/snippet-home-products-find.liquid`, `sections/premium-collections.liquid`.

### H2. Fix hero media — **S**
- **What:** Replace the animated-GIF Nakshatra hero (`zh_video` → `NakshatraGif1.gif`) with a compressed `<video>` (`muted playsinline preload="none"` + poster, lazy mounted). Compress/verify `NakshatraGif1.webm` (3 MB).
- **Why:** Animated GIFs are uncompressed and CPU-decoded; a major LCP + payload cost.
- **Gain:** −1 to −3 MB, faster LCP.

### H3. Right-size and re-home images — **M**
- **What:** Re-export oversized photos (`vashist_shubham_2005.webp` 1.9 MB, `vinayakrao27_` 548 KB, `soham_vashist_8` 300 KB, 7× chakra-attar ~250 KB, `wooden_attar_box` 287 KB) to real display dimensions. Move merchant photos out of `assets/` to Files/products for automatic responsive `srcset`. Convert `incense.jpeg` → WebP, `sparkle.gif` → WebP/CSS.
- **Why:** ~4–5 MB of avoidable image payload.
- **Gain:** −3 to −4 MB worst-case; faster LCP, lower data cost on mobile.

### H4. Protect the LCP element — **S**
- **What:** Ensure the above-the-fold hero image uses `fetchpriority="high"`, explicit `width`/`height`, and is not `loading="lazy"`.
- **Gain:** −0.3 to −0.8 s LCP; reduced CLS.

### H5. Stop shipping `theme-interactions.js` everywhere — **S**
- **What:** Load it only on pages whose DOM hooks exist (or split the bundle). It's currently global because `animations_reveal_on_scroll: true`.
- **Gain:** −21 KB JS + parse/exec on most pages; lower TBT.

### H6. Cap homepage Liquid loops — **S→M**
- **What:** Add `limit:` to `snippet-home-products-bestsellers` (currently unbounded). Refactor `planet-attar-cards` from O(9·N·T) nested scans to a single pass building a handle→product map.
- **Gain:** Faster server render (TTFB), smaller DOM, fewer image requests.

### H7. Font diet — **M**
- **What:** Consolidate to 2 families; remove all CSS `@import` font loads (15 files); one `<link>`; preload 2 critical woff2; trim weights; remove duplicate import in `theme-product.css`.
- **Why:** 5–6 families across 3–4 blocking/chained requests delay first text paint and add CLS.
- **Gain:** −0.2 to −0.5 s render; fewer requests; less CLS.

### H8. Kill the perpetual rAF leak — **S**
- **What:** `anand-rasa-community.js` — store and call the cleanup; pause `tick()` when offscreen/`document.hidden`; remove the resize listener on teardown.
- **Gain:** Smoother scrolling/INP on homepage; no runaway memory.

---

## 🟠 MEDIUM PRIORITY (1 week+ — strong gains, moderate effort)

### M1. Split and async `base.css` (86 KB) — **M**
Inline ~10–15 KB critical CSS; defer the rest; async-load non-critical component CSS. Gain: −0.3–0.6 s FCP.

### M2. Header URL pre-capture — **M**
Capture all collection URLs once in `header.liquid`; remove ~20 `ar-collection-url` renders. Also fix `main-collection-banner` 11 probes and `prv-data-loader` 22 conditional renders.

### M3. De-jank animations — **S→M**
Convert infinite `box-shadow` (mantra) and `background-position` (hero fallback, shimmers) animations to `transform`/`opacity`. Pause marquee + decorative loops offscreen. Remove `will-change: filter`/`width`.

### M4. YouTube facades — **M**
Replace eager IFrame players (BEV, mantra, product shorts) with click-to-load thumbnail facades. Big 3P JS/network savings on PDPs.

### M5. Plug remaining JS leaks — **M**
`bev-carousel.js` pointer listeners in `destroy()`; `theme-interactions.js` scroll-zoom listeners; `media-gallery.js` MutationObserver; `global.js` SliderComponent ResizeObserver.

### M6. CLS hardening — **M**
Add `width`/`height`/`aspect-ratio` to all custom-snippet images. Reserve space for fonts/hero.

### M7. Third-party governance — **M**
Audit the GTM container + installed apps (loaded via `content_for_header`); consent-gate, defer, remove unused. Often the largest hidden 3P cost.

### M8. GPU paint reduction — **M**
Reduce/limit `backdrop-filter` (36 uses) and cap blur radius on mobile; trim layered box-shadows in hot paths.

### M9. Accessibility contrast pass — **M**
Verify muted greys over gradients/glass meet 4.5:1; gate Dawn spinners under reduced-motion.

### M10. Split homepage mega-section — **L**
Break `anand-rasa-homepage` (5–6 carousels, ~590 lines inline CSS) into 6–8 JSON-template sections for lazy below-fold loading + merchant control.

---

## 🟢 LOW PRIORITY (cleanup / long-term / maintainability)

### L1. Collapse per-product section duplication — **XL**
4 parameterized sections (nakshatra/zodiac/planet/chakra) driven by metafields/metaobjects instead of 53 schema files. Delete `nakshatra-product-base` legacy duplicate; resolve `main-third-eye`/`main-crown` collision.

### L2. Merge 7 incense PDP clones — **L**
One shared section/snippet (~−300 KB source).

### L3. Externalize inline CSS/JS — **L**
Move 66 inline `<style>` + 148 inline `<script>` blocks into cacheable assets (also unblocks a strict CSP).

### L4. Collection grid refactor — **L**
One luxury-grid section, 1 card render/product, drop bucket-sort assigns (use Shopify sort / metafield ordering).

### L5. CSS specificity cleanup — **M**
Reduce `theme-product-gallery.css` 89 `!important`.

### L6. Next-gen images — **M**
Add AVIF variants for hero/feature images (−20–30%).

### L7. Security hardening — **L**
Report-only CSP after inline scripts externalized; update or remove Three.js r134 / Vanta 0.5.24; verify `rel="noopener"`.

### L8. SEO polish — **M**
Convert client-side `?view=` redirects to 301s; verify `sitemap.xml` excludes `?view=` variants.

### L9. Remove dead weight — **S**
Delete `influencer-dashboard.*`, `vanta.clouds2.min.js`, `section-footer.css`, `component-list-payment.css`, unused Dawn CSS.

---

## Suggested Sequencing

1. **Sprint 1 (1–2 days):** H1–H8 (all quick wins). Re-measure CWV — expect the largest single jump here.
2. **Sprint 2 (1 week):** M1–M9.
3. **Sprint 3 (1 week):** M10 + L9 + start L1/L2.
4. **Sprint 4 (2–4 weeks):** L1–L4 refactors (maintainability/scalability), then L5–L8.

Re-run the Verification block in `performance-checklist.md` after each sprint.
