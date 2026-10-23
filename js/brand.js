/**
 * ATLAS — runtime brand applier
 *
 * Reads brand.config.js and pushes the product identity into the live document:
 * title, meta description, status-bar colour, palette custom properties, and the
 * marketing copy on the welcome / home / profile screens.
 *
 * Everything is opt-in and defensive: if brand.config.js fails to load the app
 * keeps the copy that is already in index.html, so a bad rebrand can never
 * white-screen the game.
 */
(function (root) {
  "use strict";

  var DEFAULTS = {
    name: "ATLAS",
    fullName: "ATLAS",
    tagline: "",
    description: "",
    shortName: "ATLAS",
    themeColor: "#0A0908",
    theme: {},
    features: { powerups: true, combo: true, multiplayer: true, categories: [] },
    links: {},
    legal: { copyrightHolder: "", copyrightYear: new Date().getFullYear(), license: "MIT" },
    credits: []
  };

  var brand = Object.assign({}, DEFAULTS, root.ATLAS_BRAND || {});
  brand.theme = Object.assign({}, DEFAULTS.theme, (root.ATLAS_BRAND || {}).theme || {});
  brand.features = Object.assign({}, DEFAULTS.features, (root.ATLAS_BRAND || {}).features || {});
  brand.links = Object.assign({}, DEFAULTS.links, (root.ATLAS_BRAND || {}).links || {});
  brand.legal = Object.assign({}, DEFAULTS.legal, (root.ATLAS_BRAND || {}).legal || {});
  brand.credits = Array.isArray(brand.credits) ? brand.credits : [];

  function cssVars() {
    var t = brand.theme;
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
  }

  function copyright() {
    return "\u00A9 " + (brand.legal.copyrightYear || new Date().getFullYear()) + " " + (brand.legal.copyrightHolder || "");
  }

  var COLOR_RE = /^#[0-9a-f]{6}$/i;

  function setText(selector, value) {
    if (!value) return;
    var el = document.querySelector(selector);
    if (!el) return;
    // Copy in the config may contain \n for a deliberate line break.
    if (String(value).indexOf("\n") !== -1) {
      el.innerHTML = String(value).split("\n").map(function (line) {
        return line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }).join("<br>");
    } else {
      el.textContent = String(value);
    }
  }

  function applyMeta() {
    if (brand.fullName) document.title = brand.fullName;

    var desc = document.querySelector('meta[name="description"]');
    if (desc && brand.description) desc.setAttribute("content", brand.description);

    if (COLOR_RE.test(brand.themeColor || "")) {
      var theme = document.querySelector('meta[name="theme-color"]');
      if (theme) theme.setAttribute("content", brand.themeColor);
    }

    var appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle && brand.shortName) appleTitle.setAttribute("content", brand.shortName);
  }

  function applyTheme() {
    var vars = cssVars();
    Object.keys(vars).forEach(function (key) {
      var value = vars[key];
      if (typeof value === "string" && COLOR_RE.test(value)) {
        document.documentElement.style.setProperty(key, value);
      }
    });
    if (COLOR_RE.test(brand.themeColor || "")) {
      document.documentElement.style.setProperty("color-scheme", "dark");
    }
    document.documentElement.setAttribute("data-brand", brand.name || "ATLAS");
  }

  function applyCopy() {
    setText("#brandWordmark", brand.name);
    setText("#welcomeTitle", brand.welcomeTitle);
    setText("#welcomeLede", brand.welcomeLede);
    setText("#homeTitle", brand.homeTitle);
    setText("#homeLede", brand.homeLede);
    setText("#brandTagline", brand.tagline);
    setText("#brandCopyright", copyright());

    // Feature flags drive visibility, so a reseller can ship a stripped build
    // without editing markup.
    toggle("[data-feature='multiplayer']", brand.features.multiplayer !== false);
    toggle("[data-feature='powerups']", brand.features.powerups !== false);
    toggle("[data-feature='sound']", brand.features.sound !== false);
    toggle("[data-feature='haptics']", brand.features.haptics !== false);
  }

  function toggle(selector, on) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
      el.hidden = !on;
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
  }

  /** Build the "About / legal" rows on the profile screen from the config. */
  function renderLegal(host) {
    if (!host) return;
    var rows = [
      { label: "Terms of use", href: brand.links.terms, sub: "What you may and may not do with this build" },
      { label: "Privacy", href: brand.links.privacy, sub: "No accounts, no tracking, nothing leaves the device" },
      { label: "Licences", href: brand.links.notices, sub: "MIT code, plus third-party credits" }
    ];
    host.innerHTML = rows.filter(function (r) { return r.href; }).map(function (r) {
      return (
        '<a class="setting-row setting-row--link" href="' + r.href + '">' +
        '<span class="setting-row__main">' +
        '<span class="setting-row__title">' + r.label + "</span>" +
        '<span class="setting-row__sub">' + r.sub + "</span>" +
        "</span>" +
        '<span class="icon-btn icon-btn--bare" aria-hidden="true">\u203A</span>' +
        "</a>"
      );
    }).join("");
  }

  /** Credit lines for an in-app "credits" sheet. */
  function creditLines() {
    return brand.credits.map(function (c) {
      return c.name + " \u2014 " + c.license + (c.url ? " (" + c.url + ")" : "");
    });
  }

  function apply() {
    if (typeof document === "undefined") return;
    try {
      applyMeta();
      applyTheme();
      applyCopy();
      renderLegal(document.querySelector("#legalRows"));
      renderCredits(document.querySelector("#brandCredits"));
    } catch (e) {
      // A failed rebrand must never take the game down.
      if (root.console && console.warn) console.warn("ATLAS brand: ", e && e.message);
    }
  }

  function renderCredits(host) {
    if (!host) return;
    var lines = creditLines();
    host.innerHTML = lines.length
      ? lines.map(function (l) { return "<span>" + l + "</span>"; }).join("")
      : "";
  }

  root.AtlasBrand = {
    config: brand,
    get: function (key, fallback) {
      return key ? (brand[key] != null ? brand[key] : fallback) : brand;
    },
    cssVars: cssVars,
    copyright: copyright,
    creditLines: creditLines,
    categories: function () {
      var list = brand.features.categories;
      return Array.isArray(list) && list.length ? list.slice() : null;
    },
    feature: function (key, fallback) {
      return brand.features[key] != null ? brand.features[key] : fallback;
    },
    apply: apply
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply);
    } else {
      apply();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
