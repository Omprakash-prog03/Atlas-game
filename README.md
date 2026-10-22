# ATLAS — Multiplayer Word-Chain Game

A zero-build, dependency-free static web game. Everything runs in the browser; there is no
server, no bundler and no install step. The repository root **is** the deployable site.

**Live site:** <https://omprakash-prog03.github.io/Atlas-game/>

---

## Repository layout

```
index.html              Home screen, create/join room modals
lobby.html              Matchmaking lounge (reads config from localStorage)
game.html               Game arena + scoreboard + voting modal
404.html                Custom not-found page (self-contained, deep-path safe)
manifest.json           PWA manifest (installable app metadata)
.nojekyll               Tells GitHub Pages to serve files as-is (no Jekyll build)
css/atlas.css           All styles (design tokens, buttons, modals, cards)
js/game-engine.js       Authoritative game engine + word datasets
js/sound-engine.js      Procedural Web Audio sound effects
js/vendor/              Third-party script (canvas-confetti, ISC) served locally
                        so the game needs no CDN at runtime
assets/                 Favicon and PWA icons
scripts/check-site.mjs  Validates every local asset reference (runs in CI)
scripts/serve.mjs       Local server that mirrors GitHub Pages hosting
.github/workflows/      CI: static site check on every push / pull request
```

> **Rule of thumb:** HTML references assets exactly where they live —
> `css/atlas.css`, `js/sound-engine.js`, `js/game-engine.js`. If you move a file,
> move its reference too and run `node scripts/check-site.mjs`.

---

## Deploying to GitHub Pages

This repository is already configured to deploy from the **branch root**:

1. Push to the `main` branch.
2. GitHub → **Settings** → **Pages**
   - **Source:** `Deploy from a branch`
   - **Branch:** `main`
   - **Folder:** `/ (root)`
   - **Save**
3. Wait ~1 minute. The site is published at
   `https://<owner>.github.io/<repo>/` (here: `/Atlas-game/`).

`build_type` for this repository is the standard *legacy* branch build, so **no workflow
configuration is required** to publish. The `Site check` workflow is validation only; it
never deploys and never needs Pages permissions.

### Why paths must stay relative

GitHub Pages project sites are served from a **subpath**, not a domain root:

| Reference in HTML | Resolves on Pages | Result |
| --- | --- | --- |
| `css/atlas.css` | `https://<owner>.github.io/<repo>/css/atlas.css` | ✅ correct |
| `/css/atlas.css` | `https://<owner>.github.io/css/atlas.css` | ❌ 404 — repo name is dropped |

Never use a leading `/` for local files. `scripts/check-site.mjs` fails the build if one
appears, and also fails when a referenced file does not exist.

### Cache busting after a deploy

Browsers and GitHub's CDN cache CSS/JS for up to ~10 minutes. Asset links therefore carry a
version query string:

```html
<link rel="stylesheet" href="css/atlas.css?v=2">
<script src="js/sound-engine.js?v=2"></script>
<script src="js/game-engine.js?v=2"></script>
```

When you change the CSS or JS, bump `?v=2` to `?v=3` (in all three pages) so returning
players pick up the new files immediately.

---

## Verify before you push

```bash
# 1. Validate every local asset reference, the manifest and required files
node scripts/check-site.mjs

# 2. Preview exactly as GitHub Pages serves it (site under /Atlas-game/)
node scripts/serve.mjs --base /Atlas-game
#    -> http://localhost:8080/Atlas-game/

# 3. Or preview at the domain root
node scripts/serve.mjs
#    -> http://localhost:8080/
```

The same validation runs automatically in CI (`.github/workflows/site-check.yml`) on every
push and pull request to `main`.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Page loads but is completely unstyled | Stylesheet 404 — the URL in `<link>` does not match the file location | Keep `css/atlas.css` at `css/atlas.css`, or update the link; run `node scripts/check-site.mjs` |
| Buttons and modals do nothing | `SoundEngine` / `AtlasGameEngine` undefined because the JS 404'd | Check the `js/` references and the browser console |
| CSS works on `localhost` but not on Pages | A root-absolute path (`/css/...`) | Use a relative path (`css/...`) |
| Old styling after a deploy | Browser / CDN cache | Bump the `?v=` query string |
| Pages shows a 404 for a subpage | File name typo or wrong folder | The custom `404.html` redirects to the nearest valid site root |

---

## Gameplay notes

- Chain a word starting with the **last letter** of the previous word.
- Faster answers earn a speed bonus (up to +5), streaks add more.
- Each player has 3 passes; 3 strikes eliminates a player.
- Words missing from the curated dataset trigger a 10-second peer vote.
- Opponent turns are simulated locally, so the game is fully playable solo in one tab.
