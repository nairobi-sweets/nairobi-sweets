/* Nairobi Sweets V5 Phase 4 */
(function(){
"use strict";
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));const $=(s,r=document)=>r.querySelector(s);
function ready(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn):fn();}
function skip(){if($(".v5-p4-skip"))return;const a=document.createElement("a");a.className="v5-p4-skip";a.href="#main";a.textContent="Skip to content";document.body.prepend(a);const m=$("main")||$("#app")||document.body;if(m&&!m.id)m.id="main";}
function meta(){if(!document.querySelector('meta[name="description"]')){const m=document.createElement("meta");m.name="description";m.content="Nairobi Sweets premium mobile directory.";document.head.appendChild(m);}if(!document.querySelector('meta[name="theme-color"]')){const m=document.createElement("meta");m.name="theme-color";m.content="#ffd84b";document.head.appendChild(m);}}
function media(){$$("img").forEach((img,i)=>{img.decoding="async";if(i>1)img.loading=img.loading||"lazy";if(!img.alt)img.alt="Nairobi Sweets";img.addEventListener("error",()=>{if(!img.dataset.fallbackUsed){img.dataset.fallbackUsed="1";img.src="/assets/logo/logo-badge.png";}},{once:true});});$$("video").forEach(v=>{v.setAttribute("playsinline","");v.preload=v.preload||"metadata";if(!v.poster)v.poster="/assets/logo/logo-badge.png";});$$("iframe").forEach(f=>{f.loading=f.loading||"lazy";});}
function nav(){const path=location.pathname.replace(/\/+$/,"")||"/";$$(".bottom-nav a").forEach(a=>{try{const href=new URL(a.href||"/",location.origin).pathname.replace(/\/+$/,"")||"/";a.classList.toggle("active",href===path);}catch(e){}});}
function sw(){if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}),{once:true});}
ready(()=>{skip();meta();media();nav();sw();setTimeout(media,1200);setTimeout(media,3600);});
})();
