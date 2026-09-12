# Paurk — Final design spec ("Exhale")

> Somewhere to breathe, wherever, whenever.

This is the build spec for the winning concept (**zen / "Exhale"**, jury score 132), with the strongest
grafts from the runners-up folded in and the jury's critiques resolved. It is written so that a front-end
engineer can build it without asking questions. Where a value is given, it is the value; where a behaviour
is described, it is the behaviour. Existing modules referenced by name (`src/lib/time.ts`, `src/lib/rank.ts`,
`src/lib/geo.ts`, `src/lib/radar.ts`, `src/lib/photos.ts`, `src/lib/weather.ts`, `src/lib/router.ts`,
`src/store.ts`, `src/globe/GlobeEngine.ts`, `public/globe-dots.bin`) are kept and extended, not replaced.

---

## 1. Concept & name

**Name:** Paurk
**Tagline:** *Somewhere to breathe, wherever, whenever.*
**Working title of the visual language:** Exhale.

**Concept.** Paurk is a breathing exercise you can hold in your hand. One sheet of warm paper, one ink,
one seal-red mark, and a matte porcelain globe that inhales and exhales on an eight-second cycle. Every screen
has exactly one thing to look at — the globe, the list, or the photo — and everything else is a whisper of
text. There are no cards, no borders, no pills, no badges, no icons without words. Time of day is not a dark
mode but a *horizon light*: a slow band of colour that rises from the bottom of the page and is caught on the
underside of the globe, shifting imperceptibly from rose (dawn) through apricot (golden hour) to slate (night).
The globe does not float in space: on the home screen it *rests in that light*, its lower limb dissolving into
the horizon like a moon just risen from paper, and it lifts clear only when you open a city. Motion is limited
to fading, drifting and breathing; nothing bounces, nothing is faster than a breath.

**The one bolder decision (answering "it needs one bolder, more specific visual decision"):** the globe is
composed as a **risen moon**, not a centred ball. On the Sky screen it sits large and low, its bottom 15%
dissolving into the horizon band, the real day/night terminator crossing it, and a printed caption beneath it
(`Plate · the world · 35 cities · 18:42 in Lisbon`). On city select it lifts, the caption changes to the city,
and a dotted graphite great-circle line draws the route you have travelled this session. The porcelain ball
catching the page's own horizon light is the image people will remember; the risen-moon composition, the
printed plate caption and the travelled route keep it from reading as a wellness-brand template.

### 1.1 Judges' critiques and how this spec resolves them

| Critique | Resolution in this spec |
| --- | --- |
| **Affordance: bare words, no nav, no search box; a first-time user sees a ball and does not know what is tappable.** | (a) A hard typographic rule: *every actionable word is underlined* (1px ink underline, offset 0.25em) and set in Zen Kaku 500; *no passive text is ever underlined*. Underline = tappable, always. **Two exceptions**. (i) The header's two **marks** — search and bookmark (§6.1) — are glyphs, not words; a mark is never underlined, and shows state by filling rather than by a coloured rule. (ii) Names inside a list of results — the world list (§6.3) and the find rows (§6.4) — are left plain, because a column of underlined proper nouns reads as ruled paper rather than as a set of choices. There the *row* is the target and carries the affordance itself: a well on hover and focus, and in find an ink rule down its left edge when active. (b) The **margin note** (§6.13): a single, always-present caption line under the phase line that narrates state and, in context, says what you can do ("drag the globe, or search", "tap a row to open it"). It is not a one-time hint; it is the app's voice. (c) The **"now in the world" list** (§6.3) under the globe on the Sky screen lists city names as tappable words grouped by what is happening there — so on touch, where hover labels do not exist, every city is reachable as text without opening the find panel. (d) The find panel (§6.4) is opened by a permanent word in the header on every screen, or by `/`. |
| **44px targets are "a matter of padding discipline that nobody will police".** | One `.word` class (§2.6) gives every actionable word a 44×44 minimum hit box through padding + negative margin, and `scripts/qa/screenshot.mjs` gains a check that fails the build when any `a, button, [role=button], input` has a bounding box under 44×44 on the 390px run. Policed by CI, not by people. |
| **On touch, exactly one label at a time appears on hover, so city names are invisible until you tap.** | On coarse pointers the globe shows **up to six labels** for the front-facing cities nearest the screen centre (fading by `dot(normal, view)`), plus the "now in the world" list. On fine pointers, hover shows one label as before. Keyboard shows the focused one. |
| **Uniqueness "good rather than great": warm paper + Cormorant + one accent is the quiet-luxury trope.** | The risen-moon composition, the printed plate caption, the dotted session route, leader lines from list rows to markers, and the terminator that is *honest* (real sub-solar point, scrubbable) — all specific to this product, none of them decoration. |
| **Pointer-event sheet instead of native scroll-snap.** | The mobile sheet is now a **native vertical scroll container with `scroll-snap-type: y mandatory`** and transparent spacer blocks as detents (§3.3). No gesture code. |
| **A pale page on OLED at 2am.** | Night raises the slate horizon band to 60vh; the dark token set exists and is applied *only* at load from `prefers-color-scheme` or by the "lights down" word — never flipped mid-session (§7.4). Tested at 2am, in the dark, in the QA checklist. |
| **`@property <color>` transition needs Firefox 128+.** | Feature-detect `CSS.registerProperty`; fallback lerps `--horizon` in JS at 2fps (§2.7). |
| **Cormorant vanishes below 20px.** | Hard floor: Cormorant is never set below 20px; the 15px reason line moves to Zen Kaku 300 italic-less (Zen Kaku has no italic; use weight 300 + ink-2). |
| **Spot discs on the sphere are sub-pixel.** | Spots are never drawn on the globe. In around-you mode a **compass loupe** (§6.6) built on `lib/radar.ts` shows them by bearing and distance. |

---

## 2. Design tokens

All colours in the CSS must come from these tokens. There are no other colours anywhere in the stylesheet or in
the globe shaders (the shaders receive the same values as uniforms). Two theme sets: **paper** (default) and
**slate** (dark). Slate is applied only (a) at first load when `prefers-color-scheme: dark` matches, or (b) by the
"lights down" word in About / ambient mode. It is never switched automatically while the page is open.

### 2.1 Colour

```css
:root {
  /* paper (default) */
  --bg:            #F4F1EA;  /* paper: the only page background */
  --well:          #EAE6DC;  /* hover/pressed wells, time-dial track well */
  --hairline:      #D6D1C6;  /* 1px rules, sheet handle */
  --ink:           #23231F;  /* body text, 13.9:1 on paper */
  --ink-2:         #5F5D56;  /* secondary text, 5.8:1 on paper, 5.3:1 on well */
  --accent:        #C8553D;  /* seal red: marks and display text ≥22px only (3.9:1) */
  --accent-ink:    #A8402B;  /* seal red for small text, 5.4:1 */
  --caution:       #7E6118;  /* ochre ink, 5.2:1 */
  --moss:          #4E6B45;  /* 'open now', favourable lines, 5.3:1 */
  --globe-ocean:   #EDE9E0;  /* porcelain */
  --globe-night:   #D9D3C6;  /* night side of the porcelain (~12% darker) */
  --globe-land:    #6B685F;  /* graphite dots */
  --globe-shadow:  rgba(35, 35, 31, 0.08); /* contact shadow under the sphere */

  /* horizon band colours per phase (rgba over paper; alpha ≤ .45 always) */
  --h-night:       rgba(52, 56, 66, 0.38);
  --h-dawn:        rgba(214, 170, 160, 0.35);
  --h-morning:     rgba(200, 208, 214, 0.30);
  --h-midday:      rgba(220, 220, 214, 0.20);
  --h-afternoon:   rgba(214, 206, 192, 0.24);
  --h-golden:      rgba(232, 185, 138, 0.42);
  --h-dusk:        rgba(150, 140, 168, 0.36);

  /* live values written by JS */
  --horizon:       var(--h-midday); /* registered @property, see 2.7 */
  --horizon-h:     45vh;            /* band height; 60vh at night */
  --breath:        0;               /* 0..1 shared clock sample, registered <number> */
  --golden:        0;               /* 0..1 golden-lamp ramp (1 - minutesToSunset/90) */
}

:root[data-theme="slate"] {
  --bg:            #1D1D1A;
  --well:          #262622;
  --hairline:      #3A3A35;
  --ink:           #EDE9E0;  /* 14.1:1 */
  --ink-2:         #B3AEA3;  /* 7.6:1 */
  --accent:        #C8553D;  /* marks and ≥22px display only */
  --accent-ink:    #E4826B;  /* 6.3:1 on slate bg */
  --caution:       #C9A84E;  /* 7.5:1 */
  --moss:          #9DB88F;  /* 7.9:1 */
  --globe-ocean:   #2A2B2E;  /* slate porcelain */
  --globe-night:   #1F2022;
  --globe-land:    #EDE9E0;  /* paper dots */
  --globe-shadow:  rgba(0, 0, 0, 0.35);

  --h-night:       rgba(20, 22, 30, 0.45);
  --h-dawn:        rgba(214, 170, 160, 0.22);
  --h-morning:     rgba(200, 208, 214, 0.16);
  --h-midday:      rgba(220, 220, 214, 0.10);
  --h-afternoon:   rgba(214, 206, 192, 0.14);
  --h-golden:      rgba(232, 185, 138, 0.26);
  --h-dusk:        rgba(150, 140, 168, 0.22);
}
```

