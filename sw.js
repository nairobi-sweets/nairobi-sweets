/* Nairobi Sweets V5 Consolidated Service Worker */
const CACHE_VERSION="nairobi-sweets-v5-consolidated";
const APP_SHELL=["/","/index.html","/offline.html","/manifest.webmanifest","/assets/logo/logo-badge.png","/assets/pwa/icon-192.png","/assets/pwa/icon-512.png","/assets/css/v5.css","/assets/js/v5.js"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_VERSION).then(c=>c.addAll(APP_SHELL.map(u=>new Request(u,{cache:"reload"})))).catch(()=>{}));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_VERSION?caches.delete(k):null))).then(()=>self.clients.claim()));});
self.addEventListener("message",e=>{if(e.data&&e.data.type==="SKIP_WAITING")self.skipWaiting();});
function isNav(r){return r.mode==="navigate"||((r.headers.get("accept")||"").includes("text/html"));}
self.addEventListener("fetch",e=>{const r=e.request,u=new URL(r.url);if(r.method!=="GET")return;if(u.origin!==self.location.origin)return;if(u.pathname.includes("/api/")||u.pathname.includes("/.netlify/functions/"))return;if(isNav(r)){e.respondWith(fetch(r).then(res=>{caches.open(CACHE_VERSION).then(c=>c.put(r,res.clone())).catch(()=>{});return res;}).catch(()=>caches.match(r).then(c=>c||caches.match("/offline.html"))));return;}e.respondWith(caches.match(r).then(c=>c||fetch(r).then(res=>{if(!res||res.status!==200||res.type!=="basic")return res;caches.open(CACHE_VERSION).then(cache=>cache.put(r,res.clone())).catch(()=>{});return res;}).catch(()=>c)));});
