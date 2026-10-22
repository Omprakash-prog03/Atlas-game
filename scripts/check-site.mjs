#!/usr/bin/env node
/**
 * ATLAS — static deployment validator.
 *
 * GitHub Pages serves this repository from the branch root at
 *   https://<owner>.github.io/<repo>/
 * so a reference to "/css/atlas.css" would resolve to
 *   https://<owner>.github.io/css/atlas.css   (404 — the classic unstyled-site bug)
 * and a reference to a directory that does not exist (e.g. "css/atlas.css" while
 * the file actually lives at the repository root) fails the same way.
 *
 * This script walks every page and fails the build when a local asset is missing,
 * when a path is root-absolute, or when the PWA manifest points at missing files.
 *
 * Usage: node scripts/check-site.mjs
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["index.html", "lobby.html", "game.html", "404.html"];
const REQUIRED_PAGE_ASSETS = ["css/atlas.css", "js/sound-engine.js", "js/game-engine.js"];

const errors = [];
const checked = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const rel = (abs) => relative(ROOT, abs).split("\\").join("/");

/** Extract attribute values for src/href from an HTML string. */
function attributeRefs(html) {
  const refs = [];
  const re = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) refs.push(m[1].trim());
  return refs;
}

/** True for references the browser resolves itself (CDN, data URI, anchor, ...). */
const isExternal = (ref) =>
  /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(ref);

const stripQuery = (ref) => ref.split("#")[0].split("?")[0];

function checkLocalRef(pageAbs, pageLabel, ref, { required = false } = {}) {
  if (!ref || isExternal(ref)) return;

  if (ref.startsWith("/")) {
    fail(
      pageLabel,
      `root-absolute path "${ref}" — GitHub Pages project sites live under /<repo>/, so this 404s. Use a relative path instead.`
    );
    return;
  }

  const clean = stripQuery(decodeURIComponent(ref));
  if (!clean) return;

  const target = resolve(dirname(pageAbs), clean);
  if (!target.startsWith(ROOT)) {
    fail(pageLabel, `"${ref}" points outside the repository root.`);
    return;
  }
  if (!existsSync(target)) {
    fail(pageLabel, `missing local asset "${ref}" (resolved to ${rel(target)}).`);
    return;
  }
  checked.push({ page: pageLabel, ref, target: rel(target), required });
}

function checkCssUrls(fileAbs) {
  const label = rel(fileAbs);
  const css = readFileSync(fileAbs, "utf8");
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const ref = m[2].trim();
    if (!ref || ref.startsWith("data:") || isExternal(ref) || ref.startsWith("/")) {
      if (ref.startsWith("/")) fail(label, `root-absolute url(${ref}) breaks project pages.`);
      continue;
    }
    const target = resolve(dirname(fileAbs), stripQuery(ref));
    if (!existsSync(target)) fail(label, `missing url() target "${ref}".`);
    else checked.push({ page: label, ref, target: rel(target) });
  }
}

function checkManifest() {
  const manifestPath = resolve(ROOT, "manifest.json");
  if (!existsSync(manifestPath)) {
    fail("manifest.json", "file is missing.");
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    fail("manifest.json", `invalid JSON — ${e.message}`);
    return;
  }
  for (const [key, value] of [["start_url", manifest.start_url], ["scope", manifest.scope]]) {
    if (typeof value !== "string") {
      fail("manifest.json", `"${key}" must be a string.`);
      continue;
    }
    const target = resolve(ROOT, stripQuery(value));
    if (!existsSync(target)) fail("manifest.json", `"${key}" points at missing "${value}".`);
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    fail("manifest.json", "no icons declared — the app will not be installable.");
    return;
  }
  const sizes = new Set();
  for (const icon of manifest.icons) {
    if (!icon || typeof icon.src !== "string") {
      fail("manifest.json", "an icon entry is missing its src.");
      continue;
    }
    const target = resolve(ROOT, stripQuery(icon.src));
    if (!existsSync(target)) {
      fail("manifest.json", `icon "${icon.src}" does not exist.`);
    } else {
      checked.push({ page: "manifest.json", ref: icon.src, target: rel(target) });
      if (typeof icon.sizes === "string") sizes.add(icon.sizes);
    }
  }
  if (!sizes.has("192x192") || !sizes.has("512x512")) {
    fail("manifest.json", "installability requires 192x192 and 512x512 icons.");
  }
}

function checkPage(pageName) {
  const pageAbs = resolve(ROOT, pageName);
  if (!existsSync(pageAbs)) {
    fail(pageName, "page is missing.");
    return;
  }
  const html = readFileSync(pageAbs, "utf8");

  if (!/<meta\s+charset=/i.test(html)) fail(pageName, "missing <meta charset>.");
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(pageName, "missing <title>.");

  const refs = attributeRefs(html);
  for (const ref of refs) checkLocalRef(pageAbs, pageName, ref);

  if (pageName !== "404.html") {
    for (const required of REQUIRED_PAGE_ASSETS) {
      const seen = refs.some((r) => stripQuery(r).replace(/^\.\//, "") === required);
      if (!seen) fail(pageName, `does not load required asset "${required}".`);
    }
  }
}

function main() {
  if (!existsSync(resolve(ROOT, ".nojekyll"))) {
    fail(".nojekyll", "missing — GitHub Pages will run Jekyll over the site.");
  }

  for (const page of PAGES) checkPage(page);

  const cssPath = resolve(ROOT, "css/atlas.css");
  if (existsSync(cssPath)) checkCssUrls(cssPath);
  else fail("css/atlas.css", "stylesheet is missing — every page will render unstyled.");

  checkManifest();

  const unique = [...new Map(checked.map((c) => [`${c.page}->${c.ref}`, c])).values()];
  console.log(`ATLAS site check — ${PAGES.length} pages, ${unique.length} local references resolved.`);
  for (const item of unique) console.log(`  ok  ${item.page.padEnd(14)} ${item.ref.padEnd(26)} -> ${item.target}`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} problem(s) found:\n`);
    for (const error of errors) console.error(`  ✕ ${error}`);
    console.error("\nFix the paths above before deploying to GitHub Pages.\n");
    process.exit(1);
  }
  console.log("\nAll local assets resolve. Site is deployable.\n");
}

main();