Rules:
- `--accent` may colour: the selected-city marker, the ripple, the active-filter underline, the sun in the
  poster, the save ink-drop, the user ring (as `--accent-ink`), the time-dial thumb, the 56px golden numeral.
  Nothing else. Small accent-coloured text uses `--accent-ink`.
- Links are `--ink` underlined. Never blue.
- Status is a word, never a colour alone: "open now" (moss), "see hours" (ink-2), "caution" (ochre).
- The horizon band multiplies over paper with alpha ≤ .45, so no text pair drops below 4.5:1 in any phase.
  (Verified pairs: ink/paper under golden band = 9.7:1; ink-2/paper under night band = 4.9:1.)

### 2.2 Type

Google Fonts import (place in `index.html` `<head>`, with `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`):

```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Zen+Kaku+Gothic+New:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap
```

```css
:root {
  --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-body:    "Zen Kaku Gothic New", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:    "DM Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* scale (px). Cormorant is never used below 20px. */
  --t-display-xl: 56px;   /* golden-hour countdown numeral, desktop (44px mobile) */
  --t-display-l:  34px;   /* city name, spot name in detail */
  --t-display-m:  28px;   /* wordmark on sky, section titles like 'take care' at 20px */
  --t-display-s:  22px;   /* phase line, spot name in list rows */
  --t-display-xs: 20px;   /* tip pull-line, 'take care', 'best at' headings */
  --t-body:       16px;   /* line-height 1.7, measure 60ch */
  --t-small:      13px;   /* line-height 1.5, ink-2 */
  --t-mono:       13px;   /* line-height 1.4, letter-spacing .02em, lowercase */
  --t-mono-s:     11px;   /* photo attribution, poster caption; never below 11 */
}
body { font: 300 var(--t-body)/1.7 var(--font-body); color: var(--ink); background: var(--bg); }
.display { font-family: var(--font-display); font-weight: 300; letter-spacing: -0.005em; }
.display-num { font-variant-numeric: lining-nums tabular-nums; }
.mono { font-family: var(--font-mono); font-weight: 400; font-size: var(--t-mono); letter-spacing: .02em; text-transform: lowercase; }
```

Weight use: Cormorant 300 for everything display, 300 italic for whispers (wordmark, reason lines are *not*
Cormorant — see below), 400 only for the 56px numeral. Zen Kaku 300 for body, 400 for row names' meta lines,
500 for actionable words. DM Mono 400 default, 300 for attribution.

Reason lines (§6.7) are Zen Kaku 300 at 15px in ink-2 (Cormorant floor rule). No uppercase-tracked labels
anywhere.

### 2.3 Spacing

`--s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px; --s-8: 32px; --s-10: 40px; --s-12: 48px; --s-16: 64px.`
Row air: 20px above and below text in list rows. Page gutter: 16px at 390px, 24px at ≥720px, 40px at ≥1024px.
Text column measure: 380px (desktop column), 100% − gutters (mobile).

### 2.4 Radii, shadows, glows

- Radii: `--r-well: 6px` (hover wells), `--r-photo: 4px` (photo/poster), `--r-dial: 999px` (dial thumb). Nothing else is rounded.
- Shadows: **none** on UI. The only shadow in the app is the globe's contact shadow: a `div` behind the canvas,
  `background: radial-gradient(ellipse at 50% 50%, var(--globe-shadow), transparent 70%)`, width 78% and height 14%
  of the canvas, offset 4% below the sphere centre.
- Glows: **none**. The pencil halo (§4.4) is graphite at ≤ .10 alpha, not a glow.

### 2.5 Z-index layers

```
--z-horizon:     0   fixed horizon band (behind everything, multiply)
--z-shadow:      1   contact shadow
--z-canvas:      2   globe canvas wrapper
--z-veil:        3   horizon veil over the sphere's lower limb (sky screen only)
--z-labels:      4   projected city labels + leader-line svg + route/tick overlays
--z-column:      5   desktop right column / mobile sheet
--z-sticky:      6   sheet header, mobile spot bar
--z-paperweight: 7   the shrunk globe wrapper at half/full sheet detent
--z-note:        8   margin note (aria-live)
--z-dialog:      (native <dialog> top layer)
--z-breathe:     9   breathe-here overlay (a <dialog> too)
```

### 2.6 The `.word` control

Every action is a word. This class is the only way to make one:

```css
.word {
  display: inline-flex; align-items: center;
  min-height: 44px; min-width: 44px;
  padding: 10px 6px; margin: -10px -6px;   /* hit box without visual weight */
  font: 500 var(--t-body)/1.4 var(--font-body);
  color: var(--ink);
  text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: .25em;
  text-decoration-color: color-mix(in srgb, var(--ink) 55%, transparent);
  background: none; border: 0; border-radius: var(--r-well); cursor: pointer;
  transition: background-color 240ms cubic-bezier(.2,.8,.2,1), text-decoration-color 240ms;
}
.word:hover, .word:focus-visible { background: var(--well); text-decoration-color: var(--ink); }
.word:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.word[aria-pressed="true"] { text-decoration-color: var(--accent); text-decoration-thickness: 2px; }
.word--quiet { font-weight: 400; color: var(--ink-2); } /* header words: about, saved */
```

Passive text never has `text-decoration: underline`. Sources in the detail page are `.word`s too (they are links).

### 2.7 Motion

Four durations, two easings. Nothing else is allowed.

```css
:root {
  --d-micro:  240ms;   /* hover wells, underline, word swaps */
  --d-panel:  600ms;   /* sheet, dialog, labels, veil */
  --d-flight: 1800ms;  /* globe flight (1400ms on the way back) */
  --d-light:  60s;     /* horizon colour */
  --e-settle: cubic-bezier(.2,.8,.2,1);       /* anything entering or settling */
  /* quintic in-out for the flight is applied in JS: t<.5 ? 16t^5 : 1-pow(-2t+2,5)/2 */
}
@property --horizon { syntax: '<color>'; inherits: true; initial-value: rgba(220,220,214,.2); }
@property --breath  { syntax: '<number>'; inherits: true; initial-value: 0; }
@property --golden  { syntax: '<number>'; inherits: true; initial-value: 0; }
```

- Only `opacity`, `transform` and `clip-path` are animated in CSS; colour animates only via `--horizon`
  (`transition: --horizon var(--d-light) linear` on `:root`; 400ms while the time dial is being scrubbed).
- Fallback: if `!('registerProperty' in CSS)` the JS `HorizonClock` lerps `--horizon` in sRGB at 2fps toward the
  target over the same 60s / 400ms.
- The shared clock: `store.clock` is `performance.now()`-based; `breath(t) = 0.5 - 0.5*cos(t*2π/8000)`.
  Sphere scale, halo alpha, `--breath`, the save ink-drop and the breathe-here ring all sample it.
- Text never travels more than 6px; panels never more than their own height; the globe never self-rotates
  faster than 0.02 rad/s. No overshoot anywhere. No sound, no haptics, no scroll parallax.

### 2.8 Reduced motion

`prefers-reduced-motion: reduce` **or** the "still" toggle (`localStorage paurk.still.v1 = "1"`) sets
`html[data-still]`, which:
- removes breath (sphere scale, halo, `--breath` frozen at 0), auto-rotation, ripple, dot-size oscillation,
  drag inertia (drag still rotates 1:1), row staggers, the first-breath sequence;
- turns globe flights into a 300ms opacity crossfade (canvas wrapper fades to .2 while the rotation is set
  instantly, then back);
- keeps opacity fades ≤ 300ms and the 60s horizon light (it is colour, not motion);
- turns the sheet's `scroll-behavior` to `auto`;
- the breathe-here overlay shows text cues ("in … out") with no ring scaling.

---

## 3. Layout & information architecture

### 3.1 Routes (hash, `src/lib/router.ts`)

| Route | Screen | Focus |
| --- | --- | --- |
| `#/` | Sky | the globe |
| `#/c/<city>` | City | the list |
| `#/s/<city>/<spot>` | Spot | the photo/poster |
| `#/saved` | Stones | the saved list |
| `#/about` | About | policy, still, units, lights down |
| `?v=quiet,free` | filter state, appended to any route |
| `?t=2130` | pinned time-dial preview (minutes as HHMM, city-local) |

Query params are read on load and written with `history.replaceState` (debounced 120ms). Unknown routes fall
back to `#/` silently.

### 3.2 Desktop (≥ 900px)

Grid: `body > .app { display: grid; grid-template-columns: 1fr 460px; min-height: 100dvh; }`
At 900–1023px the column is 400px with 32px padding; at ≥1024px it is 460px with 40px padding, giving a 380px
text measure.

- **Header** (spans both columns, 64px tall, 40px side padding): left, the wordmark; right, three `.word--quiet`s:
  a search mark · a bookmark mark with its count · `about`. The header is `position: sticky; top: 0` over paper at 85% with
  `backdrop-filter: blur(12px) saturate(.8)` only when the column scrolls under it.
- **Sky (`#/`)**: the city column (§6.3) owns the left `var(--column)`; the sphere is centred in what is left.
  The horizon band is 45vh tall (60vh at night) and the
  sphere's lower limb dissolves into it via the veil (§4.7).
- **City (`#/c/…`)**: two columns. The globe remains in the left column, camera re-seated with
  `camera.setViewOffset` so the city lands at 42% x / 45% y of the *left column*; the veil fades out over 600ms.
  The right column scrolls independently (`overflow-y: auto; height: calc(100dvh - 64px)`) and holds, top to
  bottom with 20px air between blocks: `← sky` word, city name (Cormorant 34) with the country in ink-2 13px on the
  next line, the phase line for the city's timezone, the sun-rule time dial (§6.5), the compass row (only when
  geolocated), the vibes trigger (§6.7), the margin note (column instance), and the ranked list.
