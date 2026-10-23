# Third-party notices

ATLAS is MIT-licensed (see `LICENSE`), but it ships third-party components that
keep their own licences. **Every component below permits commercial use.** The
obligation in each case is attribution — keep the listed notice file next to the
component when you redistribute a build.

| Component | Version | Licence | Where it lives | Notice you must keep |
| --- | --- | --- | --- | --- |
| PeerJS | 1.5.x | MIT | `js/vendor/peerjs.min.js` | `js/vendor/peerjs.LICENSE.txt` |
| canvas-confetti | 1.9.x | ISC | `js/vendor/confetti.browser.js` | `js/vendor/canvas-confetti.LICENSE.txt` |
| Inter | 4.x (latin subset, woff2) | SIL Open Font License 1.1 | `fonts/inter-latin-*.woff2` | `fonts/OFL.txt` |
| Emoji glyphs | Unicode 15+ | Unicode emoji, rendered by the OS | word banks in `js/datasets.js` | none (see below) |

No component here is GPL, AGPL or otherwise copyleft, so none of them force you
to open-source a derivative build.

---

## PeerJS — MIT

```
Copyright (c) 2015 Michelle Bu and Eric Zhang, http://peerjs.com
```

Used for the peer-to-peer room transport. Vendored so the app has **no CDN
dependency at runtime** and works offline. Full text: `js/vendor/peerjs.LICENSE.txt`.

**Runtime dependency you should know about:** PeerJS needs a *signalling* server
for the initial handshake. This project uses the free public PeerJS cloud
(`0.peerjs.com`). That service is provided by the PeerJS project, not by this
repository, and it carries no warranty or SLA. For a commercial deployment you
should self-host [`peerjs-server`](https://github.com/peers/peerjs-server) and
point `js/net.js` at it:

```js
new root.Peer(peerIdFor(code), { host: "signal.yourdomain.com", secure: true, port: 443, debug: 0 });
```

Only the handshake touches that server; the game traffic is a direct
device-to-device WebRTC connection.

## canvas-confetti — ISC

```
Copyright (c) 2020, Kiril Vatev
```

Used for the win celebration. Full text: `js/vendor/canvas-confetti.LICENSE.txt`.
The ISC licence is functionally equivalent to MIT for your purposes.

## Inter — SIL Open Font License 1.1

```
Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)
```

Self-hosted as four latin woff2 subsets (400/500/600/700) and exposed in CSS as
the family `"Atlas Sans"`. Full text: `fonts/OFL.txt`.

OFL 1.1 lets you use, embed, bundle and sell software that *contains* the font.
The two restrictions that matter commercially:

1. **The font files may not be sold by themselves.** Selling a game that bundles
   Inter is fine; selling Inter is not.
2. **Derivative font files must be renamed** and must not use the Reserved Font
   Name "Inter". The CSS in this project already aliases it to `"Atlas Sans"`,
   so a rebranded build does not advertise the reserved name in the UI. If you
   modify the actual `.woff2` binaries, rename the files and the internal name
   records too.

The OFL notice must stay with the font files in any redistribution.

## Emoji

The word banks store emoji as plain Unicode code points (e.g. `"🗼"`). No emoji
*artwork* is bundled — rendering is done by the user's own operating system font
(Apple Color Emoji, Noto Color Emoji, Segoe UI Emoji). Those system fonts are
licensed by the platform vendor to the platform user, so there is nothing for you
to clear. If you replace the emoji with your own illustration set, that set needs
its own licence.

## Photography

See `assets/PROVENANCE.md` for the origin and licence status of every raster
asset in `assets/`.

## Word-bank data

The category lists in `js/datasets.js` are **facts** — names of places, cities,
countries, films, animals and foods — with short original captions written for
this project. Factual names are not copyrightable in most jurisdictions, and the
captions are original work released under the repository's MIT licence. No
third-party database was copied.

If you add your own entries, you are responsible for their accuracy. Film titles
and brand-name foods are trademarks of their owners; using a name to *refer to*
the thing is nominative fair use, but do not imply endorsement in your marketing.

---

## Attribution in your build

The in-app profile screen renders the credit block from `brand.config.js`
(`credits[]`). Keeping those three lines visible satisfies the attribution
requirement for all bundled components. If you remove the in-app credits, put
the same information in your documentation, about screen or store listing.
