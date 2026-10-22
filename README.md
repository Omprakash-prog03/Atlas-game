# ATLAS — word-chain card game

A word-chain game built as an installable mobile app. Name a place, a film, an animal — the answer
becomes a card with its icon, the card swipes away, and the chain continues from its last letter.

- **Live:** <https://omprakash-prog03.github.io/Atlas-game/>
- **No build step, no accounts, no server to run.** The repository root is the deployable site.

---

## What it does

| | |
| --- | --- |
| **Card deck** | Each answer fills the waiting card with its icon and photo, then swipes off the table. The next empty card is already underneath. |
| **Six worlds** | Places · Cities · Countries · Movies · Animals · Food — ~700 curated entries in total. |
| **Live validation** | Every keystroke is checked against the deck: right letter, real entry, not already played. Invalid answers never advance the turn. |
| **No repeats** | Every card used in a match is burned for that match. |
| **Scoring** | 10 points per card, up to +5 for speed, bonuses for streaks and for long names. |
| **Ranking** | Per-world best scores, match history, wins, points and a level that grows with your total. Stored on the device. |
| **Rounds** | A round ends when every surviving player has played once. Three strikes eliminate a player; last one standing wins. |
| **Multiplayer** | Real peer-to-peer rooms: host a room, share a 5-letter code, play across phones. |
| **Offline / installable** | Service worker, app manifest, maskable icons, safe-area layout, wake-lock during matches. |

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
manifest.json           PWA manifest (icons, shortcuts, screenshots)
sw.js                   Service worker: app-shell precache + runtime caching
.nojekyll               Serve files as-is, no Jekyll pass
css/atlas.css           Design system (tokens, screens, deck, sheets)
js/datasets.js          Word banks: word + emoji + caption per category
js/engine.js            Pure game rules (turns, rounds, scoring, repeats)
js/cards.js             Card art resolver + deck component (deal / swipe)
js/profile.js           Local profile, stats, ranking and history
js/bots.js              House players for offline matches
js/net.js               PeerJS transport (host + guest)
js/ui.js                Screens, deck wiring, timer, room controller
js/pwa.js               Service-worker registration + install prompt
js/sound-engine.js      Procedural Web Audio sounds
js/vendor/              PeerJS + canvas-confetti, vendored (no CDN at runtime)
fonts/                  Inter (self-hosted, offline safe)
assets/                 Icons, favicons, photography
scripts/                Dev server, validators and tests
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
npm run check        # every src/href/url()/manifest icon/SW precache entry resolves
npm test             # 27 engine tests: turns, rounds, scoring, repeats, dead letters
npm run test:ui      # 51 checks: onboarding → deck → validation → swipe → results → ranking
npm run test:net     # 30 checks: two clients, real room handshake, synced turns
npm run test:all     # all of the above
```

CI runs the same four commands on every push and pull request (`.github/workflows/site-check.yml`).
The workflow **validates only** — it never deploys.

---

## Deploy to GitHub Pages

1. Push to `main`.
2. **Settings → Pages → Source: `Deploy from a branch` → Branch `main` → Folder `/ (root)`.**
3. The site publishes at `https://<user>.github.io/<repo>/`.

Keep local references **relative**. A leading slash resolves to the domain root and breaks project
pages:

| Reference | Resolves to | |
| --- | --- | --- |
| `css/atlas.css` | `https://<user>.github.io/<repo>/css/atlas.css` | ✅ |
| `/css/atlas.css` | `https://<user>.github.io/css/atlas.css` | ❌ 404 |

`npm run check` fails on root-absolute paths and on missing files.

### After a deploy

Asset links carry `?v=3` and the service worker caches the shell. When you change CSS/JS:

1. Bump `?v=3` to `?v=4` in `index.html`.
2. Bump `VERSION` in `sw.js` (`atlas-v3.0.0` → `atlas-v3.0.1`) so installed apps refresh their cache.

---

## Editing the game

- **Add words:** `js/datasets.js` → `["WORD", "🎯", "Caption"]`. Run `npm test`; the suite fails if any
  word ends with a letter that has no continuation in the same category.
- **Tune rules:** `js/engine.js` → `DEFAULTS` (turn timer, passes, strikes, round cap) and
  `scoreFor()` for the point curve.
- **Restyle:** `css/atlas.css` tokens at the top (`--cream`, `--sand`, radii, type scale).

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Page loads unstyled | Stylesheet 404 — path does not match the file | Keep `css/atlas.css`; run `npm run check` |
| No install prompt | No service worker, or not HTTPS | `sw.js` must be reachable from the site root |
| “Room not found” | Wrong code, host closed the room, or signalling is blocked | Re-check the code; both devices online |
| Old styling after deploy | Browser / service-worker cache | Bump `?v=` and `VERSION`, then reload |
| Stats disappeared | Private mode or cleared storage | Stats live in `localStorage` on the device |
