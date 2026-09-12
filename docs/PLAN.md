# Paurk — plan

> All the low-key ("lwk") chill spots around you, on a globe. Chill wherever, whenever.

## 1. Goal

A static web app that helps someone find a genuinely low-key place to decompress: parks, waterfronts,
viewpoints, quiet cafés, libraries, public rooftops, gardens, beaches. It should feel calm, look unlike
any map app, and be honest about safety.

## 2. Constraints discovered before coding

| Constraint | Finding | Consequence |
| --- | --- | --- |
| Reddit access | reddit.com is blocked by the sandbox egress proxy, and Reddit also blocks the search tool's crawler. | Research queries are phrased Reddit-first so search engines surface Reddit-derived content re-published by other pages (Time Out "according to locals", Teamblind, forums, substacks, city-gov "hidden gems"). Every spot cites only URLs that actually appeared in search results. |
| Wikipedia / Commons | Blocked from the sandbox, but reachable from the user's browser (CORS-enabled public API). | Photos are loaded at runtime from the English Wikipedia REST API using a verified article title per spot; a procedural fallback covers spots with no article or no image. |
| Map tiles | No paid/keyed map providers. | The globe is fully procedural: vector land from `world-atlas` sampled into a dot matrix at build time; the intra-city view is a distance/bearing "radar" instead of a basemap. |
| Fonts / CDNs | Google Fonts reachable; other CDNs blocked. | All JS is bundled by Vite; only fonts are external. |
| Hosting | Static only. | Vite build to `dist/`; hash-based routing for deep links; no backend. |

## 3. Research method (see `data/research-report.md` for the results)

1. **Research agent per city** (43 cities across the Americas, Europe/Africa and Asia-Pacific). Each ran ≥9 web
   searches: reddit-phrased queries (`reddit <city> chill spots`, `r/<sub> quiet places to relax`, hidden gems,
   best free sunset spot), plus reading spots, quiet cafés, free rooftops, secret gardens and safe waterfront walks.
   Output: 11–14 candidate spots with blurb, tips, best times, hours, coordinates, sources, safety note, low-key score.
2. **Skeptical verify agent per city**: confirms each place exists and is public, applies the safety policy
   (no trespassing, no abandoned sites, no unlit isolated areas; legitimate places with after-dark concerns are kept
   with a calm, specific `caution` note), sanity-checks coordinates against the city centre, confirms the Wikipedia
   title refers to *this* place (it drives the photo), strips unverifiable sources, then writes `data/research/<city>.json`.
3. **Build-time merge** (`scripts/build-dataset.mjs`): validates fields, dedupes, drops anything >80 km from the city
   centre, and writes `src/data/spots.json` plus a human-readable report.

## 4. Design method (see `docs/DESIGN.md`)

Six independent UI/UX concepts were generated from deliberately different angles (editorial print, analog
instrument, cinematic night, playful cartography, zen minimal, soft brutalism). Three judges with different lenses
(product designer, creative director, front-end engineer) scored uniqueness, usability, feasibility, "chill fit" and
mobile. The winner was synthesised into the final spec, grafting the best runner-up ideas.

## 5. Architecture

```
scripts/
  build-globe-dots.mjs   Fibonacci-sphere sampling of world-atlas land -> public/globe-dots.bin (Int16 lat/lng)
  build-dataset.mjs      data/research/*.json -> src/data/spots.json + data/research-report.md
  qa/screenshot.mjs      headless Chromium screenshots (desktop + phone) with console-error capture
src/
  globe/GlobeEngine.ts   three.js: dot-matrix land, live day/night terminator, atmosphere, instanced markers,
                         inertia drag, pinch/wheel zoom, keyboard, fly-to choreography, projected HTML labels
  lib/geo.ts             haversine, bearing, compass, local projection, sub-solar point
  lib/time.ts            SunCalc periods (night/dawn/morning/midday/afternoon/golden/dusk), countdowns
  lib/rank.ts            "right now" scoring: time of day x weather x vibes x distance, with reasons
  lib/photos.ts          Wikipedia REST photo loader with localStorage cache + Commons attribution link
  lib/weather.ts         optional Open-Meteo current conditions (keyless)
  lib/router.ts          hash deep links (#/c/<city>, #/s/<city>/<spot>, #/saved)
  store.ts               tiny external store (useSyncExternalStore), persisted favourites + units
  components/            UI per docs/DESIGN.md
```

## 6. Features

- **Globe** as hero and navigation; cities as markers sized by spot count; live day/night terminator.
- **Around you**: geolocation → nearest city, spots sorted by a "right now" score with distance, bearing, walk time;
  manual city pick when permission is denied or unsupported.
- **Whenever**: local sunrise/sunset drives the theme and recommendations; golden-hour countdown; time dial to scrub
  the day and see how the picks (and the globe's terminator) change.
- **Weather-aware** (optional): rain → indoor / rain-ok spots float up.
- **Vibe filters**: quiet, sunset, night, view, water, green, cozy, rain-ok, solo, group, free, people-watch, study, stargaze…
- **Spot detail**: runtime photo with attribution or procedural poster, blurb, tips, hours, best times, safety note,
  community sources.
- **Stash** (favourites, localStorage) and **share** links.
- **Serendipity**: a daily pick per city and a "surprise me" shuffle.
- **Accessibility**: keyboard globe control, reduced-motion mode, focus states, 4.5:1 body contrast, semantic panels.

## 7. Safety policy

Excluded outright: trespassing rooftops, abandoned/derelict sites, active industrial or rail land, unlit isolated
spots, bar-only or nightclub venues. Kept with a visible, calm `caution` note: legitimate public places with real
after-dark concerns (e.g. "well lit until 11pm; go with a friend after dark"). Night-time recommendations penalise
caution spots. Coordinates are approximate (marked with a confidence level); users are asked to check hours locally.

## 8. QA

- `npm run typecheck` and `npm run build` must pass.
- Headless Chromium screenshots at 1440×900 and 390×844 with zero console errors.
- An adversarial code-review workflow over the final diff; confirmed findings fixed before push.