- **Spot**: replaces the list *inside the same column* (the header of the column becomes `← Lisbon`); scroll
  position of the list is kept in the store and restored on return. The globe drops the bearing tick (§4.5).
- **Stones (`#/saved`)**: the same column layout, list grouped by city with a pebble row at the top.
- **About**: a 420px-wide native `<dialog>` in the top layer; paper, no border, hairline top rule.

### 3.3 Mobile (< 900px; designed at 390×844 first)

- **Top row** 56px: wordmark left; the search mark and the bookmark mark right (`about` moves into the sheet footer
  and the Sky footer). Safe-area padding: `padding-top: env(safe-area-inset-top)`.
- **Sky**: the canvas is a 1:1 square of width `min(100vw, 62vh)`, centred, with its centre at 40% of viewport
  height; the plate caption, phase line, margin note and the two action words sit in the lower third *over* the
  horizon band (35vh, 55vh at night). The "now in the world" list is below, in normal flow, page-scrollable.
- **City**: the canvas animates to a **38vh** tall square-cropped wrapper at the top (wrapper `height` transition
  600ms, camera dolly on the same curve) and the **sheet** rises out of the horizon.
  - The sheet is a native scroller: `.sheet { position: fixed; inset: 0; overflow-y: auto; scroll-snap-type: y mandatory; overscroll-behavior: contain; }`
    Inside: three transparent spacer blocks, each `scroll-snap-align: start`, with heights that put the paper
    panel's top edge at **82% (peek)**, **45% (half)** and **6% (full)** of `100dvh`; the panel itself is the
    fourth snap child (`scroll-snap-align: start`) and its content scrolls in flow. `pointer-events: none` on the
    spacers, `auto` on the panel, so touches above the panel fall through to the canvas.
  - The panel's top 120px is `background: linear-gradient(to bottom, var(--horizon) 0, var(--bg) 120px)` so the
    list appears to rise out of the evening. A 32×3px hairline handle sits 12px from the top. The header (city
    name, phase line, vibes trigger, time dial ribbon) is `position: sticky; top: var(--header-h)` inside the panel, opaque.
  - `sheetProgress` (0 at peek, 1 at full) is derived from `scrollTop / (fullTop - peekTop)` on a passive scroll
    listener and written to the store at most once per frame. GlobeEngine lerps camera distance 2.2 → 2.6 from
    it. At progress ≥ 0.9 the canvas wrapper becomes the **paperweight** (§4.8): 64px, top-right, above the sheet,
    tappable; a tap scrolls the sheet back to peek (`scrollTo({top: peekTop, behavior: 'smooth'})`).
  - `touch-action`: the canvas has `touch-action: none` only while `sheetProgress < 0.1`; otherwise the wrapper
    sets `touch-action: pan-y` so scrolling the list never spins the globe.
  - Keyboard: a `show more` / `show less` word in the sticky header moves between detents.
- **Spot**: the sheet is scrolled to full; a 48px sticky bar with `← list` and `save` over paper at 85% with
  `backdrop-filter: blur(12px) saturate(.8)`; photo 3:2 full-bleed within 16px gutters.
- Body text 16px, minimum 13px (mono 11px for attribution only); every tap target ≥ 44px via `.word`.

### 3.4 App states

| State | What the user sees |
| --- | --- |
| **Loading** | Paper, wordmark, the empty canvas wrapper (contact shadow already painted). Land dots resolve in random order over 1.4s (`uReveal`), the sphere scales .96→1 over 1.6s, the plate caption fades in, then the phase line word by word. Three.js is lazy-loaded after first paint; the header words and the "now in the world" list are usable before the globe exists. |
| **Idle (Sky)** | Globe breathing, auto-rotating, resting in the horizon light. Margin note: "drag the globe, or search". |
| **City selected** | Flight (1.8s), ripple, name writes itself, rows settle. Margin note: "8 places · 3 good right now". |
| **Spot selected** | Poster paints instantly; photo crossfades when accepted. Globe shows the bearing tick from the city centre. |
| **Around you (granted)** | User ring on the globe, meridian faces the camera, nearest city within 80km selected; compass row; loupe; needles on rows. |
| **Around you (> 80km)** | "The nearest city we know is Porto, 312 km away." with `open Porto` · `choose another`; the user ring stays. |
| **No permission / failed** | Margin note: "No location — that is fine." The find panel (§6.4) stays open and falls back to the full city list. Rows carry no distance, no needles, no bearings: a walk time from a centre the reader is not standing in measures nothing they asked about. The `around me` row reads `try again`. Denial is remembered (`localStorage paurk.geo.denied=1`); the prompt is never re-triggered automatically. |
| **Unsupported / insecure context** | `around me` is not rendered. |
| **Saved (empty)** | "Nothing saved yet. Save a spot and it will wait here." |
| **Empty filter result** | "Nothing matches quiet + water here right now — loosen a word." The open panel shows each word's count so the user sees which to drop. |
| **No photo** | The Sumi poster stays; caption "no photograph · poster drawn from the spot's notes". Not an error state. |
| **Offline** | Phase line suffix "· offline"; weather clause absent; photos from cache or poster; everything else identical. |
| **No WebGL** | 2D canvas orthographic globe (§4.10); everything else identical. |
| **Time preview** | Phase line prefixed "if it were 21:30 ·"; dial thumb becomes a moon after dusk; `pin` word writes `?t=`. |
| **Ambient (lights down)** | Everything but the canvas, the phase line and the plate caption hidden; slate tokens; wake lock. Any key/tap leaves. |

---

## 4. The globe

Object, not planet: a matte porcelain ball resting on paper, catching the page's light. Built in
`src/globe/GlobeEngine.ts` (existing class extended). The renderer is `new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })`,
no scene background, `outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping`. Scene graph:
`globeGroup` (rotated by the controller) → `sphere`, `dots`, `markers`, `route`, `tick`; `halo` is a child of the
scene (not the group) so it never rotates.

### 4.1 Sphere

`SphereGeometry(1, 96, 96)` (64 on the lite tier). `ShaderMaterial`, uniforms:
`uSun (vec3)`, `uHorizon (vec4 rgba)`, `uOcean (vec3)`, `uNight (vec3)`, `uTime (float)`.

Fragment (per pixel, `N` world normal, `V` view direction):
```glsl
float l   = smoothstep(-0.55, 0.55, dot(N, uSun));           // wide, slow terminator
vec3 c    = mix(uNight, uOcean, l);
c        *= 1.0 - 0.18 * pow(1.0 - max(dot(N, V), 0.0), 2.5); // limb darkening: ceramic, not disc
float h   = uHorizon.a * 0.35 * smoothstep(0.2, -0.9, N.y);   // lower limb catches the horizon
c         = mix(c, uHorizon.rgb, h);
c        += (hash(gl_FragCoord.xy) - 0.5) * 0.025;            // unglazed clay grain
gl_FragColor = vec4(c, 1.0);
```
`uSun` is the unit vector of the sub-solar point (`lib/geo.subsolar`) for the *displayed* instant (now, or the
time-dial preview), refreshed every 60s or on dial input. `uHorizon` mirrors `--horizon` (read from
`getComputedStyle` once per second; the 60s CSS transition therefore also drives the sphere). No specular, no
textures, no fills, no outlines, no graticule.

### 4.2 Land

`public/globe-dots.bin` (existing: Int16 lat/lng pairs, ~23k points; stride 2 on lite). `THREE.Points` at radius
1.003 with attributes `position`, `aPhase` (random 0..1), `aReveal` (random 0..1). `ShaderMaterial`, `transparent`,
`depthTest: true`, `depthWrite: false`.

Vertex:
```glsl
vec3 N = normalize(position);
vec4 mv = modelViewMatrix * vec4(position, 1.0);
float facing = dot(normalize((modelMatrix * vec4(N, 0.0)).xyz), uCamDir);
vFacing = facing;                                              // back-face discard in fragment
float breathe = uStill > 0.5 ? 0.0 : 0.06 * sin(uTime * 0.35 + aPhase * 6.283);
gl_PointSize = min(8.0 * uDPR, uBase * uDPR * (1.0 + breathe) / -mv.z);   // uBase ≈ 2.4 * 3.2
vAlpha = smoothstep(aReveal - 0.08, aReveal, uReveal)
       * mix(0.32, 0.6, smoothstep(-0.55, 0.55, dot(N, uSun)));
gl_Position = projectionMatrix * mv;
```
Fragment: `if (vFacing < 0.02) discard;` then a soft disc `smoothstep(0.5, 0.35, length(gl_PointCoord - 0.5))`,
colour `uLand` (graphite / paper in slate), alpha `vAlpha * disc`. Sizes are in device pixels via `uDPR`, capped
at 8px; test at DPR 1/2/3 (Safari). If Points prove inconsistent, the fallback is an `InstancedMesh` of
`CircleGeometry(0.0035, 6)` with the same attributes (23k instances is fine).

### 4.3 Markers (cities)

Two `InstancedMesh`es, one instance per city: a ring (`RingGeometry(0.010, 0.013, 24)`) and a disc
(`CircleGeometry(0.0045, 16)`), both `MeshBasicMaterial({ transparent: true })` with `instanceColor`, positioned at
radius 1.006 and oriented tangent (`dummy.position.copy(N).multiplyScalar(1.006); dummy.lookAt(N.clone().multiplyScalar(2)); setMatrixAt`).
Per-instance `aHeat` (Float32 `InstancedBufferAttribute`) lerped on the CPU each frame toward its target at
`0.12/frame`:

