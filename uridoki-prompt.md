# Recreate this site as a single HTML file: URIDOKI 売り時 — Tokyo Buyback (Kaitori) Shop

You are an expert creative front-end developer. Produce a **single self-contained `index.html`** that reproduces the project below **exactly**: same layout, sections, visuals, motion and interaction. Use pure HTML/CSS/JS in one file, with no build step, framework or bundler. Use ES modules with a CDN importmap for the one library actually used (Lenis smooth-scroll). Hardcode every value given here as a fixed constant. All CSS goes in one `<style>` block in `<head>`, and all JS in one `<script type="module">` block before `</body>`. Every spring and text-reveal animation is written in **plain JS**, as a tiny rAF spring helper and/or CSS transitions.

**No external images.** Every product picture, category icon and hero visual is an **inline SVG illustration** built from the `ART` recipes given below. The only external requests are Google Fonts and Lenis.

All visible copy is **Japanese, verbatim** as written here. Prices, store addresses, phone numbers and statistics are **demo samples** and must be labelled as such where noted.

## What it is

A single-page, light-palette storefront for **"URIDOKI 売り時"**, a Tokyo buyback shop for smartphones, game consoles, cameras, trading cards and Japanese whisky. Its promise is 「いまが、売り時。」("Now is the time to sell"), and its theme is a **daily "Tokyo price board"**.

- **Grid and type:** the page sits on a rem-based adaptive grid whose root font-size scales with the viewport. It uses **Noto Sans JP** for text and **Roboto Mono** for every price and number.
- **Look:** near-white, cool sky-tinted surfaces (`#F6F9FD` page, `#EAF2FB` bands, `#FFFFFF` cards) with a soft **sky-blue brand colour** (`#3E8EE0`). Deep **navy ink** panels (`#16233A`) are used for the loader, menu overlay, stats panel and footer, and **red-pink price numerals** (`#E0475F`) stand out against them.
- **Opening:** a **full-screen navy "appraisal" loader** counts `000 → 100` (査定中) and slides up. Only then do the above-the-fold reveals play.
- **Hero ("appraisal lens"):** a full-bleed **"liquid" cursor-reveal**. The base layer is a faded, greyscale shelf of second-hand products with grey 「査定前」 tags. Moving the pointer paints a soft brush trail that reveals the **full-colour version with red ¥ price tags**. It also has a giant `URIDOKI` watermark, a line-by-line headline, a "today's boosted buyback" carousel card and a brand grid.
- **Below the hero:**
  - the campaign slider and news bar
  - category circles and a search bar
  - a four-pill 「売る / 査定 / → / 現金」 band
  - the **price list** (sidebar + tabs + illustrated product cards with condition radios, quantity stepper, 「買取申込」 and pagination)
  - a 4-row "selling methods" list with hover-fill rows that expand into steps
  - 「選ばれる理由」 cards
  - a navy stats panel with scroll-driven count-up numbers
  - FAQ, stores and per-model price links
  - a navy footer with a CTA, link columns and a watermark
- **Overlays:** the header (logo, nav, live clock chip, favourites, cart, login, Menu) overlays the hero and turns into a solid sticky bar after scrolling. Menu opens a full-screen navy overlay. The cart opens a slide-in **査定カート** drawer. Every 「無料で査定する / お問い合わせ / 査定を申し込む」 CTA opens an **appraisal request modal** with a stubbed submit.
- **Scrolling:** Lenis drives all smooth scrolling.

Sections in DOM order: **PageLoader** → **SkipLink** → **Header** (absolute overlay, becomes sticky) → `main`{ **Hero** → **Campaigns** → **Categories** → **SellBand** → **PriceList** → **Methods** → **Reasons** → **Stats** → **FAQ** → **Stores** } → **Footer** → **NavMenu** (overlay) → **CartDrawer** (overlay) → **AppraisalModal** (overlay) → **Toast**.

## Page shell & libraries

