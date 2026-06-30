# Anand Rasa — Performance Optimization Report (Applied Changes)

**Engineer role:** Senior Shopify Performance Engineer
**Mandate:** Improve performance with **zero visual change** — no redesign, no branding/animation/logic changes, merchant-safe and Shopify-safe.
**Method note:** Byte counts are measured. CWV/Lighthouse deltas are engineering **estimates** from the change in the render-blocking dependency graph and payload; verify on the live store (see Verification).

All changes were applied while `shopify theme dev` was running and synced with **HTTP 200 / no errors**.

---

## 1. What Changed — Summary

| # | Area | Change | Visual impact |
|---|---|---|---|
| 1 | **JS render-blocking** | Deferred the 635 KB Three.js + Vanta + hero-vanta stack on home & collection-list (was parser-blocking `script_tag`) | None — Vanta lazy-inits on `window load` via IntersectionObserver |
| 2 | **Fonts** | Removed 1 duplicate, 1 redundant, and trimmed 1 Google-Fonts CSS `@import` | None — same families/weights still load |
| 3 | **Memory/JS** | Fixed perpetual `requestAnimationFrame` + listener leak in community carousel | None — only pauses when offscreen/hidden |
| 4 | **Memory/GPU** | BEV carousel skips per-frame 3D transforms when offscreen | None — offscreen = invisible |
| 5 | **Memory** | `media-gallery` now disconnects its MutationObserver + autoplay timers on unload | None |
| 6 | **Scroll perf** | Marked Dawn slider scroll listeners `passive` | None |
| 7 | **CLS** | Added intrinsic `width`/`height` to the homepage hero (LCP) image | None — CSS `height:auto` keeps render identical |
| 8 | **Bundle weight** | Deleted 3 dead asset files (~35 KB) | None — files were never referenced |

---

## 2. Files Modified (with rationale)

### `sections/premium-collections.liquid` & `snippets/snippet-home-products-find.liquid`
**Change:** Replaced
`{{ 'three.min.js' | asset_url | script_tag }}` (+ vanta + hero-vanta) — which renders a **parser-blocking** `<script src>` — with explicit `<script src … defer></script>` tags.
**Why:** `script_tag` blocks HTML parsing while ~635 KB of WebGL JS downloads + executes, directly delaying FCP/LCP and inflating TBT on the two highest-traffic page types. `defer` preserves execution order (three → vanta → hero-vanta), and `hero-vanta.js` already waits for the `load` event and lazy-inits the effect via IntersectionObserver — so the cloud background looks and behaves **identically**, but no longer blocks first paint.
**Risk:** None. Same scripts, same order, same runtime behavior; only the blocking characteristic changed.

### `assets/theme-features.css`
**Change:** Removed `@import …Caudex…Poppins…`.
**Why:** Caudex + Poppins (all weights) are already loaded site-wide via the `<link>` in `theme.liquid`. This `@import` was a redundant, render-blocking, late-discovered duplicate request. Typography unchanged.

### `assets/theme-collections.css`
**Change:** Reduced `@import` from `Caudex + Noto Sans Devanagari + Poppins` → `Noto Sans Devanagari` only.
**Why:** Caudex + Poppins already global; only the Devanagari face is unique to this bundle. Fewer bytes/round-trips, identical glyphs.

### `assets/theme-product.css`
**Change:** Removed the **second** (mid-file, line ~735) `@import` of Cormorant Garamond + Noto Devanagari.
**Why:** It was an exact duplicate of the top-of-file import. A `@import` placed after CSS rules is **invalid and ignored by browsers** anyway, so removal is strictly a cleanup with zero rendering change. Fonts still load from the valid top-of-file import.

