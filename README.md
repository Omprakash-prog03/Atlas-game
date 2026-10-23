# ATLAS — word-chain card game

A word-chain game built as an installable mobile app. Name a place, a film, an animal — the answer
becomes a card with its icon, the card swipes away, and the chain continues from its last letter.

- **Live:** <https://omprakash-prog03.github.io/Atlas-game/>
- **No build step, no accounts, no server to run.** The repository root is the deployable site.
- **MIT-licensed and commercial-ready.** See [COMMERCIAL.md](COMMERCIAL.md), [LICENSE](LICENSE),
  [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and [assets/PROVENANCE.md](assets/PROVENANCE.md).

---

## What it does

| | |
| --- | --- |
| **Card deck** | Each answer fills the waiting card with its icon and photo, then swipes off the table. The next empty card is already underneath. |
| **Six worlds** | Places · Cities · Countries · Movies · Animals · Food — ~700 curated entries in total. |
| **Live validation** | Every keystroke is checked against the deck: right letter, real entry, not already played. Invalid answers never advance the turn. |
| **No repeats** | Every card used in a match is burned for that match. |
| **Scoring** | 10 points per card, up to +5 for speed, bonuses for streaks and for long names. |
| **Combo economy** | Every accepted card adds a link to the table chain: ×1.25 at 3, ×1.5 at 5, ×2 at 8, ×2.5 at 12, ×3 at 16. A timeout freezes the chain; a pass cools it by one. |
| **Energy & power-ups** | Good cards charge energy. Spend it on Hint, Freeze, Double, Wild and Shield — each with a cost, a per-match charge limit and a two-per-turn cap. |
| **House skill tiers** | Relaxed, Sharp and Ruthless house players: different tempo, different greed for the length bonus, and their own energy to spend on powers. |
| **Ranking** | Per-world best scores, match history, wins, points and a level that grows with your total. Stored on the device. |
| **Rounds** | A round ends when every surviving player has played once. Three strikes eliminate a player; last one standing wins. |
| **Multiplayer** | Real peer-to-peer rooms: host a room, share a 5-letter code, play across phones. Power-ups are host-authoritative and sync like every other action. |
| **Offline / installable** | Service worker, app manifest, maskable icons, safe-area layout, wake-lock during matches. |
| **White-label** | One config file (`brand.config.js`) renames, recolours and re-features the whole product; `npm run rebrand` pushes it into the static files. |

### The economy in one paragraph

Every accepted card adds a link to the **table combo**, and the combo sets a multiplier the whole
table rides — so keeping the chain alive is a shared incentive, and letting it die is a shared
loss. Cards also charge your personal **energy** meter (+1 for landing it, +1 for speed, +1 for a
long name, +1 while the chain is hot; you start with 3 and hold at most 10). Energy buys five
power-ups: **Hint** (a masked answer for the current letter), **Freeze** (+8s on your clock),
**Double** (your next card scores ×2 — but time out while it is armed and you lose it *and* 2
energy), **Wild** (swap the required letter for any letter that still has answers) and **Shield**
(absorb your next strike). Two powers per turn, limited charges per match. Everything lives in the
serializable match state, so a power-up syncs across phones exactly like a submitted word — and the
match's random choices run off a seeded stream, so host and guest always agree.

### How the rules are enforced

`js/engine.js` is a pure, serializable state machine — no DOM, no timers, no hidden randomness:

```text
lobby ──start──▶ playing ──submit/pass/timeout──▶ next turn
                    │                               │
                    │        everyone played?       │
                    ├────────── round + 1 ◀─────────┘
                    │
                    └── one survivor / round cap ──▶ match_end
```

Every action returns `{ ok, error, reason, state }`, and the same functions run on the host, on a
guest (for instant local validation) and in the unit tests.

---

## Multiplayer, honestly

GitHub Pages is static, so there is no game server. ATLAS connects phones **peer-to-peer** with
[PeerJS](https://peerjs.com/): the host's device owns the authoritative match, guests send intents
and receive snapshots. Only a lightweight signalling handshake touches a public server; the game
traffic is direct.

- Host: *Play with friends → Create a room* → share the 5-letter code.
- Guest: *I have a room code* → enter it and join.
- The host starts the match once at least two players are in.

**Limits you should know**

- Both devices need an internet connection, and the site must be served over **HTTPS** (GitHub Pages is).
- If the host leaves, the room closes. There is no server to migrate it.
- Signalling uses the free public PeerJS cloud. If it is unavailable, the app tells you and solo play still works.

Offline matches (against house players or pass-and-play) work with no connection at all.

---

## Project layout

```
index.html              App shell: every screen lives here
404.html                Self-contained not-found page (deep-path safe redirect)
terms.html              Terms of use (commercial-readiness)
privacy.html            Privacy policy: no accounts, no tracking, device-only
manifest.json           PWA manifest (icons, shortcuts, screenshots)
sw.js                   Service worker: app-shell precache + runtime caching
.nojekyll               Serve files as-is, no Jekyll pass
brand.config.js         WHITE-LABEL CONFIG: name, palette, features, art, legal
LICENSE                 MIT licence for the whole repository
THIRD-PARTY-NOTICES.md  Attribution for PeerJS, canvas-confetti and Inter
COMMERCIAL.md           Guide to rebranding, hosting and selling a build
css/atlas.css           Design system (tokens, screens, deck, sheets, tray)
js/brand.js             Applies brand.config.js to the live document
js/datasets.js          Word banks: word + emoji + caption per category
js/engine.js            Pure rules: turns, rounds, scoring, combo + power-ups
js/cards.js             Card art resolver + deck component (deal / swipe)
js/profile.js           Local profile, stats, ranking, history, economy totals
js/bots.js              House players: three skill tiers that use the economy
js/net.js               PeerJS transport (host + guest)
js/ui.js                Screens, deck wiring, timer, tray, room controller
js/pwa.js               Service-worker registration + install prompt
js/sound-engine.js      Procedural Web Audio sounds
js/vendor/              PeerJS + canvas-confetti, vendored (no CDN at runtime)
fonts/                  Inter (self-hosted, offline safe) + fonts/OFL.txt
assets/                 Icons, favicons, photography + assets/PROVENANCE.md
scripts/                Dev server, validators, rebrand tool and tests
.github/workflows/      CI verification + GitHub Pages deployment
```

---

## Develop

```bash
npm install          # only for the tests (jsdom)
npm start            # http://localhost:8080/Atlas-game/  — mirrors GitHub Pages
```

`npm start` serves the site under `/Atlas-game/`, exactly like GitHub Pages. That subpath is where
broken asset paths show up, so test there rather than at a domain root.

### Tests

```bash
npm run check        # every src/href/url()/manifest icon/SW precache entry resolves + brand sync
npm run rebrand      # push brand.config.js identity into the static files
npm run rebrand:check# CI mode: fail if any static identity drifted from the config
npm test             # 44 engine tests: rules, scoring, combo tiers, every power-up
npm run test:ui      # 61 checks: onboarding → deck → validation → tray → swipe → results
npm run test:net     # 30 checks: two clients, real room handshake, synced turns
npm run test:all     # check + rebrand:check + engine + ui + net
```

CI runs the same commands on every push and pull request (`.github/workflows/site-check.yml`),
and `.github/workflows/deploy.yml` runs them again **before** publishing to GitHub Pages, so a
broken or half-rebranded build can never reach production.

---

## Deploy to GitHub Pages

**Option A — Actions (recommended, set up in this repo):**

1. **Settings → Pages → Source: `GitHub Actions`.**
2. Push to `main` (or run the workflow manually). `.github/workflows/deploy.yml` verifies the site
   and publishes the repository root. The URL stays `https://<user>.github.io/<repo>/`.

**Option B — Deploy from a branch (no Actions):**

1. **Settings → Pages → Source: `Deploy from a branch` → Branch (your deploy branch) → Folder `/ (root)`.**
2. Any push to that branch publishes the root as-is. This is how a feature branch can go live
   immediately, before it is merged.

Keep local references **relative**. A leading slash resolves to the domain root and breaks project
pages:

| Reference | Resolves to | |
| --- | --- | --- |
| `css/atlas.css` | `https://<user>.github.io/<repo>/css/atlas.css` | ✅ |
| `/css/atlas.css` | `https://<user>.github.io/css/atlas.css` | ❌ 404 |

`npm run check` fails on root-absolute paths and on missing files.

### After a deploy

Asset links carry `?v=4` and the service worker caches the shell. When you change CSS/JS:

1. Bump `?v=4` to `?v=5` in `index.html`.
2. Bump `VERSION` in `sw.js` (`atlas-v4.0.0` → `atlas-v4.0.1`) so installed apps refresh their cache.

---

## Editing the game

- **Add words:** `js/datasets.js` → `["WORD", "🎯", "Caption"]`. Run `npm test`; the suite fails if any
  word ends with a letter that has no continuation in the same category.
- **Tune rules:** `js/engine.js` → `DEFAULTS` (turn timer, passes, strikes, round cap) and
  `scoreFor()` for the point curve.
- **Tune the economy:** `js/engine.js` → `DEFAULTS` (`startEnergy`, `maxEnergy`, `freezeSeconds`,
  `maxPowersPerTurn`, `doublePenalty`), `COMBO_TIERS` for the heat curve, and `POWERS` for costs,
  charge limits and copy. The UI reads all of it from the engine — no hard-coded numbers in `ui.js`.
- **Tune house players:** `js/bots.js` → `PROFILES` (think time, power appetite, greed, slip rate).
- **Restyle / rename / re-feature:** edit `brand.config.js`, then `npm run rebrand`. Palette keys map
  1:1 onto the CSS custom properties in `css/atlas.css`; `features` switches whole subsystems off.
- **Swap photography:** `brand.config.js` → `art`, then `npm run rebrand`. Read
  `assets/PROVENANCE.md` first — the bundled photos are the one item without a recorded licence.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Page loads unstyled | Stylesheet 404 — path does not match the file | Keep `css/atlas.css`; run `npm run check` |
| No install prompt | No service worker, or not HTTPS | `sw.js` must be reachable from the site root |
| “Room not found” | Wrong code, host closed the room, or signalling is blocked | Re-check the code; both devices online |
| Old styling after deploy | Browser / service-worker cache | Bump `?v=` and `VERSION`, then reload |
| Stats disappeared | Private mode or cleared storage | Stats live in `localStorage` on the device |