### `<head>`

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>URIDOKI 売り時</title>
<meta name="description" content="スマホ・ゲーム機・カメラ・トレカ・ウイスキーを東京相場で高価買取。店頭は現金即払い、郵送は全国対応。" />
<meta name="theme-color" content="#16233A" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Roboto+Mono:wght@500;700&display=swap" rel="stylesheet">
```

### Importmap + module entry (before `</body>`)

```html
<script type="importmap">
{ "imports": { "lenis": "https://unpkg.com/lenis@1.3.23/dist/lenis.mjs" } }
</script>
<script type="module"> /* all JS below */ </script>
```

```js
import Lenis from 'lenis';
window.scrollTo(0, 0);
const lenis = new Lenis({ smoothWheel: true });
function raf(t){ lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
```

**Scroll lock model.** A single counter `lockCount` gates scrolling. Every overlay (loader, nav menu, cart drawer, modal) calls `stopScroll()`, which increments the counter, calls `lenis.stop()` and sets `html { position:relative; overflow:hidden; height:100% }`. Its matching `startScroll()` decrements the counter, and only when it reaches 0 calls `lenis.start()` and removes those inline styles. The counter matters because the menu can open the modal.

**`scrollTo(id)` helper.** Call `lenis.scrollTo('#'+id, { offset: -72, duration: 1.1 })`, where the offset clears the sticky header. Used by the logo, nav links, category circles, sidebar items, campaign links and the hero 「買取価格を見る」 button.

### Global CSS reset / base

```css
*{ box-sizing:border-box; margin:0; padding:0 }
[hidden]{ display:none !important }
html{ font-size:16px; -webkit-font-smoothing:antialiased }
body{ background:#F6F9FD; color:#1E2A3B; font-family:'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif; line-height:1.6; overflow-x:hidden }
a{ color:inherit; text-decoration:none }
button{ font:inherit; color:inherit; background:none; border:none; cursor:pointer }
ul,ol{ list-style:none }
img,svg{ display:block }
.num{ font-family:'Roboto Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums }
.sr-only{ position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0 }
:focus-visible{ outline:2px solid #3E8EE0; outline-offset:2px; border-radius:.375rem }
@media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; scroll-behavior:auto !important } }
```

### The rem-based adaptive grid (bake exactly)

The whole layout is sized in **rem**, and the root font-size scales with the viewport. `FONT_BASE = 16px`.

```css
@media (max-width:1920px){ html{ font-size:0.833333vw } }   /* base 1920 */
@media (max-width:1440px){ html{ font-size:1.111111vw } }   /* base 1440 */
@media (max-width:1024px){ html{ font-size:1.5625vw } }     /* base 1024 */
@media (max-width:640px){  html{ font-size:4.444444vw } }   /* base 360  */
```

Scale-up above 1920px (runtime JS):

```js
function applyAdaptiveGrid(){
  const FONT_BASE = 16, baseWidth = 1920, coef = 0.6666;
  const w = window.innerWidth;
  const widthReduction = ((baseWidth - w) / baseWidth) * 100;
  const size = FONT_BASE - (FONT_BASE * (widthReduction * coef)) / 100;
  if (size > FONT_BASE) document.documentElement.style.fontSize = size + 'px';
  else document.documentElement.style.removeProperty('font-size');
}
applyAdaptiveGrid(); addEventListener('resize', applyAdaptiveGrid);
```

All sizes below use Tailwind's default scale in rem (`text-xs`=.75, `text-sm`=.875, `text-base`=1, `text-lg`=1.125, `text-xl`=1.25, `text-2xl`=1.5, `text-3xl`=1.875, `text-4xl`=2.25, `text-5xl`=3, `text-6xl`=3.75, `text-7xl`=4.5; spacing unit .25rem). Keep them in rem.

### Shared spring helper

Write one rAF spring stepper (mass 1): `accel = tension*(target-x) - friction*v`, integrated at `dt = 1/60`, settling when `|target-x|<0.001 && |v|<0.001`. Expose `spring(el, {from, to, tension, friction}, applyFn)` for hovers and the carousel. For entrance reveals you may use CSS transitions with these equivalent curves:

- `{210,26}` ≈ `cubic-bezier(.22,1,.36,1)` 0.7s
- `{200,24}` / `{180,26}` ≈ `cubic-bezier(.16,1,.3,1)` 0.8s
- `{320,18}` (hovers) ≈ `cubic-bezier(.2,.8,.2,1)` 0.35s

Hovers only run when `matchMedia('(hover:hover) and (pointer:fine)')` matches; on touch they are disabled. Each hover springs to its `to` state on `mouseenter` and back to `from` on `mouseleave`. Some are triggered by a parent rather than the element itself, as noted inline.

### Reveal helpers

Use one `IntersectionObserver` (`threshold:0.15`, `rootMargin:'0px 0px -8% 0px'`) for all reveals. Each reveal plays **once**. Hero and header reveals are additionally gated on the intro `ready` flag.

- **`[data-reveal]` block reveal:** the element starts at `opacity:0` plus a transform taken from `data-y` (px, default 16) and an optional `data-scale`. On intersect it transitions to `opacity:1; transform:none` using `data-delay` (ms) and the curve for its spring config. Rendered content stays visible even if JS fails: apply the hidden start state only after JS adds `html.js`.
- **Line reveal** (`data-lines`): the author wraps each line in `<span class="ln"><span>…</span></span>`. `.ln` has `display:block; overflow:hidden`. The inner span goes `translateY(100%) → 0` and `opacity 0 → 1`, 900ms `cubic-bezier(.215,.61,.355,1)`, staggered per line by `data-stagger` (ms).
- **Character reveal** (`data-chars`, for Japanese headings, which have no spaces): split into characters (keep punctuation attached to the previous character). Each char goes `translateY(.6em) → 0` and `opacity 0 → 1`, 600ms `cubic-bezier(.165,.84,.44,1)`, stagger `22ms`.
- **Word reveal** (`data-words`): split on `｜` markers placed in the source; each chunk goes `translateY(24px) → 0`, stagger `35ms`, 700ms `cubic-bezier(.165,.84,.44,1)`.

## Fixed palette & tokens (bake these in)

```
--background:#F6F9FD   --band:#EAF2FB        --surface:#FFFFFF
--foreground:#1E2A3B   --muted:#6B7890       --subtle:#A9B6C8
--line:#E1E8F2
--brand:#3E8EE0        --brand-strong:#2C74C4
--brand-soft:#E6F1FC   --brand-tint:#F2F8FE
--brand-from:#6AB2F2   --brand-to:#2C74C4    (gradient pill / accents)
--ink:#16233A          --ink-2:#22324F       (navy panels, dark pills, overlays)
--price:#E0475F        --hot:#F0607A         (price numerals, badges on the cart/heart)
--line-green:#06C755
--hero-bg:#DCEAF8
```

Radii: `--radius-pill:9999px`, `--radius-card:1.25rem`, `--radius-card-lg:2rem` (navy panels, hero, footer), `--radius-control:.75rem`.
Watermark size: `--text-watermark:13rem`. Shell: `.shell{ max-width:75rem; margin-inline:auto; padding-inline:1.25rem }` (sm `2rem`).
Font weights used: 400/500/700/900. All prices use `.num` in `#E0475F`, weight 700.

### Inline SVG icons (`width/height:1em`, `currentColor`)

- **LogoMark** (a price tag with a hole), `viewBox 0 0 48 48`, filled: `M6 8a2 2 0 0 1 2-2h17.2a4 4 0 0 1 2.83 1.17l14.8 14.8a4 4 0 0 1 0 5.66L29.63 40.83a4 4 0 0 1-5.66 0L9.17 26.03A4 4 0 0 1 8 23.2V8Zm10 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z` (hole drawn with `fill-rule:evenodd`).
- **ArrowRight** stroke 2 round: `M5 12h14M13 6l6 6-6 6`
- **ArrowUpRight** stroke 2 round: `M7 17 17 7M8 7h9v9`
- **Star** filled: `M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.94L12 2.5z`
- **Heart** filled: `M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z` (outline version = same path, `fill:none; stroke-width:1.8`)
- **Cart** stroke 2: `M3 4h2l2.4 11h11l2-8H6.3` + circles `(9,19.5,r1.5)` and `(17,19.5,r1.5)`
- **Login** stroke 2.2: `M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5`
- **Search** stroke 2.2: circle `(11,11,r7)` + `M20 20l-4-4`
- **Share** filled: circles `(18,5,r3)`, `(6,12,r3)`, `(18,19,r3)` + stroke lines `M8.6 13.5l6.8 4M15.4 6.5l-6.8 4`
- **X / close** stroke 2: `M4 4l16 16M20 4 4 20`
- **Menu** stroke 2: `M4 6h16M4 12h16M4 18h16`
- **Yen** stroke 2: `M6 4l6 8 6-8M12 12v8M7 13h10M7 17h10`
- **Truck**, **ID card**, **Building** and **Trend-up** are drawn inline in the campaign slides (see Campaigns).

### Product illustration recipes (`ART`) — used everywhere an image appears

Each recipe returns an SVG string with `viewBox="0 0 160 120"`. Reproduce these functions verbatim. Before first use, insert one shared hidden `<svg width=0 height=0>` containing `<linearGradient id="shine" x1=0 x2=1><stop offset=0 stop-color=#fff/><stop offset=.4 stop-color=#fff stop-opacity=0/></linearGradient>`.

```js
const S=(inner,vb="0 0 160 120")=>`<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
const ART={
 phone:(c="#C7B39C",d="#8E7A64")=>S(`<defs><linearGradient id="g${c.slice(1)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient></defs>
  <rect x="42" y="14" width="42" height="92" rx="10" fill="#1D2330"/><rect x="45" y="17" width="36" height="86" rx="8" fill="#9CC4F0"/><path d="M45 70c10-8 22-4 36-14v39a8 8 0 0 1-8 8H53a8 8 0 0 1-8-8z" fill="#6FA6E4"/><rect x="57" y="20" width="12" height="4" rx="2" fill="#1D2330"/>
  <rect x="74" y="10" width="44" height="96" rx="11" fill="url(#g${c.slice(1)})"/><rect x="78" y="15" width="26" height="28" rx="8" fill="${d}" opacity=".85"/>
  <circle cx="86" cy="23" r="5.2" fill="#22252D"/><circle cx="86" cy="35" r="5.2" fill="#22252D"/><circle cx="97" cy="29" r="5.2" fill="#22252D"/><circle cx="86" cy="23" r="2" fill="#4B5568"/><circle cx="86" cy="35" r="2" fill="#4B5568"/><circle cx="97" cy="29" r="2" fill="#4B5568"/><circle cx="111" cy="18" r="1.6" fill="#EEE"/>`),
 android:(c="#7FA7E8",d="#4E77C2")=>S(`<rect x="38" y="12" width="44" height="94" rx="10" fill="#1D2330"/><rect x="41" y="15" width="38" height="88" rx="8" fill="#A9CBF2"/><circle cx="60" cy="20" r="2" fill="#1D2330"/>
  <rect x="72" y="10" width="46" height="96" rx="11" fill="${c}"/><rect x="72" y="22" width="46" height="16" fill="${d}"/><circle cx="84" cy="30" r="5" fill="#22252D"/><circle cx="98" cy="30" r="5" fill="#22252D"/><circle cx="110" cy="30" r="2" fill="#EEE"/>`),
 tablet:()=>S(`<rect x="18" y="20" width="110" height="78" rx="8" fill="#2A3140"/><rect x="23" y="25" width="100" height="68" rx="4" fill="#9CC4F0"/><path d="M23 70c25-18 50-6 100-28v47a4 4 0 0 1-4 4H27a4 4 0 0 1-4-4z" fill="#5E95D8"/>
  <rect x="112" y="64" width="34" height="38" rx="9" fill="#F4F5F7" stroke="#D5DAE2"/><rect x="117" y="76" width="9" height="16" rx="4.5" fill="#fff" stroke="#D5DAE2"/><rect x="131" y="76" width="9" height="16" rx="4.5" fill="#fff" stroke="#D5DAE2"/>`),
 console:(l="#E8414E",r="#2F9BE0",art="#2E3A4F")=>S(`<path d="M28 24l14-10h96l-14 10z" fill="#D9DEE6"/><path d="M124 24l14-10v84l-14 10z" fill="#B9C0CC"/><rect x="28" y="24" width="96" height="84" fill="#FFFFFF" stroke="#D9DEE6"/>
  <rect x="34" y="30" width="84" height="16" fill="${art}"/><rect x="38" y="35" width="26" height="6" rx="1" fill="#fff" opacity=".85"/>
  <rect x="44" y="56" width="10" height="34" rx="5" fill="${l}"/><rect x="98" y="56" width="10" height="34" rx="5" fill="${r}"/><rect x="54" y="56" width="44" height="34" rx="2" fill="#1D2330"/><rect x="57" y="59" width="38" height="28" fill="#6FA6E4"/>
  <rect x="34" y="96" width="84" height="6" fill="${art}" opacity=".2"/>`),
 handheld:(c="#3FB5C9")=>S(`<rect x="22" y="38" width="22" height="46" rx="11" fill="${c}"/><rect x="116" y="38" width="22" height="46" rx="11" fill="${c}"/><rect x="40" y="38" width="80" height="46" rx="4" fill="#2A3140"/><rect x="45" y="43" width="70" height="36" rx="2" fill="#8FBFF0"/><circle cx="33" cy="54" r="4" fill="#1D2330"/><circle cx="127" cy="68" r="4" fill="#1D2330"/>`),
 ps:()=>S(`<ellipse cx="80" cy="110" rx="40" ry="5" fill="#E3E8EF"/><path d="M56 14c10-4 18 0 20 8v84H58c-6-30-8-62-2-92z" fill="#FFFFFF" stroke="#D5DAE2"/><path d="M104 14c-10-4-18 0-20 8v84h18c6-30 8-62 2-92z" fill="#FFFFFF" stroke="#D5DAE2"/><rect x="74" y="20" width="12" height="88" rx="3" fill="#1D2330"/><rect x="77" y="26" width="6" height="3" rx="1.5" fill="#5BA8F5"/>`),
 xbox:(c="#22262E")=>S(`<ellipse cx="80" cy="110" rx="34" ry="5" fill="#E3E8EF"/><rect x="54" y="12" width="52" height="96" rx="5" fill="${c}"/><ellipse cx="80" cy="20" rx="20" ry="4" fill="#3A4150"/><g fill="#2F3540">${Array.from({length:6},(_,i)=>`<circle cx="${66+i*5.6}" cy="20" r="1.4"/>`).join("")}</g><circle cx="62" cy="34" r="3" fill="#7DD36F"/>`),
 earbuds:(c="#1E222A")=>S(`<rect x="44" y="40" width="72" height="56" rx="24" fill="${c}"/><path d="M44 62h72" stroke="#3B414E" stroke-width="2"/><circle cx="80" cy="80" r="2.4" fill="#8BD18A"/><ellipse cx="54" cy="30" rx="14" ry="12" fill="${c}"/><ellipse cx="106" cy="30" rx="14" ry="12" fill="${c}"/><circle cx="54" cy="30" r="5" fill="#B7975E"/><circle cx="106" cy="30" r="5" fill="#B7975E"/>`),
 vr:()=>S(`<path d="M30 52c0-12 10-18 22-18h56c12 0 22 6 22 18v18c0 12-8 20-20 20H96l-8-10h-16l-8 10H50c-12 0-20-8-20-20z" fill="#F4F5F7" stroke="#D5DAE2" stroke-width="2"/><rect x="40" y="46" width="80" height="30" rx="12" fill="#2A3140"/><circle cx="60" cy="61" r="5" fill="#46516A"/><circle cx="100" cy="61" r="5" fill="#46516A"/><path d="M30 58H14M130 58h16" stroke="#C9CFD9" stroke-width="6" stroke-linecap="round"/>`),
 game:(c="#E8414E",art="#3E8EE0")=>S(`<rect x="48" y="12" width="64" height="98" rx="4" fill="${c}"/><rect x="52" y="20" width="56" height="74" fill="${art}"/><circle cx="80" cy="52" r="18" fill="#FFD25C" opacity=".9"/><path d="M58 94l14-22 10 12 8-8 18 18z" fill="#2E7D4F"/><rect x="52" y="14" width="30" height="4" rx="1" fill="#fff"/>`),
 cardbox:(a="#F6C343",b="#E85A4F",c="#3E8EE0")=>S(`<path d="M24 34l16-14h96l-16 14z" fill="${b}"/><path d="M120 34l16-14v70l-16 14z" fill="${c}" opacity=".85"/><rect x="24" y="34" width="96" height="70" fill="${a}"/>
  <path d="M72 46l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="#fff"/><rect x="30" y="90" width="84" height="8" rx="2" fill="${b}" opacity=".9"/><rect x="30" y="40" width="30" height="6" rx="2" fill="#fff" opacity=".7"/>`),
 top:()=>S(`<rect x="34" y="16" width="92" height="90" rx="6" fill="#F1F4F9" stroke="#D5DAE2"/><circle cx="80" cy="60" r="30" fill="#3E8EE0"/><circle cx="80" cy="60" r="30" fill="none" stroke="#E8414E" stroke-width="6" stroke-dasharray="14 8"/><circle cx="80" cy="60" r="12" fill="#F6C343"/><circle cx="80" cy="60" r="4" fill="#1D2330"/><rect x="40" y="22" width="34" height="8" rx="2" fill="#1D2330"/>`),
 bottle:(liq="#B5651D",lab="#F4EBDD",cap="#2B2B2B",box)=>{const o=box?24:0;return S(`${box?`<rect x="30" y="16" width="44" height="96" rx="2" fill="${box}"/><rect x="36" y="40" width="32" height="40" fill="#F4EBDD" opacity=".9"/><text x="52" y="66" font-size="18" text-anchor="middle" fill="${box}" font-family="serif" font-weight="700">酒</text>`:""}
  <rect x="${72+o}" y="6" width="16" height="14" rx="2" fill="${cap}"/><path d="M${70+o} 20h20v12c10 6 14 14 14 24v50a6 6 0 0 1-6 6h-36a6 6 0 0 1-6-6V56c0-10 4-18 14-24z" fill="${liq}"/><path d="M${70+o} 20h20v12c10 6 14 14 14 24v50a6 6 0 0 1-6 6h-36a6 6 0 0 1-6-6V56c0-10 4-18 14-24z" fill="url(#shine)" opacity=".25"/>
  <rect x="${60+o}" y="62" width="40" height="34" rx="2" fill="${lab}"/><rect x="${66+o}" y="70" width="28" height="3" fill="${cap}"/><rect x="${69+o}" y="78" width="22" height="2" fill="${cap}" opacity=".6"/><rect x="${66+o}" y="86" width="28" height="2" fill="${cap}" opacity=".4"/>`)},
 camera:()=>S(`<rect x="22" y="36" width="116" height="66" rx="10" fill="#22262E"/><path d="M52 36l8-14h32l8 14z" fill="#22262E"/><circle cx="84" cy="70" r="27" fill="#3A404D"/><circle cx="84" cy="70" r="20" fill="#14171D"/><circle cx="84" cy="70" r="11" fill="#2D4A73"/><circle cx="79" cy="65" r="4" fill="#7FB3EE" opacity=".8"/><rect x="28" y="30" width="16" height="7" rx="2" fill="#3A404D"/><rect x="116" y="44" width="14" height="8" rx="2" fill="#E8414E"/>`)
};
const art = a => ART[a[0]](...a.slice(1));   // a = ["phone","#E9925A","#B8642F"]
```

---

## The loader (PageLoader — 査定中)

A fixed full-screen panel shown from first paint: `position:fixed; inset:0; z-index:120; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2rem; background:#16233A; color:#fff; border-radius:0 0 2rem 2rem`.

- Calls `stopScroll()` on mount.
- **Centre content** (`gap:1.25rem; text-align:center`):
  - A row `display:flex; align-items:center; gap:.625rem; font-size:1.875rem; font-weight:900; letter-spacing:.04em` (sm 2.25rem) containing `[LogoMark 2rem, color:#6AB2F2] 売り時`, followed by a small `font-size:.75rem; font-weight:500; letter-spacing:.2em; color:rgba(255,255,255,.5)` **uridoki** stacked under the wordmark.
  - Below it, `font-size:.875rem; color:rgba(255,255,255,.6)`: **「いまが、売り時。」**
- **Progress block** `width:min(22rem,72vw); gap:.75rem`:
  - A `height:1px` track (`background:rgba(255,255,255,.15)`) with a fill `background:#6AB2F2; width:<progress>%; transition:width .1s ease-out`.
  - Under it, a row `justify-content:space-between; font-size:.75rem; font-weight:500; letter-spacing:.08em; color:rgba(255,255,255,.5)`. Left: **「査定中」** followed by `<span class="sr-only">Appraising</span>`. Right: a `.num` counter (`color:rgba(255,255,255,.85)`) showing the progress **zero-padded to 3 digits** (`000`…`100`) and a trailing `%`.
- **Price ticker flourish** (decorative, `aria-hidden`): `font-size:.75rem; color:rgba(255,255,255,.35)`, placed under the progress block. Each time progress crosses 25 / 50 / 75 / 100, it swaps in the next line from a list (fade + `translateY 6px→0`, 200ms): `iPhone17 Pro Max ¥198,000`, `Switch 2 ¥51,800`, `山崎 12年 ¥22,000`, `ポケモンカード 1BOX ¥8,500`.
- **Count:** progress goes `0 → 100` over `FILL_MS = 1300ms`, eased with easeInOutCubic (`t<.5 ? 4t³ : 1-((-2t+2)³)/2`), `progress = round(ease(t)*100)`.
- **Exit:** at 100, wait 120ms, then slide the panel `translateY(0) → translateY(-100%)`, `{220,30}` (≈ .7s `cubic-bezier(.22,1,.36,1)`). Meanwhile fade the centre content `opacity 1→0, translateY 0→-12px`, `{260,26}`. When the slide ends: set `ready = true`, dispatch `document.dispatchEvent(new Event('intro:ready'))`, call `startScroll()` and remove the loader node.

---

## Layout & sections (in order)

Breakpoints: sm `640px`, md `768px`, lg `1024px`.

### Skip link

`<a href="#main">メインコンテンツへ移動</a>`, visually hidden until focused; on focus `position:fixed; left:1rem; top:1rem; z-index:130; border-radius:.75rem; background:#16233A; padding:.5rem 1rem; font-size:.875rem; color:#fff`.

---

### 1) Header (overlay → sticky, entrance gated on `ready`)

`<header class="top">`: `position:absolute; inset-inline:0; top:0; z-index:50`. Entrance: `opacity 0→1, translateY(-14px→0)`, `{210,26}`, delay 150ms after `ready`.

**Stuck state:** once `scrollY > 120`, add `.is-stuck`. The header becomes `position:fixed; background:rgba(255,255,255,.92); backdrop-filter:blur(12px); border-bottom:1px solid #E1E8F2; box-shadow:0 6px 20px -16px rgba(30,60,110,.35)` and slides in from `translateY(-100%)` to `0` (.45s `cubic-bezier(.22,1,.36,1)`). When `scrollY < 60` the class is removed (hysteresis). Toggle the class with Lenis's `scroll` event.

Inner: `.shell` flex row, `align-items:center; gap:1.25rem; height:4.5rem` (stuck: `4rem`, transition .3s).

- **Logo button** (→ `scrollTo('home')`): a hover-spring span (`scale 1→1.04`, `{320,18}`) laid out as a column. **売り時** `font-size:1.625rem; font-weight:900; color:#3E8EE0; letter-spacing:.04em; line-height:1`, with **uridoki** under it (`font-size:.6875rem; font-weight:500; letter-spacing:.12em; color:#3E8EE0`). `white-space:nowrap; flex:none`.
- **Tagline pill** (hidden below 1100px): `display:flex; align-items:center; gap:.5rem; font-size:.8125rem; font-weight:700; color:#3E8EE0` with a `1.375rem` round `#3E8EE0` check badge (`✓`, white) and the text **「高価買取・現金即払い・全国郵送OK」**.
- **Primary nav** (`margin-left:auto`, hidden below `lg`): `ul display:flex; gap:.25rem; font-size:.875rem; font-weight:500`. Each item is a button with `padding:.5rem .75rem; border-radius:.5rem` and hover `background:#F2F8FE; color:#3E8EE0`. Its label hover-lifts `translateY(0→-2px)`, `{320,22}`. Items:
  - **買取価格** → `#prices`
  - **買取の流れ ▾** → `#flow` (caret `font-size:.6875rem; opacity:.6`)
  - **よくあるご質問** → `#faq`
  - **店舗一覧 ▾** → `#stores`
  - **お問い合わせ** → opens the AppraisalModal
- **Clock chip** (hidden below `md`): `border:1px solid rgba(225,232,242,.9); background:rgba(255,255,255,.55); backdrop-filter:blur(6px); border-radius:.75rem; padding:.5rem .75rem; gap:.625rem; font-size:.75rem; color:rgba(30,42,59,.7)`. It contains:
  - the label **「本日の相場」** (`color:#6B7890`)
  - a live **time** (`.num; min-width:3.25rem; font-weight:700; color:#1E2A3B`)
  - a `•` separator (`color:#A9B6C8`)
  - a live **date**
  - a tiny pulsing `.375rem` dot in `#06C755` (CSS `@keyframes pulse{50%{opacity:.25}}` 1.6s infinite)
- **Clock JS:** updates every 1s. Time is 24-hour `HH:MM` (zero-padded). Date is `YYYY年M月D日`. Fallbacks before the first tick: `10:30` / `2026年10月19日`.
- **Icon buttons** (`2.5rem` circles, `border:1px solid #E1E8F2; background:#fff; color:#3E8EE0`; hover-spring `scale 1→1.06`):
  - **Favourites** (Heart): filters the price list to favourites and scrolls there. A `#F0607A` count badge sits at the top-right (`min-width:1.125rem; height:1.125rem; font-size:.65rem`) and is hidden when 0.
  - **Cart** (Cart icon): opens the CartDrawer. Its count badge is always shown. When an item is added, the badge does a **bump** (`scale 1→1.35→1`, `{320,14}`).
- **Login pill** (`display:flex; gap:.375rem; border:1.5px solid #3E8EE0; color:#3E8EE0; background:#fff; border-radius:9999px; padding:.4375rem 1rem; font-size:.8125rem; font-weight:700`): `[Login icon] 会員登録・ログイン`. Below `sm` only the icon shows.
- **Menu button** (shown below `lg`; on desktop it sits after Login): `border:1px solid #E1E8F2; background:rgba(255,255,255,.55); border-radius:.75rem`. Inner hover-spring span (`scale 1→1.05`) `padding:.5rem .875rem; font-size:.75rem; font-weight:700; letter-spacing:.08em` → `[Menu icon] MENU`. Opens the NavMenu.

---

### 2) Hero (`#home`) — the appraisal-lens liquid reveal

`section#home`: `position:relative; isolation:isolate; overflow:hidden; border-radius:0 0 2rem 2rem; background:#DCEAF8`.

**A) Two scene layers, generated at runtime** (no image files). Build two SVG strings with `viewBox="0 0 1600 900"` and `preserveAspectRatio="xMidYMid slice"` from the same **shelf layout**:

- **Background:** a `linearGradient` top→bottom `#EEF5FD → #D4E5F7`, plus faint horizontal "shelf" lines at y = 330 and 740 (`stroke:#C4D7EE; stroke-width:6`), each with a soft shadow line 10px lower (`#B9CFEA`, opacity .5).
- **Items** (each `ART` SVG nested as `<svg x y width="300" height="225" viewBox="0 0 160 120">`), sitting on the shelves:

| # | art | x,y | price tag text |
|---|---|---|---|
| 1 | `["phone","#E9925A","#B8642F"]` | 90,110 | ¥198,000 |
| 2 | `["console","#E8414E","#2F9BE0","#E8414E"]` | 470,105 | ¥51,800 |
| 3 | `["bottle","#B8742A","#F4EBDD","#1F1F1F","#B3282D"]` | 860,105 | ¥22,000 |
| 4 | `["cardbox","#F6C343","#E85A4F","#3E8EE0"]` | 1230,110 | ¥8,500 |
| 5 | `["camera"]` | 150,520 | ¥64,000 |
| 6 | `["ps"]` | 560,515 | ¥51,000 |
| 7 | `["earbuds","#1E222A"]` | 930,525 | ¥34,600 |
| 8 | `["android","#9DC0EE","#5E86C9"]` | 1290,515 | ¥105,000 |

- **Tags:** each item has a hanging tag at `(x+230, y+20)`, rotated `-8deg` around its top-left. The tag is a string line from the item corner, then a `120×48` rounded rect (`rx 10`) with a `6px` hole circle at its left.
  - **Base layer ("before"):** the item group is wrapped in `<g filter="url(#desat)" opacity=".55">`, where `#desat` is `<feColorMatrix type="saturate" values="0.08"/>`. Tags are `fill:#FFFFFF; stroke:#C9D3E0` with text **「査定前」** in `#A9B6C8`, `font-size 22, weight 700`.
  - **Revealed layer ("after"):** items in full colour at opacity 1. Tags are `fill:#FFFFFF; stroke:#E0475F; stroke-width:2.5` with the price in `#E0475F`, `font-family:'Roboto Mono'`, `font-size 24, weight 700`, plus a tiny `#3E8EE0` **「強化」** chip above the tag. Behind each item, a soft radial glow `rgba(62,142,224,.18)` (r 170).
- **Base image:** an `<img alt="" fetchpriority="high">` with `src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(baseSVG)`, `object-fit:cover; position:absolute; inset:0; width/height:100%`.
- **Revealed image:** load `afterSVG` the same way into an `Image()`. Once it loads, initialise the canvas.

**LiquidReveal mechanics** (bake exactly):

- **Elements:** a `<canvas aria-hidden>` with `position:absolute; inset:0; width/height:100%; pointer-events:none` sits above the base img.
- **Params:** `brushRadius = 150` (CSS px; the lens), `decay = 0.016` per frame, `dpr = min(devicePixelRatio, 2)`.
- **Sizing:** size the canvas to the container rect × dpr and re-measure with a ResizeObserver. Build an offscreen **cover** canvas at canvas resolution and draw the revealed image into it with object-fit:cover math (scale to fill, centre). `radius = brushRadius*dpr`. The **brush** is an offscreen square canvas `diameter = ceil(radius*2)`.
- **Pointer trail:** listen to `pointermove` on `window`; touch drags work too. Convert to canvas space (×dpr), ignore points more than `radius` outside the canvas (and reset `last`), and interpolate with `step = max(radius*0.3, 1)`, `n = min(ceil(dist/step), 60)`.
- **Tick (rAF):**
  - If points are queued, set `idle = 0`; otherwise `idle++` and stop once `idle > 120`.
  - `fade = drawing ? decay : min(decay + idle*0.004, 0.5)`. Apply `destination-out` with `fillStyle = rgba(0,0,0,fade)` and `fillRect` the full canvas.
  - Stamp each queued point. At `idle === 120`, `clearRect` the full canvas.
- **stamp(x,y):**
  1. On the brush canvas: clear, then `source-over` a radial gradient (stops `0 → rgba(255,255,255,1)`, `.55 → rgba(255,255,255,.82)`, `1 → rgba(255,255,255,0)`).
  2. Then `source-in`, draw the matching region of the cover canvas.
  3. Finally `source-over` the brush onto the main canvas at `(x-c, y-c)`.
- **Lens ring** (theme touch): a separate absolutely-positioned `div.lens` (`width/height: 300px` CSS px; `border-radius:50%; border:1.5px solid rgba(62,142,224,.55); box-shadow:0 0 0 6px rgba(62,142,224,.08); pointer-events:none; z-index:2`). It follows the pointer through a spring (`{260,24}`, applied separately to x and y), and contains a tiny label chip at its bottom-right (`background:#3E8EE0; color:#fff; font-size:.6875rem; font-weight:700; border-radius:9999px; padding:.125rem .5rem`) reading **「査定中」**. It fades in on first move and fades out (`opacity .3s`) after the same 120 idle frames. It is hidden on touch.
- **Reduced motion:** skip the canvas and lens and show the **revealed** SVG as the static base, so prices stay visible.
- **Hint chip:** `position:absolute; left:50%; bottom:5.5rem; translateX(-50%); z-index:3`, a white pill (`rgba(255,255,255,.8)`, blur 8px, `font-size:.75rem; font-weight:700; color:#2C74C4; padding:.375rem .875rem; border-radius:9999px`). Text: **「カーソルを動かして査定額をチェック」** (touch: **「なぞって査定額をチェック」**). It reveals with delay 1100ms and disappears permanently (fade .4s) after the first 40 stamps.

**B) Legibility veil** `position:absolute; inset:0; z-index:1; pointer-events:none; background:linear-gradient(to right, rgba(246,249,253,.88) 0%, rgba(246,249,253,.55) 42%, rgba(246,249,253,0) 70%)`. Below `lg`: `linear-gradient(to bottom, rgba(246,249,253,.9), rgba(246,249,253,.4) 60%, rgba(246,249,253,.85))`.

