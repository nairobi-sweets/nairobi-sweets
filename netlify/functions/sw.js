const CACHE_NAME = "nairobi-sweets-v7";

const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/logo/logo-badge.png",
  "/assets/logo/logo-navbar.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (
    url.pathname.endsWith(".xml") ||
    url.pathname.startsWith("/.netlify/functions/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/robots.txt"
  ) {
    return;
  }

  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
