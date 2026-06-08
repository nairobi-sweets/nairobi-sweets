const CACHE_NAME = "nairobi-sweets-v4";

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/profile.html",
  "/login.html",
  "/join.html",
  "/public-signup-payment-page.html",
  "/trending.html",
  "/reel.html",
  "/shorts.html",
  "/assets/logo/logo-badge.png",
  "/assets/logo/logo-navbar.png"
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
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (
    url.pathname.endsWith(".xml") ||
    url.pathname.endsWith(".txt") ||
    url.pathname === "/robots.txt" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/.netlify/functions/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