**C) Watermark** (`pointer-events:none; position:absolute; inset-inline:0; bottom:6rem; z-index:1; text-align:center; user-select:none; font-weight:900; line-height:1; font-size:13rem; letter-spacing:-.02em; color:rgba(255,255,255,.5)`): **URIDOKI**. Reveal gated on `ready`: `opacity 0→0.5, translateY(20px→0)`, `{120,30}`, delay 300ms.

**D) Content grid** `.shell` `position:relative; z-index:20; display:flex; flex-direction:column; gap:2rem; padding:7rem 1.25rem 5rem` (sm px 2rem). At lg: `display:grid; min-height:100lvh; grid-template-columns:repeat(12,1fr); gap:2.5rem; padding:9rem 2rem 7rem; align-items:center`. The content wrapper has `pointer-events:none`; interactive children set `pointer-events:auto` so the lens keeps working across the text.

- **Left column** (lg span 7), `display:flex; flex-direction:column; gap:1.5rem`:
  - **Eyebrow** (reveal y 10, delay 200): Eyebrow (dark tone) → **「東京相場・毎朝更新」**, followed by a `.num` date chip `2026/10/19` (`background:#E6F1FC; color:#2C74C4; border-radius:9999px; padding:.125rem .5rem; font-size:.75rem`).
  - **H1** (line reveal gated on `ready`, delay 250, `stagger 120`): `max-width:14ch; font-size:2.5rem; font-weight:900; line-height:1.12; letter-spacing:-.01em` (sm 3.25rem, md 4rem, lg 4.5rem). Lines: **「スマホも、ゲームも、」** / **「お酒も。」** / **「いまが、<em>売り時</em>。」**, where `em{ font-style:normal; color:#3E8EE0 }`.
  - **Lead** (reveal delay 550): `max-width:34em; font-size:.9375rem; color:#6B7890`: 「毎朝更新する東京相場で、店頭なら現金即払い。郵送なら全国どこからでも同じ価格で買い取ります。」
  - **Rating row** (reveal delay 650): `display:flex; align-items:center; gap:.75rem`. Five Star icons in `#F6B93B` (1rem), then `font-size:.875rem; font-weight:700` **「4.8」** and `color:#6B7890` **「お客様満足度（サンプル）」**.
  - **CTA row** (reveal delay 750): `display:flex; flex-wrap:wrap; gap:.75rem`. **「無料で査定する」** (PillButton `brand`, withArrow, opens the AppraisalModal) and **「買取価格を見る」** (PillButton `outline`, → `scrollTo('prices')`).
