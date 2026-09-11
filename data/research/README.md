# Research files

One JSON file per city, written by the verify stage of the research workflow (see `docs/PLAN.md`).
`scripts/build-dataset.mjs` merges them into `src/data/spots.json`.

```jsonc
{
  "city": "New York City", "country": "United States", "slug": "new-york", "region": "americas",
  "cityLat": 40.7128, "cityLng": -74.006, "timezone": "America/New_York",
  "searchesRun": ["reddit New York City chill spots", "..."],
  "redditSourcedNotes": "which pages summarised reddit / local opinion",
  "spots": [{
    "name": "Elevated Acre", "neighborhood": "Financial District",
    "category": "park | garden | waterfront | viewpoint | beach | trail | plaza | rooftop | cafe | library | bookstore | museum | indoor | market | other",
    "vibes": ["quiet", "view", "free"],
    "blurb": "2-3 sentences", "tips": "1-2 practical sentences",
    "bestTimes": ["golden-hour"], "indoor": false, "free": true, "hours": "7am-10pm",
    "lat": 40.7042, "lng": -74.0079, "coordConfidence": "high | medium | low",
    "wikipediaTitle": "Elevated Acre",           // exact English Wikipedia title, drives the runtime photo; null if none
    "sources": [{ "url": "https://...", "label": "Gothamist: free NYC rooftops", "kind": "reddit | forum | blog | press | official | other" }],
    "safety": { "level": "ok | caution", "note": "calm, specific" },
    "lowkeyScore": 4,                            // 5 = locals-only, 1 = famous but still a good chill spot
    "verified": true, "verifyNote": ""
  }]
}
```

Policy: only real, publicly accessible places; no trespassing, abandoned sites, industrial/rail land or unlit isolated
spots; legitimate places with after-dark concerns are kept with `caution` and a specific mitigation note.
