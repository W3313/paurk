# TrueChiller

> Somewhere to breathe, wherever, whenever.

All the low-key ("lwk") chill spots around you, on a globe. A static web app: a matte porcelain globe on warm
paper shows 43 cities; pick one (or say *around me*) and get a ranked list of quiet parks, waterfronts,
viewpoints, gardens, cafés, libraries and public rooftops for **right now**: the time of day, the sun, the
weather and your distance all change the order and the words.

- **Plan:** `docs/PLAN.md` · **Design spec:** `docs/DESIGN.md` · **Research report:** `data/research-report.md`
- **Data:** `data/research/<city>.json` (one file per city, with sources and safety notes) → `src/data/spots.json`

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve dist/ on :4173
npm test           # vitest unit tests (geo, sun times, ranking, hours parser, poster, photos)
npm run shots      # headless Chromium screenshots + 44px tap-target check (needs `vite preview` running)
npm run build:data # regenerate src/data/spots.json and public/globe-dots.bin from data/research and world-atlas
```

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml` (set `VITE_BASE` when the site is served
from a sub-path).

## What it does

| | |
| --- | --- |
| **Globe** | Custom three.js: dot-matrix land sampled from `world-atlas` at build time, the real day/night terminator (sub-solar point, refreshed every minute), a pencil halo, an 8-second breath, ring markers for cities, a dotted route of the cities you have visited this session. Drag, pinch/scroll, arrow keys, page up/down to step between cities, Enter/Escape. Falls back to a 2D `d3-geo` drawing without WebGL. |
| **Around me** | Asked only when you tap *around me* and *continue*; looked at once, never stored. Finds the nearest city within 80 km, shows distance, walking time and a compass needle per spot, plus a compass loupe of the spots around you. Denied or unsupported: choose a city, with a guess from your clock's time zone. |
| **Whenever** | Sunrise, sunset and golden hour are computed on the device (SunCalc) per city. The horizon light on the page and the sphere follow the phase of day; a *sun-rule* dial lets you scrub the day (and pin a time into the link) to see what the picks would be at 21:30. |
| **Ranking** | "Right now" scoring: period of day × weather (Open-Meteo, keyless, optional) × your chosen vibes × distance × hours confidence. Every top pick explains itself in one line starting with *because*. At night, spots with a caution note sink below *better in daylight*. |
| **Spot page** | A deterministic *Sumi poster* is painted first; a photograph from the spot's Wikipedia article loads over it when one exists (fetched in your browser from Wikipedia's public API, with a Commons attribution link). Blurb, tip, best times, hours (*open now* only when the hours are unambiguous, otherwise *see hours*), *take care* note, sources, save, share, *breathe here*. |
| **Stones** | Saved spots (localStorage) grouped by city; the globe fills the disc of cities that hold stones. |
| **Access** | Every control is an underlined word with a 44 px hit box (checked in CI by `scripts/qa/screenshot.mjs`); native dialogs; one polite live region; reduced-motion (*still*) mode; paper and slate themes; 4.5:1 text contrast under every horizon colour. |

## How the spots were gathered

The brief asked for research through Reddit. Reddit is not reachable from the environment this was built in
(the egress proxy blocks it and Reddit blocks the search tool's crawler), so:

1. **One research agent per city** ran at least nine web searches phrased Reddit-first (`reddit <city> chill spots`,
   `r/<sub> quiet places to relax`, hidden gems locals only, best free sunset spot, reading spots, quiet cafés,
   free rooftops, secret gardens, safe waterfront walks). Search engines surface Reddit-derived opinion through
   pages that republish it (Time Out "according to locals", city-hall "hidden gems" surveys, Teamblind, forums,
   substacks), and those are the sources cited. **No URL is cited unless it appeared in a search result.**
2. **One skeptical verify agent per city** confirmed each place exists and is public, applied the safety policy,
   sanity-checked coordinates against the city centre, confirmed the Wikipedia title that drives the photo, and
   wrote the file. Where the verify stage could not search (budget or session limits), it says so inside the
   file, and the build marks those spots `verified: false`; the app labels the city list accordingly.
3. `scripts/build-dataset.mjs` validates, de-duplicates and drops anything more than 80 km from its city.

Coordinates are approximate (each carries a confidence level). Hours change; the app only says *open now* when
the hours text is unambiguous.

## Safety policy

Only public places. Excluded: anything involving trespassing, abandoned or derelict sites, active industrial or
rail land, unlit isolated spots, bar-only or club venues. Legitimate public places with real after-dark concerns
are kept with a calm, specific *take care* note (lighting, company, terrain), shown as a word and a hollow ring,
never a red triangle. Night-time picks penalise caution spots and list them under *better in daylight*.

## Stack

Vite 8 · React 19 · TypeScript · three.js · d3-geo / topojson / world-atlas · SunCalc · vitest · Playwright (QA)
· Google Fonts (Cormorant Garamond, Zen Kaku Gothic New, DM Mono). No backend, no map tiles, no keys.