- **Right column** (lg span 5), `display:flex; flex-direction:column; align-items:flex-start; gap:2rem` (lg `align-items:flex-end`):
  - **HeroCard: 本日の強化買取 carousel.** Reveal `opacity / translateY(16px) / scale(.96→1)`, `{200,24}`, delay 400. Card: `width:100%; max-width:24rem` (lg `20rem`); `border-radius:1.25rem; background:rgba(255,255,255,.78); padding:.5rem; box-shadow:0 10px 30px -18px rgba(30,80,150,.45), 0 0 0 1px rgba(225,232,242,.9); backdrop-filter:blur(12px)`. Inside, a clickable row (`display:flex; gap:.5rem; cursor:pointer`):
    - **Left tile:** `aspect-ratio:1; width:6rem; display:grid; place-items:center; border-radius:.875rem; background:#FFFFFF; box-shadow:inset 0 0 0 1px #E1E8F2`, showing the **active item's ART** (svg `width:86%`). A `#3E8EE0` **「強化」** badge sits at the top-left (`font-size:.625rem; padding:0 .375rem; border-radius:.3rem; color:#fff`).
    - **Right panel:** `flex:1; border-radius:.875rem; background:rgba(242,248,254,.9); padding:.75rem; display:flex; flex-direction:column; justify-content:space-between`. Top is a `position:relative; min-height:3.75rem` slot with:
      - a **caption** (`font-size:.65rem; font-weight:700; letter-spacing:.08em; color:#6B7890`)
      - a **title** (`font-size:.8125rem; font-weight:700; line-height:1.35`)
      - a **price** (`.num; font-size:1.125rem; color:#E0475F`)
      - a **delta** (`.num; font-size:.6875rem; color:#18A058` for ▲ or `#E0475F` for ▼)
    - **Items (cycle):**
      - `{caption:"本日の強化 · スマホ", title:"iPhone17 Pro Max 256GB", price:198000, delta:+1500, art:["phone","#E9925A","#B8642F"]}`
      - `{caption:"本日の強化 · ゲーム", title:"Nintendo Switch 2", price:51800, delta:+200, art:["console","#E8414E","#2F9BE0","#E8414E"]}`
      - `{caption:"本日の強化 · お酒", title:"山崎 12年 700ml", price:22000, delta:+500, art:["bottle","#B8742A","#F4EBDD","#1F1F1F","#B3282D"]}`
      - `{caption:"本日の強化 · トレカ", title:"ポケモンカード 1BOX", price:8500, delta:-200, art:["cardbox","#F6C343","#E85A4F","#3E8EE0"]}`
    - **Bottom row:** dots on the left (`height:.25rem; border-radius:9999px; transition:all .3s`; active `width:1rem; background:#3E8EE0`, inactive `width:.375rem; background:rgba(30,42,59,.18)`). Prev/next buttons on the right (`1.75rem` circles, white, `color:#6B7890; box-shadow:0 0 0 1px #E1E8F2`, hover `color:#2C74C4`; prev = ArrowRight rotated 180°).
    - **Behaviour:** clicking the card or Next advances, Prev goes back, and the index wraps `(i+step+n)%n`. **Autoplay every 4s**, paused on hover and while the tab is hidden. Swap animation: the outgoing text slides `translateY(±14px)` and fades out; the incoming text enters from `∓14px` with `{300,28}`. The tile art cross-fades with a slight `scale(.9→1)`. The **price counts up** from the previous price to the new one over 500ms (easeOutCubic).
  - **Brands** (reveal y 14, `{200,24}`, delay 550): `width:100%; max-width:24rem` (lg 20rem). Label `margin-bottom:.75rem; font-size:.75rem; font-weight:700; color:#6B7890` (lg right-aligned): **「主な取扱メーカー」**. Then a `display:grid; grid-template-columns:repeat(4,1fr); column-gap:1rem; row-gap:.625rem` list. Each item is a hover-spring span (`translateY(0→-2px)`, opacity `.7→1`, `{320,20}`) `display:flex; align-items:center; gap:.375rem; font-size:.75rem; font-weight:500; color:rgba(30,42,59,.75)` with a `.375rem` `#3E8EE0` dot before the name. Names: **Apple, Nintendo, Sony, Google, Samsung, Meta, Suntory, Nikka**.

**E) Bottom status bar** (reveal opacity only, delay 900): `.shell` `position:relative; z-index:20; display:flex; align-items:center; justify-content:space-between; gap:.75rem; border-top:1px solid rgba(30,42,59,.1); padding-block:1.25rem; font-size:.75rem; font-weight:500; letter-spacing:.04em; color:rgba(30,42,59,.6)`.
- Left: **「古物商許可 第000000000000号（サンプル）」**
- Centre (hidden below sm): **「店頭・郵送・法人 全国対応」**
- Right: `inline-flex; gap:.5rem` **「スクロール」** plus a `↓` that bobs (`translateY 0→4px`, 1.4s ease-in-out infinite alternate).

---

### 3) Campaigns (slider + news)

`section` `background:#F6F9FD; padding-block:3rem 1rem`. `.shell`.

- **Slider:** a horizontal scroll-snap track (`display:grid; grid-auto-flow:column; grid-auto-columns:calc(50% - .5rem); gap:1rem; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none`; below md `grid-auto-columns:100%`).
  - **Slides** (`scroll-snap-align:start; position:relative; overflow:hidden; background:#fff; border-radius:1.25rem; padding:1.75rem 2rem; min-height:12rem; display:flex; flex-direction:column; align-items:flex-start; gap:.375rem; box-shadow:0 0 0 1px #E1E8F2`) each contain:
    - a decorative circle `::after` (`right:-3rem; bottom:-4.5rem; width/height:14rem; border-radius:50%; background:#E6F1FC`)
    - a pill (`font-size:.6875rem; font-weight:700; color:#2C74C4; background:#E6F1FC; border-radius:9999px; padding:.1875rem .75rem`)
    - an `h3` (`font-size:1.375rem; font-weight:900`)
    - a `p` (`font-size:.8125rem; color:#6B7890; max-width:24em`)
    - a **「詳しく見る →」** pill (`margin-top:auto; background:#3E8EE0; color:#fff; font-size:.8125rem; font-weight:700; border-radius:9999px; padding:.5625rem 1.25rem`)
    - an illustration (`position:absolute; right:1.75rem; bottom:1.5rem; width/height:4rem; z-index:1`)
  - Each slide reveals (y 24, delay `index*90`). Hovering a slide floats its illustration (`translateY(0→-6px) rotate(0→-4deg)`, `{300,18}`).
  - **Slides:**
    1. Pill 「期間限定キャンペーン」 / 「着払いキャンペーン実施中」 / 「ヤマト運輸・佐川急便の着払いで、送料・査定料すべて0円。」 → opens the 郵送 method row in Methods. Illustration **truck**: `<rect x4 y18 w34 h24 rx3 fill#3B4A60/><path d="M38 24h12l8 9v9H38z" fill#3E8EE0/><rect x42 y27 w8 h6 rx1 fill#fff/>`, wheels at (16,45) and (48,45) `r6 #1E2A3B` with `r2.5 #fff` hubs, and the text "¥0" (white, 11px, 900) at (21,34).
    2. 「新機能のお知らせ」 / 「eKYC本人確認 導入実施中」 / 「スマホで書類撮影＋顔認証。最短即日で本人確認が完了。」 → `#faq`. Illustration **ID card**: `rect x4 y12 w50 h36 rx5 #3B4A60`, head `circle 20,28 r7 #C8D6E8`, shoulders `M10 42c2-6 6-8 10-8s8 2 10 8 #C8D6E8`, two text bars, and a `#3E8EE0` check badge `circle 50,46 r10` with a white tick `M45 46l3.5 3.5L55 43`.
    3. 「買取強化中」 / 「iPhone 買取強化中」 / 「最新モデルから旧機種まで、いま査定額アップ中。」 → price list tab `phone`. Illustration **trend phone**: a phone `rect x18 y4 w28 h56 rx6 #3B4A60`, screen `#BFD8F4`, rising line `M26 38l6-8 5 5 5-9` plus arrowhead `M38 26h4v4` (stroke `#3E8EE0`, 3, round).
    4. 「法人のお客様」 / 「法人まとめ買取 受付中」 / 「在庫の新品家電や入れ替えの社用スマホを一括でお見積り。」 → 法人 method row. Illustration **buildings**: `rect x10 y14 w30 h44 #3B4A60`, `rect x40 y28 w16 h30 #3E8EE0`, and 6 window squares `#BFD8F4`.
  - **Arrows:** `2.125rem` white circles (`box-shadow:0 2px 8px rgba(30,60,110,.12)`) at `left/right:-.75rem` (on mobile `.25rem`). Next wraps to the start at the end.
  - **Dots:** under the track, `.5rem` pills, active `width:1.375rem; background:#3E8EE0`, else `#C9D6E6`.
  - **Autoplay** every 6s; stops permanently on the first pointerdown or arrow click.
- **News bar** (reveal y 12): `margin-top:1.25rem; display:flex; align-items:center; gap:.75rem; background:#F2F8FE; border:1px solid #CFE2F7; border-left:4px solid #3E8EE0; border-radius:.625rem; padding:.75rem 1.125rem; font-size:.8125rem`. Contents: **「お知らせ」** (bold), a `NEW` chip (`#3E8EE0`, white, `.625rem`), a `.num` date **2026/10/15** in `#2C74C4`, then the ellipsised text **「【重要】Nintendo Switch 2 中古ゲームソフトの買取を開始しました」** and a right-aligned **「すべて見る ›」** (date and link hidden below 620px). The text line **rotates every 5s** through 3 news items with a vertical slide (`translateY(100%→0)`, old one out to `-100%`, .5s):
  - 2026/10/15 「【重要】Nintendo Switch 2 中古ゲームソフトの買取を開始しました」
  - 2026/10/08 「年末年始の郵送予約承認スケジュールについて」
  - 2026/09/30 「店頭買取の現金お支払い上限について」

---

### 4) Categories + search

`section` `padding-block:2.5rem 0`. `.shell`.

- **H2** (char reveal): `font-size:1.375rem; font-weight:700; margin-bottom:1.25rem` → **「人気カテゴリー」**.
- **Grid** `display:grid; grid-template-columns:repeat(7,1fr); gap:.875rem` (below md: 4 columns). Each item is a button (`display:flex; flex-direction:column; align-items:center; gap:.625rem; font-size:.8125rem; font-weight:700`) that reveals with y 20 and delay `index*60`. It contains a `.circle` (`width:100%; max-width:6rem; aspect-ratio:1; border-radius:50%; background:#fff; border:1px solid #E1E8F2; display:grid; place-items:center; overflow:hidden`) whose ART svg is `78%` wide. Hover-spring on the circle (triggered by the button): `translateY(0→-4px)` plus box-shadow `0 10px 22px -12px rgba(30,80,150,.45)`, while the inner svg goes `scale(1→1.08) rotate(0→-3deg)`, `{300,18}`. Click → set the price-list tab (and search term if given), then `scrollTo('prices')`.
  - iPhone `["phone","#7C2F3C","#4E1A25"]` → tab `phone`, q 「iPhone」
  - Android `["android","#7FA7E8","#4E77C2"]` → `phone`, q 「Pixel」
  - Apple `["tablet"]` → `phone`, q 「iPad」
  - ゲーム `["console","#E8414E","#2F9BE0","#2E3A4F"]` → `kaden`, q 「Switch」
  - カメラ `["camera"]` → `kaden`
  - おもちゃ `["cardbox","#F6C343","#E85A4F","#3E8EE0"]` → `toy`
  - ウイスキー `["bottle","#B8742A","#F4EBDD","#1F1F1F","#B3282D"]` → `sake`