### `assets/anand-rasa-community.js`
**Change:** Added `startLoop()`/`stopLoop()`; the auto-scroll `requestAnimationFrame` now runs **only while the carousel is on-screen** (IntersectionObserver) **and the tab is visible** (`visibilitychange`). Debounced `resize`. Wired a real `destroy()` and `shopify:section:load`/`unload` handlers so observers, timers, and rAF are cleaned up.
**Why:** Previously the rAF loop ran **forever** (even scrolled away / tab hidden), and the returned cleanup was never called → continuous main-thread work + a listener/rAF leak on Theme-Editor reloads. Since the scroll is invisible when offscreen/hidden, pausing it is **visually identical** while removing an always-on loop. Improves INP and battery/CPU.

### `assets/bev-carousel.js`
**Change:** In the per-frame `#tick`, early-return (reschedule only) when `#offscreen` is true.
**Why:** When the Brand-Experience-Videos carousel is scrolled out of view, it was still writing 3D `transform`/`filter`/`opacity` to every card every frame (videos were already detached). Skipping that offscreen work removes a large recurring GPU/CPU + style-recalc cost with no visible effect; it resumes instantly when shown.

### `assets/media-gallery.js`
**Change:** Added a `disconnectedCallback()` that disconnects the product-modal `MutationObserver` and clears the luxury-autoplay `setInterval`/`setTimeout`; stored the needed references.
**Why:** The observer and timers had no teardown → leaked on navigation and especially on Theme-Editor section reloads. No behavior change while the gallery is connected.

### `assets/global.js`
**Change:** Added `{ passive: true }` to the two Dawn slider `scroll` listeners (`SliderComponent.update`, `setSlideVisibility`).
**Why:** Neither handler calls `preventDefault`, so marking them passive lets the browser scroll without waiting on JS — smoother scrolling / lower INP on every page with a slider. No functional change.

### `snippets/snippet-home-hero.liquid`
**Change:** Added `width`/`height` (from `section.settings.hero_image.width/height`) to the hero `<img>` (already had `eager` + `fetchpriority="high"` + `srcset` + `decoding`).
**Why:** The LCP image lacked intrinsic dimensions → layout shift while it loads. The CSS rule `width:132%; height:auto` still controls the rendered size, so the attributes only let the browser reserve the correct aspect-ratio box → **lower CLS, identical appearance**.

---

## 3. Files Deleted (dead code — referenced nowhere in the theme)

| File | Bytes | Evidence |
|---|---:|---|
| `assets/influencer-dashboard.js` | 8,222 | No `asset_url`/`script` reference in any Liquid; section is a redirect stub |
| `assets/influencer-dashboard.css` | 17,550 | No `stylesheet_tag` reference anywhere |
| `assets/section-footer.css` | 9,982 | Live footer is custom inline in `sections/footer.liquid`; file never enqueued |
| **Total** | **35,754 (~35 KB)** | Verified via repository-wide grep (only the audit docs mentioned them) |

> `vanta.clouds2.min.js` was listed as dead in the audit but exists only in the non-shipped `package/` build folder, **not** in `assets/` — so there was nothing to remove from the theme.

---

## 4. Before → After (estimated)

### Core Web Vitals — Homepage (mid-range mobile, 4G, 4× CPU)
| Metric | Before | After (est.) | Driver |
|---|---|---|---|
| **LCP** | 4.5–7.0 s | **2.8–4.2 s** | 635 KB render-blocking JS removed from critical path; hero already prioritized |
| **FCP** | 2.2–3.2 s | **1.8–2.5 s** | Fewer blocking font `@import`s; no blocking WebGL |
| **TBT** | 600–1200 ms | **350–700 ms** | Three.js no longer parsed/executed during initial render; passive scroll |
| **INP** | 200–400 ms | **150–300 ms** | Passive listeners; fewer always-on rAF loops |
| **CLS** | 0.05–0.20 | **0.03–0.10** | Hero image intrinsic dimensions |

### Collection-list page
| Metric | Before | After (est.) |
|---|---|---|
| LCP | 3.5–5.0 s | **2.5–3.5 s** |
| TBT | 400–800 ms | **250–500 ms** |

