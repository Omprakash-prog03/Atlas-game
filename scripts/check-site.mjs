#!/usr/bin/env node
/**
 * ATLAS — static deployment validator.
 *
 * GitHub Pages serves this repository from the branch root at
 *   https://<owner>.github.io/<repo>/
 * so a reference to "/css/atlas.css" would resolve to
 *   https://<owner>.github.io/css/atlas.css   (404 — the classic unstyled-site bug)
 *
 * This script walks every page, every stylesheet and the service worker's
 * precache list, and fails when a local asset is missing or a path is
 * root-absolute. Run it before pushing; CI runs it too.
 *
 * Usage: node scripts/check-site.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["index.html", "404.html"];

const REQUIRED_PAGE_ASSETS = [
  "css/atlas.css",
  "js/datasets.js",
  "js/engine.js",
  "js/cards.js",
  "js/profile.js",
  "js/bots.js",
  "js/net.js",
  "js/sound-engine.js",
  "js/ui.js",
  "js/pwa.js",
  "js/vendor/peerjs.min.js",
  "manifest.json"
];

const REQUIRED_FILES = [
  ".nojekyll",
  "sw.js",
  "manifest.json",
  "css/atlas.css",
  "js/engine.js",
  "js/ui.js",
  "js/pwa.js",
  "js/vendor/peerjs.min.js",
  "js/vendor/confetti.browser.js",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-192-maskable.png",
  "assets/icon-512-maskable.png",
  "assets/apple-touch-icon.png",
  "assets/favicon.svg"
];

const errors = [];
const checked = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const rel = (abs) => relative(ROOT, abs).split("\\").join("/");
const exists = (p) => existsSync(resolve(ROOT, p));

function attributeRefs(html) {
  const refs = [];
  const re = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) refs.push(m[1].trim());
  return refs;
}

const isExternal = (ref) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(ref);
const stripQuery = (ref) => ref.split("#")[0].split("?")[0];

function checkLocalRef(fromFile, ref) {
  if (!ref || isExternal(ref)) return;

  if (ref.startsWith("/")) {
    fail(fromFile, `root-absolute path "${ref}" — GitHub Pages project sites live under /<repo>/, so this 404s. Use a relative path instead.`);
    return;
  }

  const clean = stripQuery(decodeURIComponent(ref));
  if (!clean || clean.endsWith("/")) return;

  // Stylesheets and pages resolve relative to their own directory.
  const target = clean.startsWith("css/") || clean.startsWith("js/") || clean.startsWith("assets/") || clean.startsWith("fonts/")
    ? clean
    : clean;

  if (!exists(target)) {
    fail(fromFile, `missing local asset "${ref}" (resolved to ${target}).`);
    return;
  }
  checked.push({ from: fromFile, ref, target });
}

function checkCssUrls(file) {
  const css = readFileSync(resolve(ROOT, file), "utf8");
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const ref = m[2].trim();
    if (!ref || ref.startsWith("data:") || isExternal(ref)) continue;
    if (ref.startsWith("/")) {
      fail(file, `root-absolute url(${ref}) breaks project pages.`);
      continue;
    }
    // CSS urls are relative to the stylesheet: css/atlas.css -> ../fonts/x
    const target = rel(resolve(dirname(resolve(ROOT, file)), stripQuery(ref)));
    if (!exists(target)) fail(file, `missing url() target "${ref}".`);
    else checked.push({ from: file, ref, target });
  }
}

function checkManifest() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(ROOT, "manifest.json"), "utf8"));
  } catch (e) {
    fail("manifest.json", `invalid JSON — ${e.message}`);
    return;
  }

  for (const key of ["start_url", "scope"]) {
    const value = manifest[key];
    if (typeof value !== "string") {
      fail("manifest.json", `"${key}" must be a string.`);
      continue;
    }
    const target = stripQuery(value).replace(/^\.\//, "");
    if (target && !exists(target)) fail("manifest.json", `"${key}" points at missing "${value}".`);
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    fail("manifest.json", "no icons declared — the app will not be installable.");
    return;
  }

  const purposes = new Set();
  const sizes = new Set();
  for (const icon of manifest.icons) {
    if (!icon || typeof icon.src !== "string") {
      fail("manifest.json", "an icon entry is missing its src.");
      continue;
    }
    if (!exists(icon.src)) fail("manifest.json", `icon "${icon.src}" does not exist.`);
    else checked.push({ from: "manifest.json", ref: icon.src, target: icon.src });
    purposes.add(icon.purpose || "any");
    sizes.add(icon.sizes);
  }

  if (!sizes.has("192x192") || !sizes.has("512x512")) {
    fail("manifest.json", "installability requires 192x192 and 512x512 icons.");
  }
  if (!purposes.has("maskable")) {
    fail("manifest.json", "no maskable icon — Android will letterbox the app icon.");
  }
  if (manifest.display !== "standalone" && manifest.display !== "fullscreen") {
    fail("manifest.json", 'display should be "standalone" for an app-like launch.');
  }

  for (const shot of manifest.screenshots || []) {
    if (!shot || typeof shot.src !== "string") continue;
    if (!exists(shot.src)) fail("manifest.json", `screenshot "${shot.src}" does not exist.`);
    else checked.push({ from: "manifest.json", ref: shot.src, target: shot.src });
  }
}

/** The service worker must not reference files that were renamed or deleted. */
function checkServiceWorker() {
  const file = "sw.js";
  if (!exists(file)) {
    fail(file, "missing — the app cannot install or work offline.");
    return;
  }
  const source = readFileSync(resolve(ROOT, file), "utf8");
  const match = source.match(/const SHELL = \[([\s\S]*?)\];/);
  if (!match) {
    fail(file, "could not find the SHELL precache list.");
    return;
  }
  const entries = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (entries.length === 0) fail(file, "SHELL precache list is empty.");
  for (const entry of entries) {
    const target = entry.replace(/^\.\//, "");
    if (!target) continue; // "./" — the directory index
    if (!exists(target)) fail(file, `precache entry "${entry}" does not exist.`);
    else checked.push({ from: file, ref: entry, target });
  }
}

function checkPage(page) {
  const html = readFileSync(resolve(ROOT, page), "utf8");
  if (!/<meta\s+charset=/i.test(html)) fail(page, "missing <meta charset>.");
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(page, "missing <title>.");
  if (!/name="viewport"[^>]*viewport-fit=cover/i.test(html)) {
    fail(page, "viewport is missing viewport-fit=cover (notch safe areas).");
  }
  if (!/name="theme-color"/i.test(html)) fail(page, "missing theme-color for the mobile status bar.");

  const refs = attributeRefs(html);
  for (const ref of refs) checkLocalRef(page, ref);

  if (page !== "404.html") {
    for (const required of REQUIRED_PAGE_ASSETS) {
      const seen = refs.some((r) => stripQuery(r).replace(/^\.\//, "") === required);
      if (!seen) fail(page, `does not load required asset "${required}".`);
    }
  }
}

function main() {
  for (const file of REQUIRED_FILES) {
    if (!exists(file)) fail(file, "required file is missing.");
  }

  for (const page of PAGES) {
    if (!exists(page)) {
      fail(page, "page is missing.");
      continue;
    }
    checkPage(page);
  }

  checkCssUrls("css/atlas.css");
  checkManifest();
  checkServiceWorker();

  const unique = [...new Map(checked.map((c) => [`${c.from}->${c.ref}`, c])).values()];
  console.log(`ATLAS site check — ${PAGES.length} pages, ${unique.length} local references resolved.`);
  for (const item of unique) console.log(`  ok  ${item.from.padEnd(16)} ${item.ref.padEnd(34)} -> ${item.target}`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} problem(s) found:\n`);
    for (const error of errors) console.error(`  ✕ ${error}`);
    console.error("\nFix the paths above before deploying to GitHub Pages.\n");
    process.exit(1);
  }

  console.log("\nAll local assets, manifest icons and service-worker entries resolve.\nSite is deployable.\n");
}

main();