- **Search form** (reveal y 16): `display:flex; align-items:center; gap:.625rem; background:#fff; border:1px solid #E1E8F2; border-radius:9999px; padding:.375rem .375rem .375rem 1.25rem; margin-block:1.75rem 0; box-shadow:0 4px 14px -10px rgba(30,80,150,.35)`. On focus-within: `border-color:#3E8EE0; box-shadow:0 0 0 4px rgba(62,142,224,.15)` (.25s). Contents: a Search icon (`#6B7890`), an `input type=search id="q"` (placeholder **「商品名・型番・JANコードで検索（例: iPhone17 / 山崎）」**, `aria-label="商品を検索"`) and a submit button **「検索」** (`background:#3E8EE0; color:#fff; font-weight:700; border-radius:9999px; padding:.625rem 1.625rem`). Submit → filter the price list by the query and `scrollTo('prices')`. **Typing placeholder:** while the input is empty and unfocused, the placeholder cycles through `iPhone17 Pro Max`, `Switch 2`, `山崎 12年`, `ポケモンカード`, typed character-by-character (70ms per char, hold 1.6s, erase 35ms per char), wrapped as 「商品名・型番・JANコードで検索（例: ___）」.

---

### 5) SellBand ("売る → 査定 → 現金")

`section` `padding-block:2.5rem`. `ul.shell` `display:flex; flex-direction:column; gap:.75rem` (sm: `flex-direction:row; gap:1rem`). Four `li{flex:1}`, each revealing with y 28, `{200,22}`, delay `index*120`, wrapping a hover-spring tile (`scale 1→1.03`, `{300,18}`): `display:grid; place-items:center; height:6rem; border-radius:9999px; font-size:1.875rem; font-weight:900` (sm `height:9rem; font-size:2.5rem`).

1. **「売る」**: `background:#EAF2FB; color:#1E2A3B`
2. **「査定」**: `background:linear-gradient(to bottom right,#6AB2F2,#2C74C4); color:#fff`
3. (arrow): `background:#16233A; color:#fff`, ArrowRight `font-size:2.25rem` (sm 3rem). On hover the arrow nudges `translateX(0→6px)`.
4. **「現金」**: `background:rgba(234,242,251,.6); color:rgba(30,42,59,.35)`. When the band scrolls into view, after the four reveals finish (≈ +600ms), this tile **lights up**: its background crossfades to `#FFF1F3`, its colour to `#E0475F`, and it gains a `.num` `¥` prefix (.6s).

---

### 6) Price list (`#prices`) — the core shop

`section#prices` `padding-block:2.5rem 5rem` (lg pb 6rem). `.shell`.

- **Header row** `display:flex; flex-wrap:wrap; align-items:end; justify-content:space-between; gap:1rem 2rem; margin-bottom:1.5rem`:
  - Left: Eyebrow (bordered variant: `border:1px solid #E1E8F2; border-radius:9999px; padding:.375rem 1rem`) **「買取価格表」**, then an H2 (line reveal, delay 120): `font-size:2.25rem; font-weight:900; letter-spacing:-.01em` (sm 3rem) → **「本日の強化買取」**.
  - Right: `.num` **「更新日 2026/10/19」** (`font-size:.75rem; color:#2C74C4; font-weight:500`).
- **Shop grid** `display:grid; grid-template-columns:12.5rem 1fr; gap:1.75rem; align-items:start` (below lg: one column, with the sidebar moved below the products via `order:2`).
- **Sidebar** (`position:sticky; top:5.5rem` at lg):
  - A heading `font-size:.9375rem; font-weight:700; padding-bottom:.5rem; border-bottom:2px solid #3E8EE0; margin-bottom:.75rem` → **「カテゴリー」**.
  - A `<details>` accordion per category (`background:#EAF2FB; border-radius:.5rem`). Each `summary` (`padding:.625rem .875rem; font-weight:700; font-size:.8125rem`) has a chevron that rotates 45°→-135° when open (.25s). The content height animates open with `grid-template-rows: 0fr → 1fr` (.35s `cubic-bezier(.22,1,.36,1)`). Sub-items are buttons (`font-size:.8125rem; color:#6B7890; padding:.3125rem .5rem; border-radius:.375rem`, hover `background:#fff; color:#3E8EE0`); clicking one sets the tab and search query.
    - スマホ (`phone`): iPhone, Pixel, Galaxy, Xperia, AQUOS, iPad
    - 家電 (`kaden`): Switch, プレイステーション, Xbox, Meta Quest, SONY
    - おもちゃ (`toy`): ポケモンカード, ONE PIECE, 遊戯王, ベイブレード
    - お酒 (`sake`): 山崎, 響, 白州, マッカラン, 余市, 厚岸
  - A note **「価格は日々変動します。」** (`font-size:.75rem; color:#6B7890; margin:.75rem 0 1.5rem`).
  - Heading **「SNS公式アカウント」** (same style), then two link cards (`display:flex; gap:.625rem; background:#fff; border:1px solid #E1E8F2; border-radius:.625rem; padding:.625rem .75rem; font-weight:700; font-size:.8125rem`; hover-spring `translateX(0→3px)`), each with a `1.625rem` rounded-square badge: **「LINE 友だち追加」** (badge `#06C755`, text "LINE", 900, .6875rem) and **「フォロー募集中」** (badge `#111`, text "X").
- **Main column** (`min-width:0`):
  - **Tabs** (`display:flex; flex-wrap:wrap; gap:.5rem; background:#fff; border-radius:.75rem; padding:.5rem; box-shadow:0 0 0 1px #E1E8F2`, `role=tablist`): 4 pill buttons (`border:1.5px solid #3E8EE0; color:#2C74C4; font-weight:700; border-radius:9999px; padding:.5rem 1rem; font-size:.8125rem`). The selected tab is filled `#3E8EE0`, white text. A **sliding indicator**: a single absolutely-positioned `#3E8EE0` pill behind the tabs animates its `left/width` to the selected tab (`{300,28}`), while tab text colour crossfades. Labels: **スマホ強化**, **家電製品強化**, **おもちゃ強化**, **お酒強化**.
  - **Toolbar** `display:flex; justify-content:flex-end; align-items:center; gap:.75rem; margin:.875rem 0`. It holds a **filter message** when searching or showing favourites (`「"<q>"の検索結果 N件」` or `「お気に入り N件」` plus a `解除` chip that clears the filter), and a **view toggle** (`background:#EAF2FB; border-radius:.5rem; padding:.1875rem`) with List and Grid icon buttons (`2rem×1.75rem`; pressed = `background:#3E8EE0; color:#fff`).
  - **Grid** `display:grid; grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr)); gap:1rem` (below 440px: `1fr 1fr; gap:.625rem`).
  - **Re-render animation:** when the tab, filter or page changes, outgoing cards fade `opacity→0, translateY(-6px)` (150ms). New cards then enter with stagger `index*40ms`: `opacity 0→1, translateY(14px)→0, scale(.98)→1`, `{200,24}`.
  - **Product card** (`background:#fff; border:1px solid #E1E8F2; border-radius:.75rem; padding:.75rem; display:flex; flex-direction:column; gap:.5rem; position:relative`). Hover-spring on the whole card: `translateY(0→-4px)`, `box-shadow` → `0 14px 28px -18px rgba(30,80,150,.5)`, `{260,22}`; the image svg inside goes `scale(1→1.06)` and the share icon goes `rotate(0→-12deg)`. The card contains:
    - **「強化」** badge (`position:absolute; top:.75rem; left:.75rem; z-index:1; background:#3E8EE0; color:#fff; font-size:.6875rem; font-weight:700; border-radius:.375rem; padding:.0625rem .5rem`).
    - **Favourite** button (`top:.625rem; right:.625rem`, outline Heart `#B8C3D3`; pressed = filled `#F0607A`). Toggling plays a **pop** (`scale 1→1.35→1`, `{320,12}`) plus 6 tiny particle dots (`.25rem`, `#F0607A`) that burst radially 14px and fade (400ms). Favourites persist in `localStorage['uridoki-favs']`; wrap reads and writes in try/catch.
    - **Image** area (`margin:-.75rem -.75rem 0; border-bottom:1px solid #E1E8F2; border-radius:.75rem .75rem 0 0; aspect-ratio:16/10; display:grid; place-items:center; overflow:hidden; position:relative`) with the ART svg (`height:84%; max-width:90%`) and a Share icon (`position:absolute; right:.625rem; bottom:.5rem; color:#3E8EE0`).
    - **Name** `h3` (`font-size:.8125rem; font-weight:700; line-height:1.5; min-height:4.5em; -webkit-line-clamp:3`).
    - **JAN** line (`font-size:.6875rem; color:#6B7890`): `JAN: <jan>`.
    - **Memo** line (`font-size:.6875rem; color:#6B7890; min-height:1.6em`), where `<em>` parts are `#E0475F` and not italic.
    - **Condition radios** (`display:flex; flex-direction:column; gap:.375rem`): one row per available condition (`新品` new / `中古` used), as a `label.cond` (`display:flex; align-items:center; gap:.5rem; border:1px solid #E1E8F2; border-radius:.5rem; padding:.4375rem .625rem; cursor:pointer; transition:border-color .2s, background .2s`) containing a radio (`accent-color:#3E8EE0`, stable id `c<id><cond>`), the label (`font-size:.75rem`) and the price (`margin-left:auto; .num; font-weight:700; color:#E0475F; font-size:.9375rem`). Checked = `border-color:#3E8EE0; background:#F2F8FE`. **Selecting a condition** pulses the chosen price (`scale 1→1.12→1`, `{320,16}`).
    - **Buy row** (`display:flex; gap:.5rem; flex-wrap:wrap`):
      - a quantity stepper (`border:1px solid #E1E8F2; border-radius:.5rem; background:#EAF2FB`) with `−` / `＋` buttons (`1.875rem×2.125rem; color:#2C74C4`) and a white `.num` value cell. The number **flips** on change (`translateY(±60%)` out, then in, 160ms). Range 1–99.
      - the **add** button (`flex:1 1 5.5rem; min-height:2.25rem; border-radius:.5rem; background:#3E8EE0; color:#fff; font-weight:700; font-size:.75rem`). Disabled until a condition is picked: `background:#CCD7E5; font-size:.6875rem` with label **「先に商品状態を<br>選択してください」**. Enabled label: **「買取申込」**.
      - **Add → fly-to-cart:** clone the card's svg into a fixed `3rem` element at the image's position and animate it along a curved path to the header cart button (600ms; x linear, y easeInQuad with a −80px arc; `scale 1→.35`, opacity `1→.6`). On arrival, bump the cart badge, show the toast **「査定カートに追加しました」** and add the line to the cart (merge same id + condition).
  - **List view:** `.grid.list` = one column. Each card becomes `display:grid; grid-template-columns:8.75rem 1fr 14.5rem; gap:.25rem 1rem; align-items:center`. The image (`aspect-ratio:1; border:0; margin:0; border-radius:.5rem`) spans 4 rows, conditions sit in column 3 rows 1–2, and the buy row in column 3. Below md: `6.25rem 1fr`, with conditions and buy row spanning full width.
  - **Pager** (`display:flex; justify-content:center; gap:.375rem; margin-top:1.5rem; flex-wrap:wrap`): **「‹ 前へ」**, page numbers and **「次へ ›」** (`min-width:2.25rem; height:2.25rem; border-radius:.5rem; border:1px solid #E1E8F2; background:#fff; font-weight:700; font-size:.8125rem`; current = `#3E8EE0` filled; disabled `opacity:.4`). 9 cards per page. Changing page re-renders and `lenis.scrollTo('#prices', {offset:-72})`.
  - Caption under the pager: **「強化買取のおすすめ順」** (`text-align:center; font-size:.75rem; color:#6B7890`).
  - **Empty states:**
    - Search with no results: 「「<q>」に一致する商品が見つかりません。型番やJANコードでもお試しください。」
    - Favourites empty: 「お気に入りはまだありません。商品カードの ♡ を押すと追加されます。」

**Product data (samples — bake in):**