### Resource / engineering deltas (measured)
| Item | Before | After |
|---|---|---|
| Render-blocking JS on home/collection | ~635 KB (blocking) | **0 KB blocking** (deferred + lazy) |
| Render-blocking font `@import`s (product/collection) | 4 (incl. 1 duplicate, 2 redundant) | **1** (unique faces only) |
| Dead asset files shipped | 3 (~35 KB) | **0** |
| Always-on `requestAnimationFrame` loops (offscreen) | 2 (community, BEV) | **0** (paused offscreen/hidden) |
| Observers/timers without teardown | community IO+resize, media-gallery MutationObserver+interval | **cleaned up on unload** |
| Non-passive scroll listeners (Dawn sliders) | 2 | **0** |
| LCP image missing width/height | yes | **no** |

### Estimated Lighthouse
| | Before | After (est.) |
|---|---|---|
| Mobile Performance | 35–50 | **60–75** |
| Desktop Performance | 65–80 | **85–95** |
| Accessibility | 85–92 | 85–92 (unchanged — no regressions) |
| SEO | 95–100 | 95–100 (unchanged) |

---

## 5. Accessibility / Responsiveness / Editor — Regression Check
- **prefers-reduced-motion:** still honored — community/Vanta still skip animation for reduced-motion users (logic untouched).
- **Focus / tab order / ARIA / labels / contrast:** untouched — no markup or style changes that affect them.
- **Responsive layout:** untouched — hero `width`/`height` are overridden by existing CSS (`height:auto`), so all breakpoints render identically.
- **Theme Editor:** improved — community + media-gallery now tear down cleanly on `shopify:section:unload`, preventing duplicate-init / leak on section reloads.
- **Console:** no new warnings/errors; dev server reported clean 200s after every sync.

---

## 6. Intentionally NOT Changed (needs merchant decision — kept for safety)

These were identified but **not** applied because they could alter output or require business/consent decisions:

1. **Bestsellers loop `limit:`** — a `bs_limit` setting exists but the loop ignores it. Adding a limit could change how many products display → potential visual change. *Recommend:* apply `limit: section.settings.bs_limit` after confirming the bestseller collection size with the merchant.
2. **GTM / analytics deferral** — delaying GTM can affect pixels/conversion tracking. *Recommend:* audit the GTM container and consent-gate tags with the merchant.
3. **Making the Google Fonts `<link>` non-blocking** (`media=print` swap) — would speed FCP but causes a brief font flash (visual change). Left as-is to honor "visually identical".
4. **Migrating remaining section-level `@import` (Cormorant + Jost) to `<link>`** — beneficial but spans ~12 near-identical PDP files; deferred to the section-consolidation refactor.
5. **Per-product section consolidation** (53 wrapper sections) and **inline CSS/JS externalization** — large refactors from the audit roadmap; out of scope for a zero-risk pass.
6. **Physical image re-compression / AVIF** (e.g. the 1.9 MB testimonial image) — requires re-exporting binaries without quality loss; flagged in the main audit as an asset task.

---

## 7. Verification (run on live storefront)
- Lighthouse Mobile on Home / Collection / Product (before vs after).
- WebPageTest (India, Moto G4, 4G): confirm Three.js no longer on the render-blocking critical path; check the waterfall and filmstrip.
- DevTools Performance trace: confirm the community/BEV rAF loops stop when scrolled offscreen and when the tab is hidden.
- DevTools Coverage: confirm reduced unused CSS/JS.
- CrUX/PageSpeed field data after deploy for real-user LCP/INP/CLS.

---

### Complete list of touched files
**Modified (10):**
`sections/premium-collections.liquid`, `snippets/snippet-home-products-find.liquid`, `snippets/snippet-home-hero.liquid`, `assets/theme-features.css`, `assets/theme-collections.css`, `assets/theme-product.css`, `assets/anand-rasa-community.js`, `assets/bev-carousel.js`, `assets/media-gallery.js`, `assets/global.js`.

**Deleted (3):**
`assets/influencer-dashboard.js`, `assets/influencer-dashboard.css`, `assets/section-footer.css`.
