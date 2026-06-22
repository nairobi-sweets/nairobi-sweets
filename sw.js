/* Nairobi Sweets PWA Service Worker - Android + iOS safe */
const CACHE_VERSION = "nairobi-sweets-pwa-v2026-06-22-1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/assets/logo/logo-badge.png",
  "/assets/pwa/icon-192.png",
  "/assets/pwa/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key !== CACHE_VERSION ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

function isNavigationRequest(request){
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if(request.method !== "GET") return;

  if(url.origin !== self.location.origin){
    return;
  }

  if(url.pathname.includes("/api/") || url.pathname.includes("/.netlify/functions/")){
    return;
  }

  if(isNavigationRequest(request)){
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("/offline.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if(cached) return cached;
      return fetch(request).then(response => {
        if(!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
