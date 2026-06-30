
/* Nairobi Sweets V5 Phase 3
   Global performance, install helper, image cleanup and safety glue.
*/
(function(){
  "use strict";

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function onReady(fn){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function tuneImages(){
    $$("img").forEach((img, i) => {
      img.decoding = "async";
      if(i > 2) img.loading = img.loading || "lazy";
      if(!img.getAttribute("alt")) img.setAttribute("alt", "Nairobi Sweets");
      const box = img.parentElement;
      if(box && !img.complete){
        box.classList.add("v5-skeleton");
        img.addEventListener("load", () => box.classList.remove("v5-skeleton"), {once:true});
        img.addEventListener("error", () => box.classList.remove("v5-skeleton"), {once:true});
      }
    });
  }

  function tuneVideos(){
    $$("video").forEach(video => {
      video.setAttribute("playsinline", "");
      video.preload = video.preload || "metadata";
      video.addEventListener("waiting", () => video.parentElement && video.parentElement.classList.add("v5-skeleton"));
      video.addEventListener("playing", () => video.parentElement && video.parentElement.classList.remove("v5-skeleton"));
      video.addEventListener("loadeddata", () => video.parentElement && video.parentElement.classList.remove("v5-skeleton"));
    });
  }

  function installHint(){
    if(localStorage.getItem("ns_v5_install_closed") === "1") return;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if(isStandalone) return;

    const ua = navigator.userAgent || "";
    const isiOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if(!isiOS && !isAndroid) return;

    const hint = document.createElement("div");
    hint.className = "v5-install-hint";
    hint.innerHTML = `
      <strong>📲 Install Nairobi Sweets</strong>
      <p>${isiOS ? "Tap Share, then Add to Home Screen." : "Tap your browser menu, then Install app or Add to Home screen."}</p>
      <button type="button">Got it</button>
    `;
    document.body.appendChild(hint);
    setTimeout(() => hint.classList.add("show"), 1800);
    $("button", hint).addEventListener("click", () => {
      localStorage.setItem("ns_v5_install_closed", "1");
      hint.classList.remove("show");
    });
  }

  function activeNav(){
    const path = location.pathname.replace(/\/+$/,"") || "/";
    $$(".bottom-nav a").forEach(a => {
      try{
        const href = new URL(a.getAttribute("href") || "/", location.origin).pathname.replace(/\/+$/,"") || "/";
        if(href === path) a.classList.add("active");
      }catch(e){}
    });
  }

  function safeExternalLinks(){
    $$('a[target="_blank"]').forEach(a => {
      const rel = new Set((a.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      a.setAttribute("rel", Array.from(rel).join(" "));
    });
  }

  function reviveAfterDynamicRender(){
    tuneImages();
    tuneVideos();
    safeExternalLinks();
  }

  onReady(() => {
    tuneImages();
    tuneVideos();
    activeNav();
    safeExternalLinks();
    installHint();

    setTimeout(reviveAfterDynamicRender, 1000);
    setTimeout(reviveAfterDynamicRender, 3000);
    setTimeout(reviveAfterDynamicRender, 6500);
  });
})();
