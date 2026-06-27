/* ==========================================================
   Nairobi Sweets Premium Service Worker
   Version: V3 Premium
========================================================== */

const CACHE_NAME = "nairobi-sweets-v3-" + Date.now();

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

  self.skipWaiting();

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => cache.addAll(APP_SHELL))

      .catch(console.error)

  );

});

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()

      .then(keys => Promise.all(

        keys.map(key => {

          if (key !== CACHE_NAME)

            return caches.delete(key);

        })

      ))

      .then(() => self.clients.claim())

  );

});

function isHTML(request){

  return (

    request.mode === "navigate" ||

    (request.headers.get("accept") || "").includes("text/html")

  );

}

self.addEventListener("fetch", event => {

  const request = event.request;

  const url = new URL(request.url);

  if(request.method !== "GET") return;

  if(url.origin !== location.origin) return;

  if(

    url.pathname.startsWith("/.netlify/functions/") ||

    url.pathname.startsWith("/api/")

  ){

    return;

  }

  if(isHTML(request)){

    event.respondWith(

      fetch(request)

        .then(response=>{

          const copy=response.clone();

          caches.open(CACHE_NAME)

            .then(cache=>cache.put(request,copy));

          return response;

        })

        .catch(()=>{

          return caches.match(request)

            .then(cached=>cached ||

              caches.match("/offline.html"));

        })

    );

    return;

  }

  event.respondWith(

    caches.match(request)

      .then(cached=>{

        if(cached) return cached;

        return fetch(request)

          .then(response=>{

            if(

              !response ||

              response.status!==200 ||

              response.type!=="basic"

            ){

              return response;

            }

            const copy=response.clone();

            caches.open(CACHE_NAME)

              .then(cache=>cache.put(request,copy));

            return response;

          });

      })

  );

});