```js
const TABS=[{id:"phone",label:"スマホ強化"},{id:"kaden",label:"家電製品強化"},{id:"toy",label:"おもちゃ強化"},{id:"sake",label:"お酒強化"}];
const P=[
 {id:1,t:"phone",n:"iPhone17 Pro Max 256GB SIMフリー コズミックオレンジ",jan:"—",memo:"未開封・全色同額",a:["phone","#E9925A","#B8642F"],new:198000,used:166000},
 {id:2,t:"phone",n:"iPhone17 Pro 256GB SIMフリー ディープブルー",jan:"—",memo:"未開封・全色同額",a:["phone","#5B7090","#38495F"],new:172000,used:141000},
 {id:3,t:"phone",n:"iPhone Air 256GB SIMフリー スカイブルー",jan:"—",memo:"",a:["phone","#BFD9EE","#8FB4D4"],new:128000,used:101000},
 {id:4,t:"phone",n:"iPhone17 256GB SIMフリー ラベンダー",jan:"—",memo:"",a:["phone","#C9B8E6","#9C88C4"],new:112000,used:92000},
 {id:5,t:"phone",n:"iPhone16 Pro 128GB SIMフリー デザートチタニウム",jan:"—",memo:"",a:["phone","#D3BFA6","#A68D70"],new:118000,used:96000},
 {id:6,t:"phone",n:"Google Pixel 11 Pro 128GB SIMフリー",jan:"—",memo:"",a:["android","#9DC0EE","#5E86C9"],new:105000,used:82000},
 {id:7,t:"phone",n:"Galaxy Z Fold8 256GB SIMフリー 国内版",jan:"—",memo:"",a:["android","#4A5466","#2D3442"],new:168000,used:131000},
 {id:8,t:"phone",n:"iPad Air8 (M4) Cellular 128GB 2026年モデル",jan:"—",memo:"SIMロック解除済みのみ",a:["tablet"],new:98000,used:80000},
 {id:9,t:"phone",n:"Xperia 1 VIII 256GB SIMフリー",jan:"—",memo:"",a:["android","#2F3542","#1C2029"],new:96000,used:74000},
 {id:10,t:"phone",n:"AQUOS sense10 128GB SIMフリー",jan:"—",memo:"",a:["android","#E7E2D8","#BDB5A6"],new:31000,used:22000},
 {id:11,t:"kaden",n:"Nintendo Switch 2 日本語・国内専用",jan:"4902370553024",memo:"印有減額なし <em>*来店+200円</em>",a:["console","#E8414E","#2F9BE0","#E8414E"],new:51800},
 {id:12,t:"kaden",n:"Nintendo Switch 2 マリオカート ワールドセット 日本語・国内専用",jan:"4902370553031",memo:"印有減額なし <em>*来店+200円</em>",a:["console","#E8414E","#2F9BE0","#D9342F"],new:58300},
 {id:13,t:"kaden",n:"Nintendo Switch 2 Pokémon LEGENDS Z-A セット",jan:"4902370553505",memo:"印有減額なし <em>*来店+200円</em>",a:["console","#E8414E","#2F9BE0","#3C9C5C"],new:55800},
 {id:14,t:"kaden",n:"Nintendo Switch 有機ELモデル ホワイト",jan:"4902370548495",memo:"印有減額なし <em>*来店+200円</em>",a:["console","#F4F5F7","#F4F5F7","#E8414E"],new:44200},
 {id:15,t:"kaden",n:"Nintendo Switch Lite ターコイズ",jan:"4902370542943",memo:"印有減額なし <em>*来店+100円</em>",a:["handheld","#3FC1C9"],new:25500},
 {id:16,t:"kaden",n:"プレイステーション5 デジタル・エディション CFI-2200B01",jan:"4948872417419",memo:"印有減額なし <em>*来店+300円</em>",a:["ps"],new:51000},
 {id:17,t:"kaden",n:"マリオカート ワールド / Switch 2",jan:"4902370553260",memo:"※再シュリンク買取不可",a:["game","#E8414E","#4FA3F7"],new:7700,used:5500},
 {id:18,t:"kaden",n:"ゼルダの伝説 ティアーズ オブ ザ キングダム Switch 2 Edition",jan:"4902370553321",memo:"※再シュリンク買取不可",a:["game","#E8414E","#5BAF8C"],new:7000,used:4800},
 {id:19,t:"kaden",n:"SONY WF-1000XM6 BZ［ブラック］",jan:"4548736171763",memo:"",a:["earbuds","#1E222A"],new:34600},
 {id:20,t:"kaden",n:"Meta Quest 3 512GB",jan:"815820024170",memo:"<em>*来店+200円</em>",a:["vr"],new:91000},
 {id:21,t:"kaden",n:"Xbox Series X 1TB デジタル モデル",jan:"4549576247038",memo:"印有減額なし <em>*来店+200円</em>",a:["xbox","#22262E"],new:110100},
 {id:22,t:"kaden",n:"Xbox Series S 1TB",jan:"4549576246994",memo:"印有減額なし <em>*来店+200円</em>",a:["xbox","#2B2F37"],new:88800},
 {id:31,t:"toy",n:"ポケモンカードゲーム 拡張パック 1BOX（シュリンク付）",jan:"—",memo:"※開封品は買取不可",a:["cardbox","#F6C343","#E85A4F","#3E8EE0"],new:8500},
 {id:32,t:"toy",n:"ONE PIECEカードゲーム ブースターパック 1BOX",jan:"—",memo:"※テープ付き未開封のみ",a:["cardbox","#E85A4F","#2B3A67","#F6C343"],new:9200},
 {id:33,t:"toy",n:"遊戯王OCG デュエルモンスターズ 1BOX",jan:"—",memo:"",a:["cardbox","#6A4FB3","#2B2F37","#F6C343"],new:6800},
 {id:34,t:"toy",n:"ドラゴンボール フュージョンワールド 1BOX",jan:"—",memo:"",a:["cardbox","#F39A2E","#2F7FD0","#E8414E"],new:5600},
 {id:35,t:"toy",n:"UNION ARENA ブースターパック 1BOX",jan:"—",memo:"",a:["cardbox","#3EC1A6","#24356A","#F0607A"],new:4800},
 {id:36,t:"toy",n:"ベイブレードX スターター",jan:"—",memo:"",a:["top"],new:2400,used:1200},
 {id:41,t:"sake",n:"サントリー 山崎 12年 700ml 箱付",jan:"—",memo:"※箱なしは-1,000円",a:["bottle","#B8742A","#F4EBDD","#1F1F1F","#B3282D"],new:22000},
 {id:42,t:"sake",n:"サントリー 響 21年 700ml 箱付",jan:"—",memo:"",a:["bottle","#A85B1C","#E8D9B8","#3A2A1A","#2B2B2B"],new:68000},
 {id:43,t:"sake",n:"サントリー 白州 12年 700ml 箱付",jan:"—",memo:"",a:["bottle","#C9A24A","#F2F0E6","#2E5D3A","#2E5D3A"],new:19000},
 {id:44,t:"sake",n:"ザ・マッカラン 18年 シェリーオーク 700ml",jan:"—",memo:"",a:["bottle","#8E4A1B","#F4EBDD","#5A1E1E","#5A1E1E"],new:55000},
 {id:45,t:"sake",n:"ニッカ 余市 シングルモルト 700ml",jan:"—",memo:"",a:["bottle","#B07A34","#F1E6CF","#1F3A5F"],new:6500},
 {id:46,t:"sake",n:"厚岸 ブレンデッドウイスキー 二十四節気",jan:"—",memo:"",a:["bottle","#C08A3E","#EDE6DA","#2D3B4E","#2D3B4E"],new:14000},
 {id:47,t:"sake",n:"サントリー 知多 700ml",jan:"—",memo:"",a:["bottle","#D9B36A","#F7F5F0","#7A8FA6"],new:4200}
];
```

Search matches `name + " " + jan`, case-insensitively, across all tabs. Favourites mode shows every favourited product.

---

### 7) Methods (`#flow`) — 買取の流れ, hover-fill rows

`section#flow` `background:#fff; border-radius:2rem; margin-inline:auto; max-width:calc(75rem + 2.5rem)`. Inner `.shell` `padding-block:4rem` (lg 5.5rem).

- Eyebrow **「買取の流れ」**, then an H2 (line reveal, delay 120): `margin:1.25rem 0 2.5rem; max-width:16ch; font-size:2.25rem; font-weight:900` (sm 3rem) → **「売り方は、4つから。」**
- **Rows** `ul`. Each `li` reveals with y 24, `{200,24}`, delay `index*80`, and has `border-top:1px solid #E1E8F2` (none on the first). Each row is a `button[aria-expanded]`: a hover-spring row from `{background:rgba(242,248,254,0); padding-inline:1.5rem}` to `{background:rgba(242,248,254,1); padding-left:2rem; padding-right:1.25rem}`, `{240,26}`. Base: `width:100%; display:flex; align-items:center; gap:1rem; border-radius:1.25rem; padding-block:1.5rem; text-align:left` (sm `gap:1.5rem; padding-block:1.75rem`). Cells:
  - index `.num` (`width:2.5rem; font-size:.875rem; font-weight:700; color:#A9B6C8`)
  - `h3` (`flex:1; font-size:1.5rem; font-weight:700`, sm 1.875rem)
  - description (hidden below lg; `max-width:20rem; font-size:.8125rem; color:#6B7890`)
  - a trailing badge (`2.75rem` circle, `background:#16233A; color:#fff`) with ArrowUpRight. Row hover → badge `translateX(0→5px)`, `{300,18}`. Expanded → badge `rotate(90deg)` and `background:#3E8EE0`.
  - **Click expands** a steps panel under the row (one open at a time, height via `grid-template-rows:0fr→1fr`, .45s `cubic-bezier(.22,1,.36,1)`). The panel is a horizontal timeline (`display:grid; grid-template-columns:repeat(auto-fit,minmax(10rem,1fr)); gap:1rem; padding:0 1.5rem 1.75rem 4.5rem`; below sm, left padding 1.5rem). Each step: a `2rem` `#3E8EE0` `.num` number circle, a bold title (`.875rem`) and a muted line (`.75rem`). A `2px #E6F1FC` connector line runs behind the circles. Steps stagger in (`translateY(10px)`, `index*60ms`) when the panel opens. Under the steps, a note box (`background:#F2F8FE; border-radius:.5rem; padding:.625rem .75rem; font-size:.75rem; color:#6B7890`).
  - **01 店頭買取** — 「予約不要。その場で現金払い。」
    - Steps: ご来店「商品と本人確認書類をお持ちください。」 / 査定「専門スタッフが当日の相場で金額を出します。」 / 本人確認「買取申込書のご記入と身分証の確認。」 / 現金でお支払い「ご納得いただければ、その場でお渡し。」
    - Note: 「来店+」表示の商品は店頭持ち込みでさらに上乗せ。
  - **02 郵送買取** — 「着払いで送るだけ。全国対応。」
    - Steps: 会員登録・eKYC「スマホで身分証撮影と顔認証。」 / 買取予約「商品と数量を選んで申込み。」 / 承認日当日に発送「着払いで依頼書と一緒に発送。」 / 検品・査定「相違がある場合のみご連絡。」 / お振込み「承認翌日から3営業日以内。」
    - Note: 予約承認 10:20〜18:30（月〜土）。承認日以外の発送は価格保証の対象外。
  - **03 法人買取** — 「在庫・社用端末をまとめてお見積り。」
    - Steps: お問い合わせ「品目と数量をメールで。」 / お見積り「最短当日にご提示。」 / 引取り・発送「都内は引取り可能。」 / 検品・ご精算「検品後にお振込み。」
    - Note: 登記事項証明書とご担当者様の身分証が必要です。
  - **04 eKYC本人確認** — 「書類撮影＋顔認証で最短即日。」
    - Steps: 書類を選ぶ「運転免許証・マイナンバーカードなど。」 / 撮影「表裏と厚みを撮影。」 / 顔認証「画面の指示に沿って自撮り。」 / 完了「最短即日で承認メール。」
    - Note: 顔写真付きの本人確認書類が必要です。
  - Campaign slides 1 and 4 open rows 02 and 03 respectively (scroll there, then expand).

---

### 8) Reasons (選ばれる理由)

`section` `padding-block:5rem` (lg 6rem). `.shell`. A centred heading block: an `.75rem; letter-spacing:.18em; font-weight:700; color:#3E8EE0` kicker **WHY CHOOSE URIDOKI**, then an H2 (char reveal) `font-size:1.875rem; font-weight:900` → **「選ばれる理由」**.

Grid `margin-top:2.5rem; display:grid; grid-template-columns:repeat(3,1fr); gap:1.125rem` (below lg 2 columns, below sm 1). Each card reveals with y 24 and delay `index*70`: `background:#fff; border:1px solid #E1E8F2; border-radius:1.25rem; padding:1.5rem; display:flex; gap:.875rem; align-items:flex-start`.
- Icon: a `2.875rem` circle, `background:#E6F1FC; color:#3E8EE0`, holding a stroke-2 icon from the paths below.
- `h3`: `font-size:.9375rem; font-weight:700; color:#2C74C4`.
- `p`: `font-size:.8125rem; color:#6B7890`.
- Hover-spring: card `translateY(0→-4px)`; the icon circle background fills to `#3E8EE0` and the icon turns white, `{280,22}`.

1. 「日本全国トップクラスの高額買取」 — 「国内・海外の販売ルートを持っているので、いつでも高い買取金額を出せます。」 — `M3 17l6-6 4 4 8-8M15 7h6v6`
2. 「高額でも全て現金でお支払い」 — 「店頭では査定後すぐ、その場で現金をお渡しします。」 — `M3 7h18v10H3zM12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0`
3. 「大量の商品でも買取可能」 — 「個人のお客様も法人のお客様も歓迎。在庫の新品家電もお売りください。」 — `M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4`
4. 「売らなくても査定は無料」 — 「1点からしっかり査定します。まずはお気軽にご来店ください。」 — `M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18`
5. 「専門スタッフのスピード査定」 — 「ジャンルごとの担当者が、相場に合わせてすぐに金額を出します。」 — `M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18`
6. 「全国どこからでも買取可能」 — 「近くに店舗がなくても、宅配で東京と同じ価格で買い取ります。」 — `M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8`