| State | Ring | Disc |
| --- | --- | --- |
| default | ink, alpha .7 | hidden (scale 0) |
| city has saved spots | ink | ink (filled) |
| hovered / list-focused (heat → 1) | ink, scale 1 + .35·heat | — |
| selected | accent, scale 1.2 | accent |
| during flight | others dimmed to .3 via `uMarkerFade` | |

**Ripple**: one extra `Mesh(RingGeometry(0.010, 0.012, 32))` at the selected city, scale 1→3 and opacity .5→0
over 4s on a 6s cycle sampled from the shared clock; off under still.

**Picking is screen-space** (no raycasting): each frame while the pointer is down or on click, project the 35
positions with `Vector3.project(camera)`; the nearest within 28px (44px on `pointer: coarse`) among front-facing
markers (`dot(N, camDir) > 0.05`) wins. Markers below the veil line (§4.7) are ignored on the Sky screen.

**Labels**: HTML `<button class="paurk-label">` elements in the existing `labelLayer`, positioned each frame with
`transform: translate3d()` from the projection (not React state). Cormorant italic 22px, ink; fade 600ms.
- Fine pointer: one label — the hovered city, or the selected one.
- Coarse pointer: up to six labels — the front-facing cities nearest the screen centre, opacity
  `smoothstep(0.15, 0.5, dot(N, camDir))`, deduplicated by a 48px screen-space exclusion so they never overlap.
- Keyboard: the focused city's label; it doubles as the focus ring (2px ink outline, offset 3px).

**User ring**: hollow `RingGeometry(0.012, 0.015)` in `--accent-ink`, 3s opacity pulse (.5↔1) on the shared clock;
labelled "you" (or "you, approx." when accuracy > 2km or the origin is a manual/timezone guess).

### 4.4 Halo

`SphereGeometry(1.06, 48, 48)`, `BackSide`, `ShaderMaterial`: `alpha = uHalo * pow(1.0 - dot(N, V), 3.0)`, colour
graphite (paper in slate). `uHalo = 0.10 - 0.03 * breath`. It is a pencil edge fading into the paper, not a glow.

### 4.5 Route line and bearing tick

- **Route** (session memory): on every city change a great-circle arc from the previous city (or the user ring)
  to the next: 64 points via `d3.geoInterpolate`, lifted by `1 + sin(t·π)·0.06`, `BufferGeometry` with `aDist`,
  `ShaderMaterial`: `alpha = step(fract(aDist*90.0), 0.5) * step(aDist, uProgress) * uAlpha`, graphite.
  `uProgress` 0→1 over 900ms in step with the flight; the last five hops are kept at `uAlpha .2`, the current at
  .5. Under still, `uProgress = 1` immediately.
- **Bearing tick** (Spot screen): one `Line` of two points from the city marker outward along the spot's bearing
  (length 0.05, ink, alpha .6) so orientation is never lost; fades with the spot.

### 4.6 Breath, idle, interaction

- Breath: `globeGroup.scale.setScalar(1 + 0.012 * breath)`; the halo and `--breath` sample the same clock.
- Idle rotation: 0.02 rad/s about Y with a 12° X tilt; suspended during drag, flight and for 8s after any
  interaction; resumes easing in over 3s. Off while a city is selected (the city must stay in its seat).
- Drag: pointer events on the canvas (`setPointerCapture`), yaw/pitch deltas scaled by `0.005 / distance`,
  pitch clamped ±70°; inertia damped ×0.94 per frame. **Soft detent**: when `|v| < 0.002 rad/frame` and a city's
  normal is within 6° of the screen centre, slerp onto it over 400ms and show its label (do *not* select; selection
  is a tap/Enter).
- Wheel / pinch: distance clamped 2.0–3.6, eased at 240ms.
- Hover (fine pointer): screen-space nearest within 28px → heat 1, label.
- Click / tap / Enter on a marker: select city (flight). Selecting by the globe never triggers a geolocation prompt.
- Keyboard (`tabindex=0`, `role="application"`, `aria-roledescription="globe"`, `aria-label="World globe, 35 cities"`):
  arrows rotate 6°, `+`/`-` zoom, `Tab`/`Shift+Tab` cycle markers by longitude (roving focus within the canvas via
  `aria-activedescendant` on hidden `<span role="option">`s), `Enter` selects, `Escape` returns to the sky.
- List ↔ globe: hovering/focusing a city in "now in the world" (Sky) sets its heat to 1 and draws a **leader line**
  (§5.6). Hovering a spot row does nothing on the globe (spots are not on it) — it highlights its dot in the loupe.

### 4.7 Camera choreography

`PerspectiveCamera(28, aspect, 0.1, 100)` at distance 3.2 on the Sky.

- **Seat**: rather than moving the mesh, the *vanishing point* moves with `camera.setViewOffset(fullW, fullH, offX, offY, w, h)`
  so the city lands at 42% x / 45% y of the left column on desktop and 50% x / 40% y on mobile (38vh wrapper).
  On the Sky the offset is reset (`clearViewOffset`) and the sphere is centred.
- **Flight (select)**: compute the target quaternion `q1` that brings the city normal to the camera's forward
  axis. Slerp `q0 → q1` over 1800ms with quintic in-out while distance dollies 3.2 → 2.2 on the same curve and
  `uMarkerFade` dims other markers to .3. At 1400ms the city name begins writing itself (§5.3); at 1800ms the ripple
  starts and the route line completes. The veil (§4.7b) fades out over the first 600ms.
- **Return (Escape / ←)**: reverse over 1400ms; auto-rotation resumes from the city's longitude; the veil fades
  back in over the last 600ms. Never a snap or a reset.
- **Around-me**: on success, a 2000ms slerp brings the user ring to the seat before the nearest city is selected.
- Under still: rotation is set instantly with a 300ms opacity crossfade of the canvas wrapper.

**4.7b The veil (risen moon).** On the Sky screen a `div.veil` covers the bottom 30% of the canvas wrapper with
`background: linear-gradient(to top, var(--bg) 0%, var(--bg) 35%, transparent 100%)`, `pointer-events: none`,
`z-index: var(--z-veil)`. The horizon band (multiply, behind the canvas) still tints it, so the sphere's lower
limb reads as sunk into the light. Its opacity is 1 on Sky and 0 elsewhere (600ms). Markers behind the veil's
opaque part are not pickable.

### 4.8 Paperweight (mobile, half/full sheet)

At `sheetProgress ≥ 0.9` the canvas wrapper transitions (600ms, transform only) to
`translate(calc(100vw - 80px - env(safe-area-inset-right)), calc(8px + env(safe-area-inset-top))) scale(0.16)`
with `transform-origin: top left`, `z-index: var(--z-paperweight)`, `pointer-events: auto`, `role="button"`,
`aria-label="Back to the globe"`. The engine renders one frame at the new size and then pauses. Tapping it scrolls
the sheet to peek and the wrapper returns. Between 0.45 and 0.9 progress the wrapper scales linearly 1 → 0.85 and
drifts up-right by up to 12px (cheap, compositor-only).

### 4.9 Performance budget and tiers

Targets: 60fps during drag/flight on desktop, ≥30fps on a 2020 mid-range phone; ≤ 16ms per frame on desktop,
≤ 32ms on mobile. Render on demand: full-rate loop only during drag, inertia, flight or dial scrub; otherwise a
30fps throttled loop for breath/rotation; stopped entirely on `visibilitychange: hidden`, when the
`IntersectionObserver` reports the canvas < 5% visible, at the paperweight detent, and under still when nothing
is animating (a single frame is rendered on `uSun`/`uHorizon` change).

| Tier | Trigger | Settings |
| --- | --- | --- |
| full | default | DPR ≤ 2, 96-seg sphere, all dots, halo, ripple |
| lite | `hardwareConcurrency ≤ 4` or `deviceMemory ≤ 4` or (`pointer: coarse` and DPR > 2) or `saveData` | DPR ≤ 1.5, 64-seg sphere, dot stride 2, halo kept, grain kept |
| re-evaluated | after the first 90 rendered frames, if mean frame time > 24ms → drop one tier; > 40ms on lite → stop idle rotation and breath (light still animates) |

Three.js and `GlobeEngine` are loaded with a dynamic `import()` after first paint; the layout reserves the
canvas box (with the contact shadow) so nothing shifts.

### 4.10 Degrade: no WebGL

If `WebGLRenderingContext` is missing or context creation fails: draw the same dots (every 3rd) once with
`d3-geo geoOrthographic` onto a 2D canvas (porcelain disc, graphite dots, terminator as the same wide gradient
drawn radially), re-rendered at 20fps during arrow-key/drag rotation; city markers are absolutely positioned
`.word` buttons. The route line, veil and paperweight behave identically (they are DOM). Breath is omitted.

---

## 5. Signature interactions

