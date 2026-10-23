# Asset provenance

A commercial build needs a chain of title for every byte you ship. This file
records the origin and licence status of each binary asset in the repository,
and what you must do about it before selling anything.

Legend: **CLEAN** = origin known and licence permits commercial use, attribution
handled. **VERIFY** = origin not recorded in the repository; action required
before commercial distribution.

---

## CLEAN — code & type

| Asset | Origin | Licence | Status |
| --- | --- | --- | --- |
| `js/vendor/peerjs.min.js` | peerjs.com release bundle | MIT | notice kept in `js/vendor/peerjs.LICENSE.txt` |
| `js/vendor/confetti.browser.js` | canvas-confetti release bundle | ISC | notice kept in `js/vendor/canvas-confetti.LICENSE.txt` |
| `fonts/inter-latin-{400,500,600,700}-normal.woff2` | Inter Project (latin subset) | SIL OFL 1.1 | notice kept in `fonts/OFL.txt` |
| `assets/favicon.svg` | generated for this project (geometric diamond mark) | MIT with the repo | clean |
| `assets/icon-{192,512}{,-maskable}.png`, `assets/apple-touch-icon.png` | generated from the same mark for this project | MIT with the repo | clean |

The icon set is a simple original geometric mark (rounded diamond on ink), drawn
for this repository. It is not a copy of any registered device or brand mark
known to the author. Before a large commercial launch you should still run a
trademark search on whatever *name and logo* you ship under — that is a name
search, not a copyright question, and it is outside what a licence can clear.

## CLEAN — text data

| Asset | Origin | Licence | Status |
| --- | --- | --- | --- |
| `js/datasets.js` word banks | factual names + original captions written for this project | MIT with the repo | clean |
| `manifest.json`, `sw.js`, all `js/`, `css/`, `scripts/` | written for this project | MIT with the repo | clean |

## VERIFY — photography

| Asset | Size | Origin recorded in repo | Status |
| --- | --- | --- | --- |
| `assets/img/hero-dunes.jpg` | 800×1434 | **none** — EXIF/XMP stripped | VERIFY |
| `assets/img/hero-ridge.jpg` | 800×1434 | **none** — EXIF/XMP stripped | VERIFY |
| `assets/img/card-coast.jpg` | 800×1434 | **none** — EXIF/XMP stripped | VERIFY |
| `assets/img/card-camp.jpg` | 800×1434 | **none** — EXIF/XMP stripped | VERIFY |

These four photographs were present in the repository from its first commit with
all metadata stripped, so no licence statement travelled with them. That is the
**single unresolved commercial risk in this repository.** Stripped metadata does
not itself imply a problem, but it means nobody can prove the images are free to
sell from the repo alone.

You have three ways to close it, in increasing order of safety:

1. **Trace them.** If you know where they came from (a stock purchase, your own
   camera, a permissive library), write the source, licence and invoice or
   download link into the table above and change their status to CLEAN.
2. **Replace them.** The cleanest option. Point `art` in `brand.config.js` at
   four images you own the rights to — your own photography, a licensed stock
   pack, or generated artwork with a commercial-use grant — and delete these
   files. Nothing else in the codebase needs to change:

   ```js
   art: {
     dunes: "assets/img/my-hero.jpg",
     ridge: "assets/img/my-home.jpg",
     coast: "assets/img/my-card-1.jpg",
     camp:  "assets/img/my-card-2.jpg"
   }
   ```

   `js/cards.js` reads those keys, and `index.html` / `manifest.json` reference
   the same set, so a swap touches config only.
3. **Ship without them.** Set `art: null`-safe behaviour is not provided on
   purpose; if you delete the files you must repoint `art`, because the service
   worker precache list (`sw.js`) and `npm run check` will fail on missing
   references — that failure is the safety net.

Until one of these is done, treat this repository as **free to use, modify and
distribute, but not yet cleared to sell with these four photographs included**.

---

## How the app keeps assets honest

- `scripts/check-site.mjs` fails the build if any `src`/`href`/`url()`/manifest
  icon/precache entry points at a missing file or a root-absolute path.
- `sw.js` precaches exactly the list it validates; a renamed photo that is not
  updated there surfaces as a check failure, not as a silent offline break.
- `npm run rebrand -- --check` fails if the static identity (title, meta,
  manifest name/colours) has drifted from `brand.config.js`, so a rebranded
  build cannot ship half-renamed.