---

### 9) Stats (navy panel, scroll count-up)

`section` `.shell` `padding-bottom:5rem` (lg 6rem). A reveal panel (y 40, `scale(.99→1)`, `{180,26}`): `position:relative; overflow:hidden; border-radius:2rem; background:#16233A; padding:3rem 1.5rem; color:#fff` (sm `4rem 2rem`, md `padding-inline:4rem`). Decor: a large faint LogoMark (`font-size:22rem; color:rgba(106,178,242,.06); position:absolute; right:-4rem; bottom:-6rem`) that slowly rotates with scroll (`rotate = progress*20deg`).

- Eyebrow (light tone) **「数字で見る売り時」**.
- H2 (line reveal, delay 120): `margin-top:1rem; max-width:20ch; font-size:1.875rem; font-weight:700` (md 2.25rem) → **「実績が、査定額の根拠です。」**
- Grid `margin-top:3.5rem; display:grid; grid-template-columns:repeat(2,1fr); column-gap:2rem; row-gap:3rem` (lg 4 columns). Each stat `li` reveals with y 20 and delay `index*90`. The number is `.num; font-size:2.5rem; font-weight:700; letter-spacing:-.02em` (sm 3.25rem, md 4rem) in `#fff`, its suffix in `#6AB2F2`, then a label `margin-top:.75rem; font-size:.8125rem; color:rgba(255,255,255,.55)`.
  - **Count-up** is driven by scroll progress from `start:"top bottom"` to `end:"center center"`: display `round(progress*value).toLocaleString('ja-JP')`, throttled to ~30ms.
  - Stats (samples):
    - **1,200,000** + 「+点」 — 「累計買取点数」
    - **98** + 「%」 — 「お客様満足度」
    - **5** + 「分〜」 — 「最短査定時間」
    - **47** + 「都道府県」 — 「郵送買取の対応エリア」
- Footnote `margin-top:2rem; font-size:.6875rem; color:rgba(255,255,255,.35)`: **「※数値はデモ用のサンプルです。」**

---

### 10) FAQ (`#faq`)

`section#faq` `.shell` `padding-bottom:5rem`. A two-column layout at lg (`grid-template-columns:20rem 1fr; gap:3rem`):
- **Left (sticky at lg):** Eyebrow **「FAQ」**; an H2 (char reveal) `font-size:2.25rem; font-weight:900` **「よくあるご質問」**; a muted line 「掲載外のご質問はお気軽にお問い合わせください。」; and an `outline` PillButton **「お問い合わせ」** (withArrow, opens the modal).
- **Right:** an accordion list. Each item reveals with y 16 and delay `index*50`: a `div` with `border-bottom:1px solid #E1E8F2`, a question button (`width:100%; display:flex; gap:.75rem; align-items:baseline; padding-block:1.125rem; text-align:left; font-weight:700; font-size:.9375rem`, with a leading `Q` in `#3E8EE0`, 900, 1.125rem, and a trailing `＋` that rotates 45° to become `×` when open, .3s), and an answer panel (height via `grid-template-rows:0fr→1fr`, .4s; inner `padding:0 0 1.125rem 1.75rem; font-size:.875rem; color:#6B7890`, with a leading `A` in `#E0475F`). The first item starts open.
  1. 買取の際に必要な物は何ですか？ — お売りいただく商品と、顔写真付きの本人確認書類をお持ちください。郵送買取はeKYCでの本人確認が必要です。
  2. 使える本人確認書類は？ — 運転免許証、マイナンバーカード、パスポート、在留カードなど、現住所が確認できる顔写真付きの書類です。
  3. 店頭買取は予約が必要ですか？ — 予約は不要です。大量の場合は事前にご連絡いただくと査定がスムーズです。
  4. 査定金額はいつまで有効ですか？ — 店頭は査定当日限りです。郵送は予約承認日の当日に発送された商品が価格保証の対象です。
  5. 郵送の送料はかかりますか？ — キャンペーン期間中は、ヤマト運輸・佐川急便の着払いで送料・査定料ともに無料です。
  6. 代金はいつ振り込まれますか？ — 査定承認の翌日から3営業日以内（土日祝を除く）にお振込みします。
  7. 一覧に無い商品も買い取れますか？ — はい。商品名と状態をお問い合わせいただければ、個別にお見積りします。

---

### 11) Stores (`#stores`) + model price links

`section#stores` `.shell` `padding-bottom:5rem`. Eyebrow **「店舗一覧」**, then an H2 (char reveal) **「お近くの店舗へ」** (`font-size:2.25rem; font-weight:900`), then a muted note **「住所・電話番号はデモ用のサンプルです。」**

- **Store cards** `margin-top:2rem; display:grid; grid-template-columns:repeat(4,1fr); gap:1rem` (below lg 2 columns, below sm 1). Each reveals with y 24 and delay `index*80`: `background:#fff; border:1px solid #E1E8F2; border-radius:1.25rem; padding:1.25rem; font-size:.8125rem`. It contains:
  - a top row with the name `h3` (`font-size:1rem; font-weight:700; color:#2C74C4`) and an **open-status chip** computed from the live clock: open 10:30–19:30 → **「営業中」** (`background:#E8F7EE; color:#18A058`), otherwise **「営業時間外」** (`background:#F1F3F7; color:#6B7890`)
  - the address `p` (`color:#6B7890`)
  - `TEL：<tel>` (`.num`, bold; with a copy button 「コピー」 that writes to the clipboard and shows the toast 「電話番号をコピーしました」; on rejection select the text instead)
  - 「営業時間 10:30〜19:30」
  - Hover: `translateY(0→-3px)` and `border-color:#3E8EE0`.
  - Stores:
    - 渋谷店 — 〒150-0000 東京都渋谷区〇〇 1-2-3 サンプルビル1階 — 03-0000-0101
    - 上野店 — 〒110-0000 東京都台東区〇〇 4-5-6 サンプルビル1階 — 03-0000-0102
    - 中野店 — 〒164-0000 東京都中野区〇〇 7-8-9 サンプルビル2階 — 03-0000-0103
    - 郵送センター — 〒330-0000 埼玉県〇〇市〇〇 1-1-1 — 048-000-0104
- **Model price links box** (reveal y 24): `margin-top:2.5rem; background:#fff; border:1px solid #E1E8F2; border-radius:1.25rem; padding:1.5rem`. Contents: a heading **「買取価格表（機種別）」** (`1.125rem`, 700); tab pills (same style as the price-list tabs, with the sliding indicator) for **スマホ / 家電 / お酒 / iPad**; and a `ul` grid `repeat(auto-fill,minmax(11rem,1fr)); gap:.375rem 1rem` of links (`display:flex; justify-content:space-between; padding:.5rem .25rem; border-bottom:1px dashed #E1E8F2; font-size:.8125rem`, with a trailing `›` in `#3E8EE0` that shifts `translateX(3px)` on hover). Clicking a link searches the price list for that model name. Switching tabs crossfades the list (opacity + `translateY(6px)`, 200ms).
  - スマホ: Galaxy A25 5G, Xperia 1 VIII, OPPO Reno13 A, AQUOS sense10, Galaxy Z Fold8, Google Pixel 11 Pro, Google Pixel 10a, iPhone17 Pro Max
  - 家電: Nintendo Switch 2, PlayStation 5, Xbox Series X, Meta Quest 3, SONY WF-1000XM6, Steam Deck
  - お酒: 山崎, 響, 白州, マッカラン, 余市, 厚岸, 知多
  - iPad: iPad Air8 (M4), iPad Pro 2025, iPad mini7, iPad 11th

---

### 12) Footer (navy: CTA + columns + watermark)

`footer` `position:relative; overflow:hidden; border-radius:2rem 2rem 0 0; background:#16233A; color:#fff`. Inner `.shell` `position:relative; z-index:10; padding-block:5rem 2.5rem` (lg pt 6rem).

- **CTA row** `display:flex; flex-direction:column; gap:2rem; border-bottom:1px solid rgba(255,255,255,.1); padding-bottom:4rem` (lg: row, `align-items:flex-end; justify-content:space-between`):
  - H2 (line reveal, stagger 100): `max-width:16ch; font-size:2.25rem; font-weight:900; line-height:1.2` (sm 3rem, md 3.5rem). Lines: **「売るなら、いま。」** / **「まずは<span>無料査定</span>から。」**, where the span is `color:#6AB2F2`.
  - Buttons: PillButton **「無料で査定する」** (variant `light`, withArrow up-right → modal) and PillButton **「LINEで相談」** (variant `line`: `background:#06C755; color:#fff`, no arrow; decorative, shows the toast 「デモのためLINE連携はありません」).
