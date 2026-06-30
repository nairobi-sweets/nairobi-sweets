/*
  Nairobi Sweets Premium PWA Service Worker v3
  Android + iOS safe • Netlify safe • Supabase/API safe

  Upload this file as: /sw.js
*/

const CACHE_VERSION = "nairobi-sweets-pwa-v5-phase1-2026-06-30";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const MEDIA_CACHE = `${CACHE_VERSION}-media`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/profile.html",
  "/shorts.html",
  "/reel.html",
  "/login.html",
  "/join.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/assets/logo/logo-badge.png",
  "/assets/logo/logo-navbar.png",
  "/assets/pwa/icon-192.png",
  "/assets/pwa/icon-512.png",
  "/assets/js/app.js",
  "/assets/css/styles.css",
  "/assets/js/v5-phase1.js",
  "/assets/css/v5-phase1.css"
];

const NEVER_CACHE_PATHS = [
  "/api/",
  "/.netlify/functions/",
  "/auth/",
  "/admin/",
  "/vault",
  "/vault-8472",
  "/payment",
  "/mpesa",
  "/callback"
];

const NEVER_CACHE_EXTENSIONS = [
  ".map"
];

const MEDIA_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".mp4",
  ".webm",
  ".mov"
];

const STATIC_EXTENSIONS = [
  ".css",
  ".js",
  ".json",
  ".webmanifest",
  ".woff",
  ".woff2",
  ".ttf"
];

function isNavigationRequest(request){
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

function isSameOrigin(url){
  return url.origin === self.location.origin;
}

function shouldNeverCache(url){
  const path = url.pathname.toLowerCase();
  if(NEVER_CACHE_PATHS.some(item => path.includes(item))) return true;
  if(NEVER_CACHE_EXTENSIONS.some(ext => path.endsWith(ext))) return true;
  return false;
}

function isMedia(url){
  const path = url.pathname.toLowerCase().split("?")[0];
  return MEDIA_EXTENSIONS.some(ext => path.endsWith(ext));
}

function isStaticAsset(url){
  const path = url.pathname.toLowerCase().split("?")[0];
  return STATIC_EXTENSIONS.some(ext => path.endsWith(ext));
}

async function safeCachePut(cacheName, request, response){
  try{
    if(!response || response.status !== 200 || response.type === "opaque") return;
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }catch(error){
    // Storage may be full or Safari may reject the item. Fail silently.
  }
}

async function cacheFirst(request, cacheName){
  const cached = await caches.match(request);
  if(cached) return cached;

  const response = await fetch(request);
  await safeCachePut(cacheName, request, response);
  return response;
}

async function networkFirst(request, cacheName, fallbackUrl){
  try{
    const response = await fetch(request);
    await safeCachePut(cacheName, request, response);
    return response;
  }catch(error){
    const cached = await caches.match(request);
    if(cached) return cached;
    if(fallbackUrl){
      const fallback = await caches.match(fallbackUrl);
      if(fallback) return fallback;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName){
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      safeCachePut(cacheName, request, response);
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => Promise.allSettled(
        APP_SHELL.map(url => cache.add(new Request(url, { cache:"reload" })))
      ))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("nairobi-sweets-pwa-") && !key.startsWith(CACHE_VERSION))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if(request.method !== "GET") return;

  const url = new URL(request.url);

  // Keep third-party CDNs, Supabase, APIs, payments and admin routes live.
  if(!isSameOrigin(url)) return;
  if(shouldNeverCache(url)) return;

  // Pages: network first so profile pages and homepage data stay fresh.
  if(isNavigationRequest(request)){
    event.respondWith(networkFirst(request, PAGE_CACHE, "/offline.html"));
    return;
  }

  // Images/videos/icons: cache first for speed, important for mobile.
  if(isMedia(url)){
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // CSS/JS/manifest: fast cache, quietly refresh in background.
  if(isStaticAsset(url)){
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Default: network first, cached fallback.
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

self.addEventListener("message", event => {
  if(!event.data) return;

  if(event.data.type === "SKIP_WAITING"){
    self.skipWaiting();
  }

  if(event.data.type === "CLEAR_NAIROBI_SWEETS_CACHE"){
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(key => caches.delete(key))))
        .then(() => self.clients.matchAll())
        .then(clients => clients.forEach(client => client.postMessage({ type:"NAIROBI_SWEETS_CACHE_CLEARED" })))
    );
  }
});
