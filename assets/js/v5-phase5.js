/* Nairobi Sweets V5 Phase 5
   Final stability layer: install prompt, cache refresh, media safety, duplicate SW prevention.
*/
(function(){
  "use strict";

  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const $ = (sel, root=document) => root.querySelector(sel);

  function ready(fn){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function toast(msg){
    let el = $(".v5p5-toast");
    if(!el){
      el = document.createElement("div");
      el.className = "v5p5-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function mediaSafety(){
    $$("img").forEach((img, index) => {
      img.decoding = "async";
      if(index > 1) img.loading = img.loading || "lazy";
      if(!img.alt) img.alt = "Nairobi Sweets";

      const parent = img.parentElement;
      if(parent && !img.complete){
        parent.classList.add("v5p5-skeleton");
        img.addEventListener("load", () => parent.classList.remove("v5p5-skeleton"), {once:true});
        img.addEventListener("error", () => parent.classList.remove("v5p5-skeleton"), {once:true});
      }

      img.addEventListener("error", () => {
        if(!img.dataset.nsFallback){
          img.dataset.nsFallback = "1";
          img.src = "/assets/logo/logo-badge.png";
        }
      }, {once:true});
    });

    $$("video").forEach(video => {
      video.setAttribute("playsinline", "");
      video.preload = video.preload || "metadata";
      if(!video.poster) video.poster = "/assets/logo/logo-badge.png";
    });

    $$("iframe").forEach(frame => {
      frame.loading = frame.loading || "lazy";
      frame.referrerPolicy = frame.referrerPolicy || "no-referrer-when-downgrade";
    });
  }

  function installPrompt(){
    const closed = localStorage.getItem("ns_v5p5_install_closed") === "1";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if(closed || standalone) return;

    const ua = navigator.userAgent || "";
    const mobile = /iphone|ipad|ipod|android/i.test(ua);
    if(!mobile) return;

    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallCard();
    });

    setTimeout(() => {
      if(!deferredPrompt) showInstallCard();
    }, 2500);

    function showInstallCard(){
      if($(".v5p5-install-card")) return;
      const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
      const card = document.createElement("div");
      card.className = "v5p5-install-card show";
      card.innerHTML = `
        <strong>📲 Install Nairobi Sweets</strong>
        <p>${isiOS ? "On iPhone: tap Share, then Add to Home Screen." : "Install the app for faster loading and one-tap access."}</p>
        <div class="v5p5-install-actions">
          <button type="button" class="v5p5-install-primary">Install</button>
          <button type="button" class="v5p5-install-secondary">Later</button>
        </div>
      `;
      document.body.appendChild(card);

      $(".v5p5-install-secondary", card).addEventListener("click", () => {
        localStorage.setItem("ns_v5p5_install_closed", "1");
        card.remove();
      });

      $(".v5p5-install-primary", card).addEventListener("click", async () => {
        if(deferredPrompt){
          deferredPrompt.prompt();
          await deferredPrompt.userChoice.catch(()=>{});
          deferredPrompt = null;
          card.remove();
        }else{
          toast(isiOS ? "Tap Share, then Add to Home Screen." : "Use your browser menu to install.");
        }
      });
    }
  }

  function activeNav(){
    const path = location.pathname.replace(/\/+$/,"") || "/";
    $$(".bottom-nav a").forEach(a => {
      try{
        const href = new URL(a.href || "/", location.origin).pathname.replace(/\/+$/,"") || "/";
        a.classList.toggle("active", href === path);
      }catch(e){}
    });
  }

  function improveLinks(){
    $$('a[target="_blank"]').forEach(a => {
      const rel = new Set((a.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      a.setAttribute("rel", Array.from(rel).join(" "));
    });
  }

  function registerSW(){
    if(!("serviceWorker" in navigator)) return;
    window.addEventListener("load", async () => {
      try{
        const reg = await navigator.serviceWorker.register("/sw.js");
        if(reg.waiting) reg.waiting.postMessage({type:"SKIP_WAITING"});
      }catch(e){}
    }, {once:true});
  }

  ready(() => {
    mediaSafety();
    activeNav();
    improveLinks();
    installPrompt();
    registerSW();
    setTimeout(mediaSafety, 1200);
    setTimeout(mediaSafety, 3600);
    setTimeout(mediaSafety, 7000);
  });
})();
