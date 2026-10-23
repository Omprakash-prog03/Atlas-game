# Using ATLAS commercially

ATLAS is released under the **MIT licence** (`LICENSE`). In plain terms: you may
use it, modify it, rebrand it, host it, sell it, ship it inside a paid product,
and license your derivative under terms of your choosing — including closed
source. You may not remove the copyright notice, and the software comes with no
warranty.

This document is the practical guide: what to change, what to keep, what to
watch, and how to deploy. It is guidance, not legal advice.

---

## 1. What MIT lets you do

| You want to… | Allowed? |
| --- | --- |
| Run it on your own domain / app store listing | Yes |
| Rename it, restyle it, replace the art | Yes |
| Charge money for it, or gate it behind a subscription | Yes |
| Keep your modified version closed-source | Yes |
| Bundle it inside a larger commercial product | Yes |
| Remove the original copyright line | **No** — keep the notice in `LICENSE` |
| Claim the original authors endorse you | **No** |

## 2. Obligations you inherit from bundled components

MIT covers the code you see, but four third-party pieces travel with it under
their own (all commercially permissive) licences. `THIRD-PARTY-NOTICES.md` has
the full text; the summary is:

- **PeerJS (MIT)** and **canvas-confetti (ISC)** — keep their two
  `.LICENSE.txt` files next to the vendored scripts. The in-app credit block
  already lists them.
- **Inter (SIL OFL 1.1)** — keep `fonts/OFL.txt`; do not sell the font files by
  themselves; if you modify the binaries, rename the font. The CSS already
  aliases the family to `"Atlas Sans"`, so the reserved name is never advertised.
- **PeerJS signalling** — the free public PeerJS cloud has no SLA. For a paid
  product, self-host `peerjs-server` and point `js/net.js` at it (one line).

## 3. The one thing to close before you sell: photography

The four bundled photographs (`assets/img/*.jpg`) arrived in the repository with
all metadata stripped and **no licence statement on record**. Everything else in
the repository has a clean chain of title; these do not. See
`assets/PROVENANCE.md` for the three ways to close it (trace, replace, or
repoint). The art is now config-driven, so replacing it is a config edit:

```js
// brand.config.js
art: {
  dunes: "assets/img/your-hero.jpg",
  ridge: "assets/img/your-home.jpg",
  coast: "assets/img/your-card-1.jpg",
  camp:  "assets/img/your-card-2.jpg"
}
```

then `npm run rebrand` to push the swap into `index.html`, `manifest.json` and
`sw.js`, and delete the old files. `npm run check` fails until every reference
resolves, which is what stops a half-swapped build from shipping.

## 4. Rebranding checklist

1. Edit `brand.config.js`:
   - `name`, `fullName`, `shortName`, `tagline`, `description` — identity
   - `theme` + `themeColor` — palette (maps 1:1 onto CSS custom properties)
   - `features` — switch off `powerups`, `combo`, `multiplayer`, `sound` or
     trim `categories` to ship a simpler or narrower product
   - `links` + `legal` — your support address, your copyright holder and year
   - `credits` — keep the three bundled-component lines (that is your
     attribution surface)
2. Run `npm run rebrand` — rewrites the static identity into `index.html`
   (`<title>`, meta description, theme-colour, apple title), `manifest.json`
   (name/short_name/description/colours) and `404.html`.
3. Replace the icons in `assets/` (192/512 + maskable + apple-touch) with your
   mark. `npm run check` verifies sizes and maskable purpose.
4. Replace the photography per §3.
5. Host `terms.html` and `privacy.html` with **your** details — they are
   generated with placeholders for the operator name and contact address; the
   privacy policy is written to match what the app actually does (nothing leaves
   the device except optional peer-to-peer play), so keep it honest if you add
   analytics later.
6. `npm run test:all` — the suite asserts the engine rules, the UI flow and the
   multiplayer handshake, so a bad rebrand fails loudly.

## 5. Monetisation notes

The app is deliberately built to be a sellable asset:

- **No accounts, no backend, no database.** Your cost per user is hosting
  static files — effectively zero. There is nothing to operate at 3 AM.
- **No ads, no trackers, no analytics SDKs.** That is a compliance advantage
  (COPPA/GDPR posture is simple) and a marketing line. If you add analytics,
  update `privacy.html` and the profile copy, because both currently promise
  device-only storage.
- **Offline-first PWA.** It installs on iOS/Android home screens from any HTTPS
  host, which lets you sell a web build without store fees, or wrap it
  (Capacitor/WebView) for store distribution.
- **Multiplayer is peer-to-peer.** Your only server cost, if any, is the
  self-hosted PeerJS signalling instance from §2.
- Clean places to add revenue later, in rough order of fit: cosmetic card
  backs and themes (the palette is already tokenised), extra category packs
  (`js/datasets.js` is a plain data table), a paid "club" difficulty tier, and
  tournament mode with entry fees — the engine is a pure state machine, so
  server-side verification of a match is a matter of replaying its action log.

## 6. Trademark caution

MIT does not grant trademark rights. "ATLAS" as a product name, the diamond
mark, and this repository's branding are not licensed to you as trademarks
beyond describing the code's origin. If you sell under the ATLAS name, run a
trademark search in your target classes and jurisdictions first — there are
registered marks containing "ATLAS" in games and software. Rebranding
(§4) sidesteps the question entirely.

## 7. Deploy

See the "Deploy" section of `README.md`. Two supported paths:

- **GitHub Pages** — `.github/workflows/deploy.yml` publishes the repository
  root to Pages on every push to `main` (after the verification job), and on
  manual dispatch.
- **Anywhere static** — the repository root *is* the build. Upload it to S3,
  Cloudflare Pages, Netlify, nginx or a CDN as-is; serve over HTTPS (required
  for the service worker and for WebRTC multiplayer).

For a paid product, put it behind your own domain with HTTPS and keep
`.nojekyll` if you stay on Pages.
