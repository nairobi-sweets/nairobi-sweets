const CACHE_NAME = "nairobi-sweets-v1";

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/join.html",
  "/login.html",
  "/profile.html",
  "/trending.html",
  "/assets/logo/logo-navbar.png",
  "/assets/logo/logo-badge.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => caches.match("/index.html"));
    })
  );
});
