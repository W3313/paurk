# Fonts

Three families are self-hosted here, subset to latin and latin-ext. They are served from this origin
rather than from Google's CDN because fetching them cross-origin cost 12.6 s to first paint on a cold
cache against 0.2 s from here.

| Family | Files | Licence | Upstream |
| --- | --- | --- | --- |
| Cormorant Garamond | `cormorant-*.woff2` (6) | SIL OFL 1.1 — `OFL-CormorantGaramond.txt` | [CatharsisFonts/Cormorant](https://github.com/CatharsisFonts/Cormorant) |
| DM Mono | `dm-mono-*.woff2` (4) | SIL OFL 1.1 — `OFL-DMMono.txt` | [googlefonts/dm-mono](https://github.com/googlefonts/dm-mono) |
| Zen Kaku Gothic New | `zen-kaku-*.woff2` (6) | SIL OFL 1.1 — `OFL-ZenKakuGothicNew.txt` | [googlefonts/zen-kakugothic](https://github.com/googlefonts/zen-kakugothic) |

The OFL requires its text to travel with the font whenever the font is redistributed, which is what
publishing this repository does. The three `OFL-*.txt` files are the upstream licences unmodified; the
copyright line in each matches the `name` table inside the corresponding `.woff2`.

The OFL also reserves the right to the original names: these files are subsets, not modifications, and
they are served under the families' own names, which is what the licence permits. Do not rename a
derivative to something containing "Cormorant", "DM Mono" or "Zen Kaku Gothic" if you change the
outlines.
