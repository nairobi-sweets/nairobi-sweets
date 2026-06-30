/* Nairobi Sweets V5 Phase 5 Service Worker */
const CACHE_VERSION = "nairobi-sweets-v5-phase5";
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/assets/logo/logo-badge.png",
  "/assets/pwa/icon-192.png",
  "/assets/pwa/icon-512.png",
  "/assets/css/v5-phase1.css",
  "/assets/js/v5-phase1.js",
  "/assets/css/v5-phase2.css",
  "/assets/js/v5-phase2.js",
  "/assets/css/v5-phase3.css",
  "/assets/js/v5-phase3.js",
  "/assets/css/v5-phase4.css",
  "/assets/js/v5-phase4.js",
  "/assets/css/v5-phase5.css",
  "/assets/js/v5-phase5.js"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" }))))
      .catch(() => {})
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key !== CACHE_VERSION ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if(event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isNavigationRequest(request){
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if(request.method !== "GET") return;
  if(url.origin !== self.location.origin) return;
  if(url.pathname.includes("/api/") || url.pathname.includes("/.netlify/functions/")) return;

  if(isNavigationRequest(request)){
    event.respondWith(
      fetch(request)
        .then(response => {
          caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone())).catch(()=>{});
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
        if(!response || response.status !== 200 || response.type !== "basic") return response;
        caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone())).catch(()=>{});
        return response;
      }).catch(() => cached);
    })
  );
});