### 5.1 The first breath
On load the sphere inhales into view while the land resolves dot by dot and the phase line arrives one word at a
time. *Implementation:* canvas wrapper `transform: scale(.96) → 1` over 1600ms `--e-settle`; `uReveal` tweened
0→1 over 1400ms (each dot's alpha is `smoothstep(aReveal-.08, aReveal, uReveal)`); phase-line words wrapped in
`<span>` with `animation-delay: calc(var(--i) * 80ms)`, opacity 0→1 and `translateY(4px) → 0`, 240ms. Plate caption
fades in at 1200ms. Under still: one 300ms opacity fade.

### 5.2 Breathing sphere and horizon
The globe grows and shrinks 1.2% on an 8s cycle; the halo and the horizon glow breathe with it. *Implementation:*
see §2.7 clock; the horizon band's opacity is `calc(1 + 0.04 * var(--breath))` on a wrapper whose base alpha is
already in `--horizon`; JS writes `--breath` at 30fps. Off under still.

### 5.3 Ink settle (arriving in a city)
The globe drifts on a long lens, the seal-red marker ripples once as the flight lands, the city name writes
itself, and the rows settle like ink sinking into paper. *Implementation:* flight per §4.7; name
`clip-path: inset(0 100% 0 0) → inset(0 0 0 0)` over 700ms starting at 1400ms; rows `opacity 0→1`,
`translateY(6px) → 0`, 320ms, `animation-delay: calc(var(--i) * 40ms)` capped at 12; ripple per §4.3.
Under still: the name and rows appear with a 300ms fade.

### 5.4 Sheet from the horizon (mobile)
The list rises out of the horizon light; pulling it up gently pushes the city away. *Implementation:* §3.3
(native scroll-snap; `sheetProgress` → camera distance 2.2→2.6 and wrapper scale). The panel's top gradient uses
`var(--horizon)` so the evening itself brings you the list.

### 5.5 Compass whisper (around me)
Each row has a hairline needle pointing to the spot; turn the phone and the needles turn with a slow ease.
*Implementation:* inline `<svg aria-hidden width=12 height=12><line x1=6 y1=11 x2=6 y2=1/></svg>` with
`transform: rotate(calc((var(--bearing) - var(--heading)) * 1deg)); transition: transform 1200ms ease-in-out`.
`--bearing` per row from `lib/geo.bearingDeg`; `--heading` on the list root from `deviceorientationabsolute`
(Android) or `webkitCompassHeading` (iOS, after `DeviceOrientationEvent.requestPermission()` on the
`point the needles` word), low-pass filtered (α .15), unwrapped across 0/360, written at most once per frame.
Without heading: needles are north-up and the row header carries "N is up". Needles are never shown when the
origin is a city centre or a timezone guess — bearings from a pseudo-position would be lies.

### 5.6 Leader line (Sky list ↔ globe)
Hover or focus a city word in "now in the world" and a hairline draws itself from the word to the marker.
*Implementation:* one absolutely positioned `<svg aria-hidden>` over the Sky; path
`M x0 y0 H x0+18 L x1-12 y1 H x1` (word edge → projected marker), stroke ink 1px, `pathLength=1`,
`stroke-dashoffset 1 → 0` over 300ms; a 4px hollow circle at the globe end; hidden when
`dot(N, camDir) < 0.05` (fade 150ms). Re-projected each frame while the globe moves. Not rendered below 900px
(the word instead sets marker heat and the label appears).

### 5.7 The sun-rule (time dial)
A printed 24-hour hairline with sunrise/sunset ticks, a faint golden band and a small sun whose height follows
the sun's altitude; drag it and the horizon light, the terminator and the list order all move to that hour.
*Implementation:* §6.5. On input: `store.previewMinutes` → `uSun` recomputed for that city-local instant,
`--horizon` set with a 400ms transition, rank re-run, phase line prefixed "if it were 21:30 ·". Release without
`pin` returns to now after 10s (60s light transition). `pin` writes `?t=`. Mobile uses the thumbwheel ribbon
variant.

### 5.8 Stone (save)
Saving is an ink drop: the hollow 6px ring next to the word `save` fills from its centre over 240ms and the word
becomes `saved`; the pebble row on Stones gains one ellipse; the city's marker disc fills. *Implementation:* SVG
circle `r` 0→3 with `fill: var(--accent)`; `aria-pressed`; localStorage `paurk.saved.v1` (existing). No overshoot.

---

## 6. Components

All components live in `src/components/`. Names given are file names.

### 6.1 Header / wordmark (`Header.tsx`)
`<header>` 64px desktop / 56px mobile, paper, no rule. Left: `Paurk` in Cormorant italic 300, 28px desktop /
24px mobile, `--ink-2`; it is a `.word--quiet` linking to `#/`. Right: `.word--quiet`s a 44px search mark
(the app's one icon; opens the find panel, permanent on every screen, also bound to `/`, labelled
`Find a city or a place` for assistive tech), a bookmark mark carrying the count in mono beside it (no count at 0), labelled `Saved, 3 spots`; on the saved
screen the bookmark fills with the accent and takes `aria-current="page"`, because there is no text under a mark
to rule,
`about` (desktop only; on mobile lives in the Sky footer and sheet footer). On Sky the header is transparent
over paper; when the column scrolls beneath it, it becomes paper at 85% with blur.

### 6.2 Plate caption (`PlateCaption.tsx`)
One mono line, 12px, `--ink-2`, centred under the globe (desktop) / under the canvas (mobile), 8px air:
`plate · the world · 35 cities · 18:42 in lisbon` on Sky; `plate · lisbon · 12 places · 18:42 · golden hour`
on City. Purely printed; not interactive. It is the thing that makes the globe an object on a page.

### 6.3 The sky's city lists (`CityMenu.tsx` desktop, `WorldNow.tsx` phones)
Cities grouped by what the light is doing there right now (SunCalc per city, recomputed once a minute and shared
through `phase.worldNow`), each carrying its own countdown to whatever comes next there — sunset while the sun is
up, dark at dusk, sunrise once it is down. Within a group the soonest event leads, so the city about to lose its
light is at the top and the numbers read down in order.

**Desktop (`CityMenu`)** is the sky's left column: all 43 cities at once in three bands — `golden hour`, `night`
(night and dusk), `day` (everything else) — the current city in accent with `aria-current="page"`. Names are set
plain, not underlined: the row is the target and carries the affordance (§1.1). Hover and focus drive marker heat
on the globe.

**Phones (`WorldNow`)** cannot hold 43 rows above the fold, so it shows the three most interesting period groups,
four cities each, then `n more` and `all 43 cities`, all of which open the find panel (§6.4).

```
golden hour                    night
Melbourne    sunset in 2 min   Sydney         dark in 3 min
Tokyo       sunset in 47 min   Buenos Aires  sunrise in 1h 51m
```

### 6.3b The shell (`App.tsx`, `CityMenu.tsx`)
One canvas, two columns that trade places over it.

**The canvas is the page.** `.stage` is `position: fixed; inset: var(--header-h) 0 0 0` at every width. It used
to be a square element, which meant zooming the sphere eventually reached its edge and revealed the box. The
sphere's size now comes from `GlobeEngine.setFit(f)` — the fraction of the shorter viewport side it should span —
so it is a deliberate size on a canvas with no findable edge. `App.globeFrame()` computes `fit`, `seat` and the
sphere's pixel radius from the mode and the viewport; the radius is published as `--globe-r` and the seat as
`--seat-x` / `--seat-y` on `<main>`, which is how the ground shadow stays glued to a sphere that moves.

**The two columns.** `.side--cities` (the sky) is pinned left, `.side--spots` (a city, a spot, saved) is pinned
right; both are `var(--column)` wide, both stay mounted, and each slides on `transform` with `--d-panel` and
`--e-settle`. The arriving one carries a 120ms delay so the leaving one clears first, which is what makes it read
as a swap rather than a cross-fade. The hidden one is `inert`, so it is out of the tab order and out of the
accessibility tree — which is also why `CityMenu` renders its margin note only while it is the live column: two
mounted notes would race for the same queue.

**The sphere travels.** `setSeat(x, y, duration)` eases with a quintic rather than jumping, and `setFit` eases
exponentially, so opening a city is one movement: the column leaves, the sphere crosses, the new column arrives.
`data-still` snaps all three.

**Phones** keep the sheet (§3.3). There the sphere sits higher and smaller on a city screen, because the flight
zooms in by about half again and nothing clips it back any more; the sky stack and the city caption clear it by
calculation from `--seat-y` and `--globe-r` rather than by following it in the flow.

### 6.4 Find (`Find.tsx`)
The one way in besides the globe, opened by the permanent search mark in the header or by `/` from anywhere.
A native `<dialog>`: full-screen under 900px, and at 900px and up **the app's own right column** — `var(--column)`
wide, full height, pinned right, one hairline on its left edge, `::backdrop` paper at 70% so the globe stays
visible and its markers heat as you arrow down the list. Three grid rows — the head words, the field, the listbox —
so the panel never changes height and only the list scrolls.

The field is `.search` (22px Cormorant, hairline underline only, no box, no icon), placeholder
`a city, a park, a street`, `role="combobox"` with `aria-controls`, `aria-autocomplete="list"` and
`aria-activedescendant`. It autofocuses on a fine pointer only: on a phone the soft keyboard would bury the
standing list, which is the point of having one.

**Ranking** (`lib/search.ts`) scores each field in tiers — exact 100, prefix 70, word-start 45, substring 20 —
over city name and country, and over spot name, neighbourhood, category and vibes. Cities carry +8 so a city
outranks its own spots; the city on screen carries +12 so a local match wins. Ties break on lowkey score then
alphabetically, deliberately without consulting the clock: a time-based tiebreak would reshuffle the list under
an idle finger every minute.

**Row anatomy**, one shape for all four variants: the name (underlined — the row is the action, so no interactive
element is nested inside an `option`), the local clock and period in mono on the right (`03:12 · night`), a sub
line, and a tail. City rows put their countdown in the tail (`sunset in 41 min`); spot rows put an ochre
`caution after dark` there when the spot is flagged and its city is dark, because safety is never hidden by a
filter and a search is a filter (§6.11). The word that caused a match — a category, a vibe — is printed in the sub
with the accent underline, and is the one part that never truncates.

**Before a letter is typed** the list is already useful, in this order: a three-row light block (`good right now`
in the home city, or `awake somewhere else` when it is night there), `lately` from visited cities and saved spots,
then two loose options with no heading — the home city with its provenance printed (`from your clock` /
`nearest to you`, never applied automatically) and `around me` carrying §6.6's consent sentence *as its sub line*,
before the browser is ever asked — and last, `all 43 cities`, which switches the body to the region-grouped list.
The first row of the light block is pre-selected, so `/` then Enter can never fire a geolocation prompt.

**Keyboard**, handled on the dialog element rather than the input so a keyboard on a touch device works: arrows
move and wrap, Home/End jump (End then Enter is the one-keypress route to the full city list), PageUp/PageDown
move five, Enter opens, Escape closes in one press. A printable key pressed while the pane holds focus moves
focus to the field and is not swallowed. The active row is marked by a 2px ink rule down its left edge plus the
well and a full-ink underline — never colour alone.

This panel is the no-WebGL and the no-geolocation path: every city is reachable here without a globe and without
typing a letter.

### 6.5 "Whenever" time module (`SunRule.tsx`)
Desktop: a 380px-wide figure, 44px tall. A 1px hairline at y=28; hourly ticks (2px tall, `--hairline`), 6-hourly
ticks 5px in ink-2; a `--h-golden`-coloured band (alpha .35) over the golden-hour span; a 1px night hatch
(`repeating-linear-gradient(90deg, var(--hairline) 0 1px, transparent 1px 4px)`) before dawn and after dusk;
small sunrise/sunset ticks with mono labels `07:12` / `19:41` beneath; a 10px sun disc (accent) whose `y` is
`28 - 16 * sin(altitude)` clamped to the figure, so it dips under the line at night (then drawn as a hollow moon
ring). A vermilion hairline for *now* is not used — the sun *is* now unless previewing; while previewing, a 1px
ink tick marks now and the sun shows the previewed time.
Over the figure lies a fully transparent `<input type="range" min="0" max="1439" step="1">` (height 44px,
`opacity: 0`, `cursor: ew-resize`) with `aria-label="Time of day in Lisbon"`, `aria-valuetext="19:30, golden hour"`;
arrows = 1 min, Shift+arrows = 15, PageUp/Down = 60, Home = now. A `now` `.word` sits right of the figure while
previewing; a `pin` `.word` appears after release (writes `?t=`).
Mobile: a **thumbwheel ribbon** — a horizontal `overflow-x: auto; scroll-snap-type: x mandatory` strip, 44px tall,
of 15-minute ticks (96 items, 24px each) sliding under a fixed centre hairline, `scrollLeft` mapped to minutes;
sunrise/sunset ticks are labelled; the same range input sits under it for keyboard/AT (visually hidden). Edge fade
via `mask-image`.
Polar edge case (`sunInfo.polar`): the figure prints "the sun doesn't set today" / "doesn't rise today" instead of
ticks; the range still works.

### 6.6 "Around you" (`lib/locate.ts`, inside `Find.tsx`)
- `around me` is a row in the find panel (§6.4). Its sub line *is* the consent sentence — "We look at your
  location once, on this device. Nothing leaves it." — printed before activation, so the explanation precedes the
  prompt without a second tap. Activating it calls `getCurrentPosition`
  (`enableHighAccuracy: false, timeout: 8000, maximumAge: 300000`). Never asked at launch. Once refused on this
  device the row reads `try again`.
- Success within 80 km: ring on the globe, slerp, nearest city selected, panel closed; the city header becomes
  `around you · Lisbon · 18:42 · golden hour in 41 min`; the **compass row**: `you are 2.1 km east of the centre ·
  point the needles` (the last three words are a `.word` requesting heading on iOS; absent where not needed);
  accuracy > 2km appends `· approximate`.
- Further than 80 km: the panel stays open, prints `The nearest city we know is Porto, 312 km away.` and re-sorts
  the full city list by distance under one heading, `nearest to you`.
- Refused: the panel stays open, prints `no location — that is fine`, and falls back to the full city list.

- **Loupe** (desktop column and sheet header, 200px): an inline SVG circle of hairline rings from
  `lib/radar.layoutRadar(origin, spots)` (rings labelled in mono, e.g. `1 km · 2 km · 5 km`), the user as a
  4px ink cross at the centre, spots as 5px ink discs at bearing/√distance (accent for the currently
  hovered/focused row, filled ink for saved), a 12px `N` at the top. Rotates with `--heading` when available
  (1200ms ease). `aria-hidden`; the same information is in the rows' text.
- Rows show distance (chosen unit) + needle + walk time at 80 m/min; the accessible text reads `north-east, 1.2 km, 14 min walk`.
- > 80km: line + `open Porto` · `choose another`; ring stays on the globe.
- Refused/failed: §3.4. Rows then carry no distance at all, rather than an invented one from the city centre;
  no needles, no loupe.
- Position lives in memory only; unit choice in `paurk.units.v1`; the denial flag in `tc.geo.denied`.

### 6.7 Vibe filter control (`VibeRow.tsx`)
Behind one word. Nineteen chips laid out flat filled the head of the column and pushed the list below the fold, so
`vibes` is a disclosure: a `.word` with a small caret, `aria-expanded`, and the panel beneath it. The panel animates
on `grid-template-rows: 0fr → 1fr`, which gives a real height transition with nothing measured; its contents are
`inert` while closed. Escape closes it and stops there — the app reads a bare Escape on a city screen as "back to
the sky", so the handler calls `stopPropagation`.

**What is on is printed, never merely counted.** Beside the trigger sit the active words (`quiet + free`) and
`loosen all`. A closed panel must not be the only thing standing between the reader and a list that has quietly
been filtered.

Inside: one `.word` per vibe present in the city (dataset order), 13px ink-2 when off, ink + 2px accent underline
when on (`aria-pressed`), each followed by its live match count in mono 11px (`quiet 4`). Phase-suggested vibes
(§7.2) carry a small accent dot before the word (`· sunset`) — a suggestion, not a selection. Filtering is AND;
default is none engaged. Zero matches → the empty line (§3.4) and the counts show which word to loosen. Filters
never hide caution spots. State mirrored to `?v=` and announced through the margin note ("7 places match").

### 6.8 Spot list item (`SpotRow.tsx`)
A row of text separated by 1px hairlines, 20px air above and below, no chevron, whole row is one `<a>` to the spot
(the `<ul>` has `role=list`). Hover/focus well: `--well` bleeding 16px past the text, radius 6px.
```
Miradouro de Santa Catarina                          1.2 km ↗   (name: Cormorant 22 ink; right: mono 13 + needle)
Bica · viewpoint · outdoor                             ●●●●○     (ink-2 13; quiet meter: five 5px dots, filled ink for score)
quiet · sunset · free                                 caution   (vibe words ink-2; matching words ink + accent underline; caution word ochre mono)
because it is golden hour and this faces west                   (top three only: Zen Kaku 300 15px ink-2, from rank reasons)
open now · 14 min walk · arrive 19 min before sunset            (status line, moss when favourable; 'see hours' when unsure)
```
Without an origin the right column is empty — the cell stays, because the row is a grid. At night the
caution word reads `caution after dark`. Visually hidden text: `low-key 4 of 5`, `caution: <note>`.

### 6.9 Spot detail (`SpotPage.tsx`)
Order, in the column / full sheet: photo or poster (4:3 desktop, 3:2 mobile, radius 4px) → attribution (mono 11px
ink-2, a `.word` link: `photo · wikimedia commons · cc by-sa`, or `no photograph · poster drawn from the spot's
notes`) → name (Cormorant 34) → `Bica · viewpoint · outdoor · free` (ink-2 13) → right-now line (moss when
favourable: `open now · sunset in 38 min · 14 min walk · leave by 18:51`; ink-2 otherwise: `too far for tonight —
sunset 19:41 tomorrow`) → blurb (16/1.7, 60ch) → tip as a Cormorant 300 20px pull-line with a 1px ink-2 rule on its
left (16px inset) → `best at` heading (Cormorant 20) with time words in body text, the current one accent-underlined
→ `hours` heading, hours in mono, plus `open now` / `closed now` / `see hours` per §6.10 → `take care` (§6.11, when
present; placed after the tip by day, above it after dusk) → `sources` heading, each source a `.word` prefixed by its
kind in mono (`reddit · r/lisboa thread`) → final row of three `.word`s: `save` (§5.8), `share`, `breathe here`.
Mobile sticky bar: 48px, `← list` and `save`, paper 85% + blur. Focus lands on the name (`tabindex=-1`) on open.

### 6.10 Hours confidence (`lib/hours.ts`, new)
`parseHours(text, tz, sunInfo) → { status: 'open' | 'closed' | 'unknown', confidence: 'high' | 'low' }`. Recognised
patterns: `24 hours`, `always open`, `dawn–dusk` / `sunrise to sunset` (via SunCalc), `HH:MM–HH:MM` with optional
day ranges (`Mon–Fri 08:00–20:00, Sat 10:00–18:00`). Anything else → `unknown`. The UI prints `open now` (moss) or
`closed now` (ink-2) **only** at high confidence; otherwise the word `see hours`. Ranking gives an open-now bonus only
at high confidence and no penalty for unknown.

### 6.11 Safety note (`TakeCare.tsx`)
Section titled `take care` (Cormorant 20, ink). The dataset's note at body size, ink, with a 1px ochre rule on its
left; the mono word `caution` (ochre) precedes it; after dusk it reads `caution after dark`. A 6px hollow ring, never
a triangle or exclamation mark, nothing red. No modal, no confirmation, no pulse. Screen-reader text: `caution: ` +
note. Filters cannot hide caution spots; there is no "safe only" toggle. At night the list is split rather than
filtered: caution spots sink below a hairline with the heading `better in daylight · 3` (Cormorant 20).

### 6.12 Photo + procedural fallback (`SpotImage.tsx`, `SumiPoster.tsx`)
- The **Sumi poster** is always painted first, as an inline `<svg role="img" aria-label="Poster for {name}" viewBox="0 0 400 300">`,
  deterministic from `mulberry32(hash(spot.id))`: paper rect; a horizon-light gradient for the spot's first
  `bestTime` (golden → apricot, morning → pale rose, night → slate, afternoon → warm grey) with `mix-blend-mode:
  multiply` at .5; one ink-wash horizon path (6–9 anchors jittered ±4px, stroke ink .55 alpha, width 1.2,
  `feTurbulence(baseFrequency .012 .04, numOctaves 2)` + `feDisplacementMap(scale 6)`); one category form in
  graphite at .18–.28 alpha (waterfront/beach: 3–5 blurred wash bands below the line; viewpoint/rooftop/trail: a low
  ridge polygon; park/garden: one or two soft canopy circles; cafe/library/bookstore/indoor/museum: a tall window
  rect with a vertical light gradient; plaza/market: a row of small squares; other: the horizon alone); the **seal**:
  an accent circle r=9 positioned by bestTime (low-left for morning, low-right for golden, high for afternoon, a
  hollow ring with three 1px star dots for night); grain `feTurbulence .8 → feColorMatrix` alpha .06; caption: city
  name in Cormorant italic 11px… — *Cormorant floor rule applies*: the caption is DM Mono 11px ink-2 instead.
  Filters are defined once in a hidden root `<svg>`; list thumbnails (if ever needed) use a 12-element variant.
- The **photo** (`lib/photos.ts`, Wikipedia REST summary, requested at 800px, `crossorigin="anonymous"`,
  `loading="lazy"`, `decoding="async"`) is accepted only if width ≥ 640 and aspect 0.7–2.2; otherwise the poster
  stays. On accept it crossfades in over 900ms above the poster, with `filter: saturate(.6) contrast(.95)` and a
  paper multiply overlay (`::after`, `background: var(--bg)`, `mix-blend-mode: multiply`, opacity .18). A
  `see original` `.word` under the attribution removes filter and overlay for that image (240ms).
- `alt` = spot name + Wikipedia title. Photos of saved spots are added to the Cache API on save (P1).

### 6.13 Margin note (`MarginNote.tsx`) — toast, narrator and announcer in one
One fixed region: under the phase line on Sky/desktop column, above the sheet handle on mobile (never over the
photo). `<p role="status" aria-live="polite" aria-atomic="true">`, Zen Kaku 300 13px ink-2, one line, max ~60ch.
Each new line enters with `clip-path: inset(0 100% 0 0) → inset(0 0 0 0)` over 320ms (DOM text is complete
immediately; no typewriter). A queue delivers at most one line per 1.2s; identical consecutive lines are dropped;
phase-change lines at most once per five minutes. It carries: hints in context, geolocation outcomes, `link copied`,
`saved · 4 in all`, filter counts, `offline`, and the time-preview notice. There is no other toast.

### 6.14 Saved list (`StonesPage.tsx`)
Headed by a **pebble row**: one 10×7px ink ellipse per stone (max 40, then `+n`), `aria-hidden`, with the visible
text `4 saved in 2 cities`. Then the list grouped by city (city name Cormorant 28 as group heading, each a
`.word` to `#/c/…`), rows per §6.8 with the city's *current* phase driving the reason lines. Empty state: the one
line in §3.4. On the globe, cities with saved spots show the filled disc.

### 6.15 Share (`ShareWord.tsx`)
The `.word` `share` copies `location.origin + location.pathname + '#/s/<city>/<spot>'` (plus `?t=` if pinned)
via `navigator.clipboard.writeText`; on iOS/Android with `navigator.share`, it calls `share({ title, url })`
instead. The word itself becomes `copied` in moss for 2s (240ms swap) and the margin note says `link copied`.
If both fail, the URL is shown selected in an inline input beneath the word.

### 6.16 Empty states
All are one sentence, in the list's own place, ink-2 16px, no illustration: see §10.

### 6.17 Breathe here (`BreatheOverlay.tsx`)
A native `<dialog>` covering the viewport in paper: the spot's name (Cormorant 34), a hollow ring
(SVG circle r=64, stroke ink 1px) scaling 1 → 1.35 → 1 on the shared 8s clock, the words `in` / `out` (Cormorant
22) fading at the turn, a 1px hairline progress across the bottom over 60s, and `close` (`.word`, top-right).
Escape or any tap closes. Under still: text cues only. Ends automatically at 60s with `that's one minute`.

---

## 7. Time-awareness logic

### 7.1 Sources of truth
- `lib/time.sunInfo(now, cityLatLng)` (existing) gives `period`, sunrise/sunset/golden times, countdowns,
  `daylight`, `polar`. `now` is the live clock (`useNow`, ticking each minute) *or* the time-dial preview.
- All displayed times use `Intl.DateTimeFormat(undefined, { timeZone: city.timezone, hour: '2-digit', minute: '2-digit', hour12: false })`.
- Sub-solar point (`lib/geo`) for `uSun`; recomputed every 60s or on dial input.
- Weather (`lib/weather.fetchWeather`, Open-Meteo, keyless): fetched once per 20 min per city/origin with a 4s
  `AbortController` timeout; failure is silent. Only `isRaining`, snow (codes 71–77) and `tempC < 5` are ever used.

### 7.2 Period table

| Period (`lib/time`) | Horizon band (`--horizon`, height) | Globe | Recommendation logic (`lib/rank`) | Suggested vibes (accent dot) | Headline copy (phase line) |
| --- | --- | --- | --- | --- | --- |
| night | `--h-night`, 60vh desktop / 55vh mobile | night side faces the viewer if that is where they are; dots at .32 | night/stargaze/skyline +3; caution −2.5 and split into `better in daylight`; outdoor non-night −2; indoor +1 | night · stargaze · cozy | `03:12 · night · sunrise in 3 h 40 min` |
| dawn | `--h-dawn`, 45vh | terminator crossing | sunrise/morning +3; quiet +1 | sunrise · quiet · water | `06:48 · dawn · sunrise in 24 min` |
| morning | `--h-morning`, 40vh | full day side | morning +2.5; quiet +1; study/library +1 | quiet · green · study | `09:30 · morning · a good time for the quiet ones` |
| midday | `--h-midday`, 35vh | — | green/indoor +1; afternoon +1; cozy/study +1 | green · study · rain-ok | `12:40 · midday · shade and libraries` |
| afternoon | `--h-afternoon`, 40vh | — | afternoon +2; people-watch +1 | people-watch · walk · picnic | `15:10 · afternoon · golden hour in 3 h 12 min` |
| golden (last 90 min before sunset; `--golden` ramps 0→1) | `--h-golden`, 45vh, band alpha ramps .24 → .42 with `--golden` | sphere's lower limb warms via `uHorizon` | golden-hour/sunset +3; view/skyline +1; `leave by` computed | sunset · view · water | `18:42 · golden hour in 41 min` (numeral at 56px when ≤ 90 min) / `19:05 · golden hour · sunset in 36 min` |
| dusk | `--h-dusk`, 50vh | terminator on the viewer's side | sunset +1.5 (afterglow); night +1.5; caution starts to sink | night · skyline · cozy | `20:07 · dusk · dark in 22 min` |

Modifiers (any period): raining → indoor/rain-ok +3.5, outdoor −3, phase line clause `· raining, indoor picks first`
with a three-diagonal-hairline SVG mark; snow → same as rain with `snowing`; `tempC < 5` → cozy +1, clause `· cold`;
distance (when an origin exists) +3 < 1 km, +2 < 3 km, +1 < 8 km, −2 > 40 km; open-now (high confidence) +1.5,
closed −4; low-key score × 0.6 base; explicit vibes +2.2 / −1.2 as today.

### 7.3 Copy assembly
The phase line is `HH:MM · <period word> · <next event>` where the next event is the soonest of golden hour,
sunset, dark (dusk end), sunrise, formatted `in 41 min` / `in 3 h 40 min`. When viewing a city far from the
user's own timezone the line reads `It is 03:12 in Tokyo — night` with a `show it at 09:00` `.word` that moves the
dial to the city's next morning. Preview prefix: `if it were 21:30 · …`. Offline suffix: `· offline`.
`leave by` = `sunset − walkMinutes − 10`, shown only when positive and the spot has a sunset/golden signal.
`arrive N min before sunset` = `sunset − (now + walkMinutes)` when positive; else
`too far for tonight — sunset HH:MM tomorrow`.

### 7.4 Theme and horizon rules
- `--horizon` changes only through the 60s transition (400ms while scrubbing). `--horizon-h` transitions over 60s too.
- The **paper never inverts by time**. Slate is applied only at load (`prefers-color-scheme: dark`) or by the
  `lights down` word; after sunset a margin-note line offers it once per session: `it is dark in Lisbon — lights down?`
  with a `.word`. A change made by the user is stored in `paurk.theme.v1` (`paper` | `slate` | `auto`).
- The golden numeral (56px Cormorant 400, tabular) appears under the globe (desktop) / above the actions (mobile)
  when golden hour is 0–90 min away, ticking per minute; `aria-live` announcements only every five minutes.

---

## 8. Extra features

| P | Feature | One-line spec |
| --- | --- | --- |
| P0 | Golden-hour countdown + phase line | §7.3; SunCalc per city; `useNow` per minute; 56px numeral within 90 min. |
| P0 | Time dial (sun-rule + ribbon) | §6.5; `store.previewMinutes`; `uSun`, `--horizon`, rank all follow; `?t=` pin. |
| P0 | "Now in the world" list | §6.3; per-city period every minute; the touch-first map of the globe. |
| P0 | Margin note | §6.13; the only toast/announcer. |
| P0 | Hours confidence | §6.10; `open now` only when sure, else `see hours`. |
| P0 | Around-you fallbacks | §6.6; the find panel / timezone guess / remembered denial; `approximate` labelling. |
| P0 | Sumi poster | §6.12; deterministic SVG, always painted first. |
| P0 | Arrive before sunset / leave by | §7.3; 80 m/min; shown in moss when actionable. |
| P1 | Compass loupe | §6.6; `lib/radar.layoutRadar`; heading rotation; only with a real origin. |
| P1 | Breathe here | §6.17; 60s, shared clock. |
| P1 | Route line | §4.5; last five hops. |
| P1 | Leader lines | §5.6; desktop only. |
| P1 | Offline saved | Hand-written service worker: precache `index.html`, JS/CSS chunks, `globe-dots.bin`, `spots.json`, Google Fonts CSS + woff2; Wikipedia thumbnails cache-on-fetch, stale-while-revalidate, 60-entry cap; `· offline` suffix from `navigator.onLine` + events. |
| P1 | Lights down / ambient | Keyboard `a` or About word: hides all but canvas, phase line and plate caption; slate tokens; `navigator.wakeLock` when available; exits on any key/tap; persists nothing except the theme choice if the user also picks it in About. |
| P2 | Postcard | Canvas 2D 1080×1350: paper, photo (`crossorigin`) or poster via SVG `Image`, phase line, name, a 160px d3-geo dot globe, deep link in mono; `toBlob → navigator.share({files})` else `<a download>`; tainted canvas → poster. Fonts via `document.fonts.ready`. |
| P2 | Good-window sentence | Intersect bestTimes × today's hours (high confidence) × hourly rain probability < 40% (Open-Meteo hourly) → `good 16:00–19:30 today` on the detail page. |
| P2 | Print sheet | `@media print`: hide canvas, horizon, dial; rows full width, `page-break-inside: avoid`; `a::after { content: ' (' attr(href) ')' }` for sources. |

---

## 9. Accessibility checklist

- [ ] All text pairs ≥ 4.5:1 in both themes (values in §2.1); seal `--accent` only on marks and ≥ 22px display; horizon band alpha ≤ .45; verified with the band at its densest phase (golden, night) in `scripts/qa/screenshot.mjs` by sampling computed colours.
- [ ] Every control is a word (`.word`) or has a word beside it; no icon-only controls; all hit boxes ≥ 44×44 (CI check on the 390px run).
- [ ] Underline = actionable, consistently; passive text never underlined.
- [ ] Focus visible everywhere: 2px ink outline, offset 2px; never removed. Globe focus shows the focused label as the ring.
- [ ] Globe: `tabindex=0`, `role=application`, `aria-roledescription=globe`, `aria-label`, arrow/±/Tab/Enter/Escape as §4.6; `aria-activedescendant` for the roving marker; the choose-a-city dialog is the full equivalent path.
- [ ] Landmarks: `header`, `main` (globe), `aside`/`complementary` (column/sheet), `dialog`s; each list is a `<ul>` with rows as links; headings in order (h1 wordmark visually hidden on inner screens, h2 city, h3 sections).
- [ ] Time dial is a real `<input type=range>` with `aria-valuetext` ("7:30 pm, golden hour"); ribbon and sun-rule are decorative.
- [ ] Vibe words are `<button aria-pressed>`; counts read as text.
- [ ] Bearings as text (`north-east, 1.2 km`); needles, loupe, quiet-meter dots and pebbles `aria-hidden` with visually hidden equivalents.
- [ ] One `aria-live=polite` region (margin note), throttled 1 line / 1.2s; phase changes ≤ 1 / 5 min; the golden numeral does not announce per tick.
- [ ] Images: `alt` = spot name + Wikipedia title; posters `role=img` with label; `see original` available.
- [ ] `prefers-reduced-motion` and the `still` toggle per §2.8; `prefers-color-scheme` respected at load; `forced-colors: active` keeps underlines and outlines (no colour-only state).
- [ ] Sheet detents reachable by keyboard (`show more`/`show less`); native scroll so screen readers see one document.
- [ ] Layout in `rem`, `min()`, `dvh`; tested at 200% zoom and 320px effective width; no horizontal scroll of the body.
- [ ] Safety copy honest and specific; caution never colour-only (word + ring + position in the list).
- [ ] Geolocation: never at launch; explanation before prompt; denial remembered; position never persisted.
- [ ] Dialogs are native `<dialog>` (focus trap, Escape, focus return).
- [ ] Tested with VoiceOver (iOS Safari), TalkBack (Chrome Android), NVDA (Firefox), at 2am with the phone at low brightness.

---

## 10. Copy & tone guide

**Voice.** Lowercase, calm, specific, short. Sentences, not labels. Numbers are honest and rounded to what a
person would say ("14 min walk", "about 2 km"). No exclamation marks. No emoji. No "discover", "explore", "vibe
check", "hidden gem". The word "chill" appears only in the app name. The screen never tells you how to feel.

**Wordmark:** `Paurk` (only capitalised word in the app besides proper nouns).

**Headline / phase-line examples**
- `18:42 · golden hour in 41 min`
- `19:05 · golden hour · sunset in 36 min`
- `20:07 · dusk · dark in 22 min`
- `03:12 · night · sunrise in 3 h 40 min`
- `It is 03:12 in Tokyo — night` + `show it at 09:00`
- `if it were 21:30 · night · sunrise in 8 h`
- `12:40 · midday · shade and libraries`
- `14:20 · afternoon · raining, indoor picks first`

**Margin-note lines**
- first visit: `drag the globe, or search`
- city: `12 places · 3 good right now · tap a row to open it`
- filters: `7 places match quiet + free` / `nothing matches quiet + water right now — loosen a word`
- geolocation: `looking once…` → `you are 2.1 km east of the centre` / `no location — that is fine`
- save: `saved · 4 in all` / `let go · 3 saved`
- share: `link copied`
- preview: `showing 21:30 · back to now in 10 s` · `pinned to 21:30`
- offline: `offline · showing what we have`
- night: `it is dark in Lisbon — lights down?`

**Reason lines (from `rank.reasons`, always start with "because")**
- `because it is golden hour and this faces west`
- `because it is raining and this is indoors`
- `because it is late and this stays lit`
- `because it is 900 m away`
- `because you asked for quiet and free`

**Status words**: `open now` · `closed now` · `see hours` · `free` · `paid` · `indoor` · `outdoor` · `caution` ·
`caution after dark` · `approximate` · `offline`.

**Empty states (one line each)**
- Saved: `Nothing saved yet. Save a spot and it will wait here.`
- Filter: `Nothing matches quiet + water here right now — loosen a word.`
- Photo: `no photograph · poster drawn from the spot's notes`
- Around you, far: `The nearest city we know is Porto, 312 km away.`
- Search in dialog: `No city called "Lisbn" — try the region list below.`
- Polar: `the sun doesn't set here today`

**Safety copy (honest, calm, never alarming)**
- List: `caution` / `caution after dark`
- Section title: `take care`
- Note style: the dataset's specific sentence, e.g. `well lit until 11pm; go with a friend after dark`,
  `the path behind the chapel is unlit; stay on the main terrace at night`
- Night split heading: `better in daylight · 3`
- About: `We only list public places. Caution notes are about lighting and company after dark, not about crime
  statistics. Check hours locally; things change.`
- Geolocation preface: `We look at your location once, on this device. Nothing leaves it.`

**Actions (always `.word`s, always lowercase)**: `around me` · `saved` · `about` · `save` ·
`saved` · `share` · `copied` · `breathe here` · `see original` · `point the needles` · `try again` · `open Porto` ·
`choose another` · `now` · `pin` · `another` · `show more` · `show less` · `lights down` · `still` · `km` / `mi` ·
`← sky` · `← Lisbon` · `← list` · `close` · `continue` · `not now`.

**About sheet (full text)**
> Paurk lists low-key public places to sit, walk or read — parks, waterfronts, viewpoints, quiet cafés,
> libraries, gardens. Picks change with the light: sunset spots before sunset, lit places after dark, indoor
> places in the rain. We only list public places. Caution notes are about lighting and company after dark, not
> about crime statistics. Check hours locally; things change. Photos come from Wikipedia and its contributors.
> Your saved spots stay in this browser. Your location is looked at once and never stored.
>
> `still` (no motion) · `lights down` · `km` / `mi`
