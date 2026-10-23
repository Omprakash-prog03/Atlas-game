/**
 * ATLAS — white-label brand configuration
 *
 * This is the single place to rebrand the game. Change the values here and run
 * `npm run rebrand` to push them into the static files (index.html metadata,
 * manifest.json, 404.html). js/brand.js applies the theme and copy at runtime,
 * so a rename needs no code edits anywhere else.
 *
 * Commercial note: this file is MIT-licensed like the rest of the project.
 * You may rename the product, swap the palette, replace the photography and
 * ship it as your own — see COMMERCIAL.md and THIRD-PARTY-NOTICES.md for the
 * attribution you must keep (PeerJS, canvas-confetti, Inter).
 *
 * Works in the browser (window.ATLAS_BRAND) and in Node (module.exports) so
 * scripts/rebrand.mjs and scripts/check-site.mjs can read the same source.
 */
(function (root, factory) {
  var brand = factory();
  if (typeof module === "object" && module.exports) module.exports = brand;
  root.ATLAS_BRAND = brand;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BRAND = {
    /** Product identity. Shown in the tab title, install prompt and share text. */
    name: "ATLAS",
    fullName: "ATLAS \u2014 Word Chain Card Game",
    tagline: "Every word becomes a card.",
    welcomeTitle: "Welcome\nto Atlas.",
    welcomeLede: "Name a place, a film, an animal. Every word becomes a card \u2014 and every card ends where the next one begins.",
    homeTitle: "Pick your\nworld.",
    homeLede: "Six worlds. One chain. Choose a deck to begin.",
    description: "ATLAS is a word-chain card game. Name a place, a film, an animal \u2014 the card reveals its icon, swipes away, and the chain continues.",
    /** Install prompt / launcher label (max ~12 chars before truncation). */
    shortName: "ATLAS",
    version: "4.0.0",

    /**
     * Palette. Each key maps to a CSS custom property in css/atlas.css, so a
     * rebrand recolours the whole app without touching the stylesheet.
     */
    theme: {
      ink: "#0a0908",
      ink2: "#121009",
      surface: "#17130d",
      surface2: "#1f1a12",
      cream: "#f2ebdd",
      creamDim: "#d9cfbd",
      sand: "#d8b25a",
      sandDeep: "#a9793a",
      olive: "#7d7a52",
      sage: "#9aa88a",
      text: "#f6f1e7",
      muted: "#a89c89",
      muted2: "#7d7365",
      good: "#8fbf8a",
      bad: "#e07a63"
    },

    /** Status-bar colour for the installed app; usually the darkest theme ink. */
    themeColor: "#0A0908",

    /**
     * Photography. Four slots drive the whole visual identity:
     *   dunes — welcome screen hero      ridge — home screen hero
     *   coast — card art rotation        camp  — lobby + results hero
     *
     * Swap these to rebrand the art with no code edits. js/cards.js reads them at
     * runtime; `npm run rebrand` rewrites the copies in index.html, manifest.json
     * and sw.js so the shell, the install screenshots and the offline precache
     * all follow. See assets/PROVENANCE.md before shipping commercially.
     */
    art: {
      dunes: "assets/img/hero-dunes.jpg",
      ridge: "assets/img/hero-ridge.jpg",
      coast: "assets/img/card-coast.jpg",
      camp: "assets/img/card-camp.jpg"
    },

    /**
     * Feature flags. The engine reads `powerups` and `combo` as match defaults;
     * the UI hides anything switched off, so a reseller can ship a simpler build.
     */
    features: {
      powerups: true,
      combo: true,
      multiplayer: true,
      offline: true,
      sound: true,
      haptics: true,
      /** Categories offered on the home stack; keys must exist in js/datasets.js. */
      categories: ["PLACES", "CITIES", "COUNTRIES", "MOVIES", "ANIMALS", "FOOD"],
      difficulties: ["relaxed", "sharp", "ruthless"],
      defaultDifficulty: "sharp"
    },

    /** Links surfaced on the profile screen and in the legal pages. */
    links: {
      terms: "terms.html",
      privacy: "privacy.html",
      notices: "THIRD-PARTY-NOTICES.md",
      license: "LICENSE",
      /** Public support address — replace before you ship commercially. */
      support: "https://github.com/Omprakash-prog03/Atlas-game/issues",
      homepage: "https://github.com/Omprakash-prog03/Atlas-game"
    },

    /** Copyright line used by the legal pages and the profile footer. */
    legal: {
      copyrightHolder: "Omprakash-prog03",
      copyrightYear: 2026,
      license: "MIT",
      /** Contact shown in the privacy policy. Must be a real address you control. */
      contact: "https://github.com/Omprakash-prog03/Atlas-game/issues"
    },

    /** Credit block kept visible in-app; required by the third-party licences. */
    credits: [
      { name: "PeerJS", license: "MIT", url: "https://peerjs.com" },
      { name: "canvas-confetti", license: "ISC", url: "https://github.com/catdad/canvas-confetti" },
      { name: "Inter", license: "SIL Open Font License 1.1", url: "https://rsms.me/inter/" }
    ]
  };

  /** The copyright line, e.g. "© 2026 Omprakash-prog03". */
  BRAND.copyright = function () {
    return "\u00A9 " + BRAND.legal.copyrightYear + " " + BRAND.legal.copyrightHolder;
  };

  /** Theme object -> CSS custom property assignments. */
  BRAND.cssVars = function () {
    var t = BRAND.theme;
    return {
      "--ink": t.ink,
      "--ink-2": t.ink2,
      "--surface": t.surface,
      "--surface-2": t.surface2,
      "--cream": t.cream,
      "--cream-dim": t.creamDim,
      "--sand": t.sand,
      "--sand-deep": t.sandDeep,
      "--olive": t.olive,
      "--sage": t.sage,
      "--text": t.text,
      "--muted": t.muted,
      "--muted-2": t.muted2,
      "--good": t.good,
      "--bad": t.bad
    };
  };

  return BRAND;
});