- **Columns** `display:grid; grid-template-columns:1fr; gap:3rem; padding-block:4rem` (md 2 columns, lg 4):
  - **Brand column:** **売り時** (`1.5rem; 900; color:#6AB2F2`) with `uridoki` under it, then a tagline `max-width:20rem; font-size:.8125rem; color:rgba(255,255,255,.55)`: 「スマホ・ゲーム・カメラ・トレカ・ウイスキーを、東京相場で高価買取。」
  - **「買取について」:** 買取価格表 (#prices), 買取の流れ (#flow), よくあるご質問 (#faq), 店舗一覧 (#stores)
  - **「カテゴリー」:** スマホ, 家電・ゲーム, おもちゃ・トレカ, お酒 (each sets the tab and scrolls to #prices)
  - **「公式SNS」:** LINE, X（旧Twitter）, Instagram, YouTube
  - Column titles: `font-size:.75rem; letter-spacing:.08em; color:rgba(255,255,255,.4); font-weight:700`. Links: `font-size:.875rem`, each an **AnimatedLink** (`translateX 0→4px, opacity .65→1`, `{320,22}`).
- **Legal bar** `display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:1rem; border-top:1px solid rgba(255,255,255,.1); padding-top:2rem; font-size:.75rem; color:rgba(255,255,255,.45)` (sm row):
  - Left: **「© 2026 URIDOKI. このサイトはデモです。価格・店舗情報はすべてサンプルです。」**
  - Right: AnimatedLinks (`translateX 0→3px, opacity .7→1`): 買取時のご注意事項, 買取利用規約, プライバシーポリシー
- **Watermark:** `position:absolute; inset-inline:0; bottom:-1.5rem; z-index:0; text-align:center; pointer-events:none; user-select:none; font-weight:900; line-height:1; font-size:13rem; color:rgba(106,178,242,.07)` → **URIDOKI**. It parallaxes slightly (`translateY` from 30px to 0 as the footer scrolls into view).

---

### 13) NavMenu (full-screen navy overlay)

Created when first opened. `position:fixed; inset:0; z-index:115; display:flex; flex-direction:column; background:#16233A; color:#fff`. Open/close: `opacity 0↔1` plus `clip-path: circle(0% at <menu button center>) → circle(150% at …)`, `{280,32}` (≈ .6s `cubic-bezier(.22,1,.36,1)`). On open: `stopScroll()`, focus the Close button, trap Tab inside, Escape closes. On close: `startScroll()` and return focus to the Menu button.

- **Top bar** `.shell` `display:flex; align-items:center; justify-content:space-between; padding-block:1.25rem` (sm 1.5rem): left `[LogoMark 1.25rem #6AB2F2] 売り時` (`1.25rem; 900`); right a **Close** button (`display:inline-flex; gap:.5rem; border:1px solid rgba(255,255,255,.15); border-radius:.75rem; padding:.5rem 1rem; font-size:.75rem; font-weight:700; letter-spacing:.08em; color:rgba(255,255,255,.7)`; hover `border-color:rgba(255,255,255,.4); color:#fff`) → `[X .875rem] 閉じる`.
- **Nav** `.shell` `flex:1; display:flex; flex-direction:column; justify-content:center`. `ul{gap:.25rem}`. Each item is a full-width button (`display:flex; align-items:baseline; gap:1rem; padding-block:.5rem; text-align:left; font-size:2.25rem; font-weight:900; letter-spacing:-.01em`, sm 3.5rem) that staggers in: `transition:all .5s ease-out; transition-delay:<index*45+80>ms`, from `translateY(1rem); opacity:0` to `translateY(0); opacity:1`. It shows a `.num` index `0n` (`font-size:1rem; font-weight:500; color:rgba(255,255,255,.3)`; group-hover `#6AB2F2`) and the label (`color:rgba(255,255,255,.75)`; group-hover `#fff`, with a `#6AB2F2` underline that grows `scaleX(0→1)` from the left, .3s).
  - Items: **買取価格** (#prices), **買取の流れ** (#flow), **よくあるご質問** (#faq), **店舗一覧** (#stores), **査定カート** (opens the cart), **お問い合わせ** (opens the modal). Any click closes the menu first, then routes after 250ms.
- **Bottom bar** `.shell` `display:flex; flex-direction:column; gap:.75rem; border-top:1px solid rgba(255,255,255,.1); padding-block:1.5rem; font-size:.75rem; letter-spacing:.04em; color:rgba(255,255,255,.45)` (sm row, justify-between):
  - left: **「本日の相場 — <live time>」**
  - right: a button **「無料で査定する →」** (`color:rgba(255,255,255,.75)`; hover underline, `#fff`) that closes the menu and opens the modal.

---

### 14) CartDrawer (査定カート)

`.scrim` (`position:fixed; inset:0; z-index:105; background:rgba(22,35,58,.35); backdrop-filter:blur(4px)`; opacity transition .3s) plus `aside.drawer` (`position:fixed; top:0; right:0; bottom:0; width:min(26rem,100%); z-index:106; background:#fff; display:flex; flex-direction:column; box-shadow:-10px 0 30px -10px rgba(22,35,58,.3)`). It slides `translateX(100%) → 0`, `{260,30}`, and pads by the safe-area insets. Open → `stopScroll()`; close (scrim click, × button, Escape) → `startScroll()`.

- **Header:** `padding:1rem 1.25rem; border-bottom:1px solid #E1E8F2` with **「査定カート」** (`1.125rem`, 700) and a × button.
- **Lines** (`flex:1; overflow-y:auto; overflow-x:hidden; padding:.25rem 1.25rem`). Each line is a grid `3.25rem 1fr auto` containing:
  - a thumb (`3.25rem` square, `border:1px solid #E1E8F2; border-radius:.5rem`) with the ART svg
  - the name (500)
  - the amount (`.num; 700; #E0475F`)
  - a sub line `新品/中古 · ¥unit × qty` (`.75rem; #6B7890`)
  - a **「削除」** text button
  - New lines slide in from `translateX(16px)`. Deleted lines collapse their height and fade (.25s) before removal.
- **Empty state:** 「まだ商品がありません。商品状態を選んで「買取申込」を押してください。」
- **Summary** (`padding:1rem 1.25rem; border-top:1px solid #E1E8F2; background:#F2F8FE; display:flex; flex-direction:column; gap:.625rem`):
  - **「買取予定合計」** with the total (`.num; 1.5rem; 700; #E0475F`), which **counts** from the old total to the new one over 400ms
  - a full-width pill **「買取を申し込む」** (`background:#3E8EE0; color:#fff; height:2.875rem`; disabled `#CCD7E5` when empty) that closes the drawer and opens the AppraisalModal, pre-filling the product field with the cart contents
  - a note 「「来店+」表示の金額は店頭へのお持ち込み時のみ加算されます。」

---

### 15) AppraisalModal (stubbed submit)

Opened by every 「無料で査定する / お問い合わせ / 買取を申し込む」 CTA. Backdrop: `position:fixed; inset:0; z-index:110; display:flex; align-items:flex-end; justify-content:center; padding:1rem; background:rgba(22,35,58,.3); backdrop-filter:blur(16px)` (sm `align-items:center`), with `role=dialog aria-modal=true aria-labelledby`. Clicking the backdrop or pressing Escape closes it. Open → `stopScroll()`, focus the first field, trap focus. Close → `startScroll()`. Enter/exit: panel `opacity 0↔1`, `translateY(28px → 0 → 18px)`, `{260,30}`.

Panel: `position:relative; width:100%; max-width:32rem; max-height:calc(100dvh - 2rem); overflow:auto; border-radius:2rem; background:#fff; padding:1.5rem; box-shadow:0 30px 60px -20px rgba(22,35,58,.35), 0 0 0 1px #E1E8F2` (sm padding 2rem). Clicks inside call `stopPropagation`. A Close button in the top-right corner (`2.25rem` circle, `background:#EAF2FB; color:#6B7890`; hover `background:#E6F1FC; color:#1E2A3B`) uses the X icon.

**Form state:**
- **Heading:** an `inline-flex; gap:.5rem; font-size:.8125rem; font-weight:700; color:#6B7890` row with a `.375rem` `#3E8EE0` dot and **「無料査定」**; then `h2` (`1.5rem; 900`, sm 1.875rem) **「お売りになりたい商品を教えてください。」**
- **Form** `display:flex; flex-direction:column; gap:1rem`. Fields are `label`s with a caption (`.75rem; 700; letter-spacing:.04em; color:#6B7890`). Controls: `width:100%; border:1px solid #E1E8F2; background:#F6F9FD; border-radius:.75rem; padding:.75rem 1rem; font-size:.875rem; transition:.2s`; on focus `border-color:#3E8EE0; background:#fff; box-shadow:0 0 0 4px rgba(62,142,224,.12)`. Every control has a stable `id`.
  - **お名前** (text, required, placeholder 「山田 太郎」)
  - **メールアドレス** (email, required, placeholder 「you@example.com」)
  - **商品名・型番** (textarea, 3 rows, required, `resize:none`, placeholder 「例: iPhone17 Pro 256GB 未開封 ×1」; pre-filled from the cart when opened from there)
  - **商品の状態**: a segmented control of three radio pills (`新品・未開封` / `中古` / `ジャンク`), with the selected pill filled `#3E8EE0` and a sliding background (`{300,28}`)
  - **買取方法**: a segmented control (`店頭` / `郵送` / `法人`)
- **Validation:** on submit, invalid fields shake (`translateX` keyframes ±6px, 300ms) and show a red message under the field (「入力してください」 / 「メールアドレスの形式で入力してください」).
- **Bottom row** `margin-top:.5rem; display:flex; align-items:center; justify-content:space-between; gap:1rem`: a note 「1営業日以内にご連絡します。」 (`.75rem; #6B7890`) and a PillButton **「査定を申し込む」** (`brand`, withArrow up-right, `type=submit`; label becomes **「送信中…」** while submitting).
- **The submit is a stub:** `preventDefault`, show 「送信中…」 for 900ms, then switch to the success state. No network call.

**Success state** (centred, `padding-block:2rem; gap:1rem`):
- A `3.5rem` circle (`background:#16233A; color:#6AB2F2; font-size:1.5rem`) with the LogoMark. It pops in (`scale .6→1`, `{320,14}`) while a ring pulses outward once (`box-shadow 0 0 0 0 → 0 0 0 16px rgba(62,142,224,0)`, .8s).
- `h2` **「査定依頼を受け付けました」**.
- `p` (`max-width:32ch; font-size:.875rem; color:#6B7890`) **「お問い合わせありがとうございます。1営業日以内に担当者よりご連絡します。（デモのため送信はされません）」**.
- PillButton **「閉じる」** (`dark`), which closes the modal. Reset the form 300ms after closing.

---

### 16) Toast

`position:fixed; left:50%; bottom:calc(1.5rem + env(safe-area-inset-bottom,0px)); z-index:140; background:#1E2A3B; color:#fff; padding:.625rem 1.125rem; border-radius:9999px; font-size:.8125rem; box-shadow:0 8px 24px -10px rgba(0,0,0,.5)`. Enter `translate(-50%, 12px) → translate(-50%, 0)` with opacity, `{300,24}`. Auto-hides after 1.8s; a new toast resets the timer.

---

## Shared component recipes

**PillButton** — `inline-block`, wrapping a hover-spring scale (`scale 1→1.04`, `{320,18}`). Inner: `inline-flex; align-items:center; gap:.75rem; border-radius:9999px; font-size:.875rem; font-weight:700`.
- Variants:
  - `brand` = `background:#3E8EE0; color:#fff` (hover background `#2C74C4`)
  - `dark` = `background:#16233A; color:#fff`
  - `light` = `background:#EAF2FB; color:#1E2A3B`
  - `outline` = `border:1.5px solid #E1E8F2; background:#fff; color:#1E2A3B` (hover border `#3E8EE0`)
  - `line` = `background:#06C755; color:#fff`
- Padding: with arrow `.375rem .375rem .375rem 1.5rem`; without `.875rem 1.75rem`.
- Arrow badge: `2.25rem` circle, `font-size:1rem`. On `brand`/`dark`/`line` the badge is `background:#fff; color:#16233A`; on the others `background:#16233A; color:#fff`. On button hover the arrow springs: `right` → `translate(3px,0)`, `up-right` → `translate(2px,-2px)`, `{320,18}`.

**Eyebrow** — `inline-flex; align-items:center; gap:.5rem; font-size:.8125rem; font-weight:700` with a leading `.375rem` dot. `dark` tone: text `rgba(30,42,59,.7)`, dot `#3E8EE0`. `light` tone: text `rgba(255,255,255,.7)`, dot `#6AB2F2`. The bordered variant adds `border:1px solid #E1E8F2; border-radius:9999px; padding:.375rem 1rem; background:#fff`.

**AnimatedLink** — `inline-flex` link wrapping a hover-spring span (default `translateX 0→4px, opacity .65→1`, `{320,22}`).

**Tabs with sliding indicator** — the container is `position:relative`. One `span.ind` (`position:absolute; top/bottom:.5rem; border-radius:9999px; background:#3E8EE0; z-index:0`) springs its `left`/`width` to the selected tab's offset (`{300,28}`) on change and on resize. Tabs sit at `z-index:1`, and their text colour transitions (.2s).

**Hover note** — every hover spring is disabled without `(hover:hover) and (pointer:fine)`.

---

## Fixed parameters (bake these in)

- **Colours:** `#F6F9FD #EAF2FB #FFFFFF #1E2A3B #6B7890 #A9B6C8 #E1E8F2 #3E8EE0 #2C74C4 #E6F1FC #F2F8FE #6AB2F2 #16233A #22324F #E0475F #F0607A #06C755 #DCEAF8 #18A058`. theme-color `#16233A`.
- **Fonts:** **Noto Sans JP** 400/500/700/900 (fallback Hiragino Sans, Yu Gothic, Meiryo, sans-serif); **Roboto Mono** 500/700 for prices and numbers.
- **Radii:** pill `9999px`, card `1.25rem`, large panels `2rem`, control `.75rem`. Watermark `13rem`. Shell max-width `75rem`.
- **Breakpoints:** sm 640 / md 768 / lg 1024. Adaptive grid bases `1920/1440/1024/360`, scale-up base 1920, coef `0.6666`, FONT_BASE 16.
- **Loader:** `FILL_MS 1300`, easeInOutCubic, 3-digit counter + `%`, ticker swaps at 25/50/75/100, exit `translateY 0→-100%` `{220,30}`, content fade `{260,26}`, fill `#6AB2F2`, navy `#16233A`.
- **LiquidReveal:** `brushRadius 150`, `decay .016`, `dpr min(dpr,2)`, fadeFrames 120, idle ramp `+idle*.004` capped `.5`, gradient stops `1 / .82 / 0` at `0 / .55 / 1`, step `max(radius*.3,1)`, max interp 60. Lens ring spring `{260,24}`. Hint disappears after 40 stamps.
- **Reveal curves:** lines `cubic-bezier(.215,.61,.355,1)` 900ms; chars `cubic-bezier(.165,.84,.44,1)` 600ms, stagger 22; words 700ms, stagger 35. Hero line stagger 120; footer CTA line stagger 100.
- **Entrance delays (ms after `ready`):** header 150, eyebrow 200, H1 250, watermark 300, hero card 400, lead 550, brands 550, rating 650, CTAs 750, status bar 900, hint 1100. Campaign slides `index*90`, categories `index*60`, SellBand `index*120`, product cards `index*40`, method rows `index*80`, reasons `index*70`, stats `index*90`, FAQ `index*50`, stores `index*80`.
- **Spring configs (tension/friction):** header 210/26; hovers (logo, buttons, badges, pills) 320/18; nav and link lifts 320/22; brand items 320/20; category circle 300/18; SellBand tile 300/18; product card 260/22; favourite pop 320/12; price pulse 320/16; method row fill 240/26; method arrow 300/18; reason card 280/22; reveals 200/24; stats panel 180/26; hero carousel 300/28; tab indicator 300/28; nav overlay 280/32; drawer and modal 260/30; toast 300/24; cart badge bump 320/14.
- **Intervals:** hero carousel 4s, campaign slider 6s, news rotation 5s, clock 1s, search placeholder typing 70ms/char (hold 1.6s, erase 35ms/char).
- **Stats count-up:** `start "top bottom"` → `end "center center"`, `round(progress*target)` formatted `ja-JP`, throttle ~30ms.
- **Clock:** 24-hour `HH:MM`, date `YYYY年M月D日`, fallbacks `10:30` / `2026年10月19日`. Store open status uses 10:30–19:30.
- **Price list:** 9 per page; search over name + JAN across all tabs; favourites in `localStorage['uridoki-favs']` (wrapped in try/catch).
- **Copy:** all Japanese labels and text exactly as written in each section above. Every price, store, phone number, licence number and statistic is a demo sample and is labelled as such where specified.
