#!/usr/bin/env node
/**
 * ATLAS — white-label sync
 *
 * brand.config.js is the single source of truth for product identity. This tool
 * pushes the identity into the static files that cannot read it at runtime:
 *
 *   index.html    <title>, meta description, meta theme-color, apple title,
 *                 and the four screen-art background images
 *   manifest.json name, short_name, description, theme/background colours,
 *                 screenshot sources
 *   404.html      <title> and theme-color
 *   sw.js         the precache entries for the swapped photography
 *
 * Usage:
 *   npm run rebrand                # rewrite the static files
 *   npm run rebrand -- --check     # CI mode: fail if anything has drifted
 *   npm run rebrand -- --dry-run   # print what would change, write nothing
 *
 * The rewrites are idempotent and surgical: each replacement targets one
 * well-known tag or JSON field, so hand edits elsewhere in those files survive.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = require(resolve(ROOT, "brand.config.js"));

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const DRY = argv.includes("--dry-run");

const file = (p) => resolve(ROOT, p);
const read = (p) => readFileSync(file(p), "utf8");

const changes = [];
const drift = [];

function plan(p, before, after, what) {
  if (before === after) return before;
  (CHECK ? drift : changes).push(`${p}: ${what}`);
  return after;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => String(s).replace(/"/g, "&quot;");

// ------------------------------------------------------------------ index.html

function rebrandIndex(html) {
  let out = html;

  out = plan(
    "index.html", html, out.replace(/<title>[^<]*<\/title>/i, `<title>${esc(BRAND.fullName)}</title>`),
    "<title>"
  );
  out = out.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/i,
    (m, a, b) => a + attr(BRAND.description) + b
  );
  out = out.replace(
    /(<meta\s+name="theme-color"\s+content=")[^"]*(")/i,
    (m, a, b) => a + attr(BRAND.themeColor) + b
  );
  out = out.replace(
    /(<meta\s+name="apple-mobile-web-app-title"\s+content=")[^"]*(")/i,
    (m, a, b) => a + attr(BRAND.shortName) + b
  );

  // Screen-art slots: welcome dunes, home ridge, lobby + results camp.
  const art = BRAND.art || {};
  out = out.replace(
    /(screen--welcome[^>]*>[\s\S]*?screen-art"\s+style="background-image:url\(')[^']*('\))/i,
    (m, a, b) => a + (art.dunes || "assets/img/hero-dunes.jpg") + b
  );
  out = out.replace(
    /(screen--home[^>]*>[\s\S]*?screen-art[^"']*"\s+style="background-image:url\(')[^']*('\))/i,
    (m, a, b) => a + (art.ridge || "assets/img/hero-ridge.jpg") + b
  );
  out = out.split("background-image:url('assets/img/card-camp.jpg')").join(
    "background-image:url('" + (art.camp || "assets/img/card-camp.jpg") + "')"
  );
  return out;
}

// ----------------------------------------------------------------- manifest.json

function rebrandManifest(raw) {
  const manifest = JSON.parse(raw);
  manifest.name = BRAND.fullName;
  manifest.short_name = BRAND.shortName;
  manifest.description = BRAND.description;
  manifest.theme_color = BRAND.themeColor;
  manifest.background_color = BRAND.themeColor;
  if (Array.isArray(manifest.screenshots)) {
    manifest.screenshots = manifest.screenshots.map((shot, i) => {
      const src = i === 0 ? (BRAND.art && BRAND.art.dunes) || shot.src : (BRAND.art && BRAND.art.coast) || shot.src;
      return Object.assign({}, shot, { src });
    });
  }
  return JSON.stringify(manifest, null, 2) + "\n";
}

// -------------------------------------------------------------------- 404.html

function rebrand404(html) {
  return html
    .replace(/<title>[^<]*<\/title>/i, `<title>Not found — ${esc(BRAND.name)}</title>`)
    .replace(
      /(<meta\s+name="theme-color"\s+content=")[^"]*(")/i,
      (m, a, b) => a + attr(BRAND.themeColor) + b
    );
}

// ----------------------------------------------------------------------- sw.js

function rebrandSw(raw) {
  const art = BRAND.art || {};
  const map = {
    "./assets/img/hero-dunes.jpg": art.dunes || "assets/img/hero-dunes.jpg",
    "./assets/img/hero-ridge.jpg": art.ridge || "assets/img/hero-ridge.jpg",
    "./assets/img/card-coast.jpg": art.coast || "assets/img/card-coast.jpg",
    "./assets/img/card-camp.jpg": art.camp || "assets/img/card-camp.jpg"
  };
  let out = raw;
  for (const [from, to] of Object.entries(map)) {
    out = out.split(`"${from}"`).join(`"./${String(to).replace(/^\.\//, "")}"`);
  }
  return out;
}

// ------------------------------------------------------------------------ main

const targets = [
  { path: "index.html", fn: rebrandIndex },
  { path: "manifest.json", fn: rebrandManifest },
  { path: "404.html", fn: rebrand404 },
  { path: "sw.js", fn: rebrandSw }
];

let wrote = 0;
for (const t of targets) {
  const before = read(t.path);
  const after = t.fn(before);
  if (after !== before) {
    changes.push(`${t.path} updated`);
    if (!CHECK && !DRY) writeFileSync(file(t.path), after, "utf8");
    if (!CHECK && !DRY) wrote += 1;
  }
}

if (CHECK) {
  if (drift.length) {
    console.error("Brand drift detected — run `npm run rebrand` and commit:\n");
    for (const d of drift) console.error("  ✕ " + d);
    process.exit(1);
  }
  console.log("Brand is in sync with brand.config.js.");
  process.exit(0);
}

if (DRY) {
  console.log(changes.length ? "Would change:\n  " + changes.join("\n  ") : "Nothing to change.");
  process.exit(0);
}

console.log(
  wrote
    ? `Rebranded ${wrote} file(s) from brand.config.js:\n  ` + changes.join("\n  ")
    : "Everything already matches brand.config.js."
);
console.log("\nNext: bump ?v= and the service-worker VERSION if you changed art or copy.");
