/* Nairobi Sweets V5 Consolidated Production Layer */
(function(){
"use strict";
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const $=(s,r=document)=>r.querySelector(s);
function ready(fn){document.readyState==="loading"?document.addEventListener("DOMContentLoaded",fn):fn();}
function toast(msg){let el=$(".ns-toast");if(!el){el=document.createElement("div");el.className="ns-toast";document.body.appendChild(el);}el.textContent=msg;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),2800);}
function skip(){if($(".ns-skip"))return;const a=document.createElement("a");a.className="ns-skip";a.href="#main";a.textContent="Skip to content";document.body.prepend(a);const m=$("main")||$("#app")||document.body;if(m&&!m.id)m.id="main";}
function meta(){if(!document.querySelector('meta[name="description"]')){const m=document.createElement("meta");m.name="description";m.content="Nairobi Sweets premium mobile directory.";document.head.appendChild(m);}if(!document.querySelector('meta[name="theme-color"]')){const m=document.createElement("meta");m.name="theme-color";m.content="#ffd84b";document.head.appendChild(m);}}
function media(){
 $$("img").forEach((img,i)=>{img.decoding="async";if(i>1)img.loading=img.loading||"lazy";if(!img.alt)img.alt="Nairobi Sweets";const p=img.parentElement;if(p&&!img.complete){p.classList.add("ns-skeleton");img.addEventListener("load",()=>p.classList.remove("ns-skeleton"),{once:true});img.addEventListener("error",()=>p.classList.remove("ns-skeleton"),{once:true});}img.addEventListener("error",()=>{if(!img.dataset.nsFallback){img.dataset.nsFallback="1";img.src="/assets/logo/logo-badge.png";}},{once:true});});
 $$("video").forEach(v=>{v.setAttribute("playsinline","");v.preload=v.preload||"metadata";if(!v.poster)v.poster="/assets/logo/logo-badge.png";});
 $$("iframe").forEach(f=>{f.loading=f.loading||"lazy";f.referrerPolicy=f.referrerPolicy||"no-referrer-when-downgrade";});
}
function nav(){const path=location.pathname.replace(/\/+$/,"")||"/";$$(".bottom-nav a").forEach(a=>{try{const href=new URL(a.href||"/",location.origin).pathname.replace(/\/+$/,"")||"/";a.classList.toggle("active",href===path);}catch(e){}});}
function links(){$$('a[target="_blank"]').forEach(a=>{const rel=new Set((a.getAttribute("rel")||"").split(/\s+/).filter(Boolean));rel.add("noopener");rel.add("noreferrer");a.setAttribute("rel",Array.from(rel).join(" "));});}
function install(){
 if(localStorage.getItem("ns_v5_install_closed")==="1")return;
 const standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone;
 if(standalone)return;
 if(!/iphone|ipad|ipod|android/i.test(navigator.userAgent||""))return;
 let deferred=null;
 window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;show();});
 setTimeout(()=>{if(!deferred)show();},2500);
 function show(){if($(".ns-install-card"))return;const ios=/iphone|ipad|ipod/i.test(navigator.userAgent||"");const card=document.createElement("div");card.className="ns-install-card show";card.innerHTML=`<strong>📲 Install Nairobi Sweets</strong><p>${ios?"On iPhone: tap Share, then Add to Home Screen.":"Install the app for faster loading and one-tap access."}</p><div class="ns-install-actions"><button type="button" class="ns-install-primary">Install</button><button type="button" class="ns-install-secondary">Later</button></div>`;document.body.appendChild(card);$(".ns-install-secondary",card).addEventListener("click",()=>{localStorage.setItem("ns_v5_install_closed","1");card.remove();});$(".ns-install-primary",card).addEventListener("click",async()=>{if(deferred){deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;card.remove();}else{toast(ios?"Tap Share, then Add to Home Screen.":"Use your browser menu to install.");}});}
}
function sw(){if(!("serviceWorker"in navigator))return;window.addEventListener("load",async()=>{try{const reg=await navigator.serviceWorker.register("/sw.js");if(reg.waiting)reg.waiting.postMessage({type:"SKIP_WAITING"});}catch(e){}},{once:true});}
ready(()=>{skip();meta();media();nav();links();install();sw();setTimeout(media,1200);setTimeout(media,3600);setTimeout(media,7000);});
})();
