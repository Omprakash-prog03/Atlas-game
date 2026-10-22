/* ATLAS — service worker
 *
 * Strategy
 *  - App shell: precached on install, so the installed app opens instantly and
 *    works with no connection.
 *  - Navigations: network first (fresh deploy wins), cached shell as fallback.
 *  - Static assets: cache first, refreshed in the background.
 *
 * Bump VERSION whenever the shell changes; old caches are removed on activate.
 */
const VERSION = "atlas-v3.0.0";
const SHELL_CACHE = VERSION + "-shell";
const ASSET_CACHE = VERSION + "-assets";

const SHELL = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.json",
  "./css/atlas.css",
  "./js/datasets.js",
  "./js/engine.js",
  "./js/cards.js",
  "./js/profile.js",
  "./js/bots.js",
  "./js/net.js",
  "./js/sound-engine.js",
  "./js/ui.js",
  "./js/pwa.js",
  "./js/vendor/peerjs.min.js",
  "./js/vendor/confetti.browser.js",
  "./fonts/inter-latin-400-normal.woff2",
  "./fonts/inter-latin-500-normal.woff2",
  "./fonts/inter-latin-600-normal.woff2",
  "./fonts/inter-latin-700-normal.woff2",
  "./assets/favicon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/img/hero-dunes.jpg",
  "./assets/img/hero-ridge.jpg",
  "./assets/img/card-coast.jpg",
  "./assets/img/card-camp.jpg"
];

const IMAGE_CACHE_LIMIT = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {
            /* A single missing file must not break the whole install. */
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/** Match ignoring the ?v= cache-busting query. */
async function matchIgnoringSearch(cache, request) {
  const exact = await cache.match(request);
  if (exact) return exact;
  const url = new URL(request.url);
  return cache.match(url.origin + url.pathname);
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = (await matchIgnoringSearch(cache, request)) || (await cache.match("./index.html"));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await matchIgnoringSearch(cache, request);
  if (cached) {
    // Refresh quietly for next time.
    fetch(request).then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).then(() => trimCache(ASSET_CACHE, IMAGE_CACHE_LIMIT)).catch(() => {});
      }
    }).catch(() => {});
    return cached;
  }

  const shell = await caches.open(SHELL_CACHE);
  const shellMatch = await matchIgnoringSearch(shell, request);
  if (shellMatch) return shellMatch;

  const response = await fetch(request);
  if (response && response.ok && new URL(request.url).origin === self.location.origin) {
    cache.put(request, response.clone()).then(() => trimCache(ASSET_CACHE, IMAGE_CACHE_LIMIT)).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let the network own third parties
  if (url.pathname.endsWith("/sw.js")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (/\.(?:css|js|woff2|png|svg|jpg|jpeg|webp|json)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
