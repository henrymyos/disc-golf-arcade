// Offline support that always prefers fresh content so deploys land immediately:
// network-first for every same-origin GET, falling back to the cache only when
// offline. The previous build was cache-first for static assets, which could
// pin an old JS bundle across deploys — hence this rewrite. Bump CACHE to purge
// any stale cache from older service workers on the next activation.
const CACHE = "dga-v3";
// Every deploy renames the hashed /_next/static chunks, so without a cap the
// cache keeps every old build forever. One build is ~45 files; keep ~3 builds.
const MAX_ENTRIES = 150;

// Cache keys are in insertion order and put() re-appends a key, so files the
// current build still uses stay at the end; trim the oldest from the front.
function trim(cache) {
  return cache.keys().then((keys) =>
    Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((k) => cache.delete(k))),
  );
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  // Never let the worker serve a cached copy of itself — lets updates land.
  if (new URL(request.url).pathname === "/sw.js") return;

  // Network-first: serve the freshest response and refresh the cache; only fall
  // back to the cache (or the app shell for navigations) when the network fails.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy).then(() => trim(c)));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(request)
          .then((m) => m || (request.mode === "navigate" ? caches.match("/") : undefined)),
      ),
  );
});
