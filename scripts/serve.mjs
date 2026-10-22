#!/usr/bin/env node
/**
 * ATLAS — local static server that mirrors GitHub Pages hosting.
 *
 * GitHub Pages project sites are served from a subpath (https://user.github.io/Atlas-game/),
 * which is exactly the situation where a bad asset path is invisible on localhost.
 * This server reproduces that layout so problems show up before you push.
 *
 * Usage:
 *   node scripts/serve.mjs                    # http://localhost:8080/            (site at root)
 *   node scripts/serve.mjs --base /Atlas-game # http://localhost:8080/Atlas-game/ (like GitHub Pages)
 *   node scripts/serve.mjs 3000 --base /Atlas-game
 */
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
let base = baseIndex !== -1 ? args[baseIndex + 1] || "/" : "/";
if (!base.startsWith("/")) base = "/" + base;
if (!base.endsWith("/")) base += "/";
const port = Number(args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== "--base") || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);

  if (!pathname.startsWith(base)) {
    res.writeHead(302, { Location: base }).end();
    return;
  }
  pathname = pathname.slice(base.length);

  const target = normalize(join(ROOT, pathname));
  if (!target.startsWith(ROOT + sep) && target !== ROOT) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  const send = (file) => {
    res.writeHead(200, {
      "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(readFileSync(file));
  };

  try {
    const stat = statSync(target);
    if (stat.isDirectory()) {
      const indexFile = join(target, "index.html");
      statSync(indexFile);
      send(indexFile);
    } else {
      send(target);
    }
  } catch {
    // Same behaviour as GitHub Pages: custom 404 page for unknown paths.
    const notFound = join(ROOT, "404.html");
    let body = "404 Not Found";
    try {
      body = readFileSync(notFound, "utf8");
    } catch {}
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(body);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`ATLAS serving ${ROOT}`);
  console.log(`  -> http://localhost:${port}${base}`);
  console.log(`  (--base mirrors the GitHub Pages subpath layout)`);
});
