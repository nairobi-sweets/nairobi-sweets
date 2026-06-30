
/* Nairobi Sweets V5 Phase 2 helper
   Adds safe media loading, autoplay protection and small UX upgrades.
*/
(function(){
  "use strict";

  function ready(fn){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function markMedia(){
    document.querySelectorAll("img, video").forEach(el => {
      const parent = el.parentElement;
      if(parent && !el.complete && el.tagName === "IMG") parent.classList.add("ns-media-loading");
      if(parent && el.tagName === "VIDEO") parent.classList.add("ns-media-loading");

      el.addEventListener("load", () => parent && parent.classList.remove("ns-media-loading"), {once:true});
      el.addEventListener("loadeddata", () => parent && parent.classList.remove("ns-media-loading"), {once:true});
      el.addEventListener("error", () => parent && parent.classList.remove("ns-media-loading"), {once:true});

      if(el.tagName === "IMG"){
        el.loading = el.loading || "lazy";
        el.decoding = "async";
      }

      if(el.tagName === "VIDEO"){
        el.setAttribute("playsinline","");
        el.preload = el.preload || "metadata";
      }
    });
  }

  function improveVerticalFeeds(){
    const videos = Array.from(document.querySelectorAll("video"));
    if(!videos.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target;
        if(entry.isIntersecting && entry.intersectionRatio > 0.55){
          videos.forEach(v => { if(v !== video) v.pause(); });
          const playPromise = video.play();
          if(playPromise && typeof playPromise.catch === "function"){
            playPromise.catch(() => {});
          }
        }else{
          video.pause();
        }
      });
    }, {threshold:[0, .35, .55, .8]});

    videos.forEach(video => observer.observe(video));
  }

  function activeBottomNav(){
    const path = location.pathname.replace(/\/+$/,"") || "/";
    document.querySelectorAll(".bottom-nav a").forEach(a => {
      const href = new URL(a.getAttribute("href") || "/", location.origin).pathname.replace(/\/+$/,"") || "/";
      if(href === path) a.classList.add("active");
    });
  }

  function addTapFeedback(){
    document.addEventListener("click", e => {
      const item = e.target.closest("a,button,.action,.btn");
      if(!item) return;
      item.classList.add("ns-tapped");
      setTimeout(() => item.classList.remove("ns-tapped"), 180);
    }, {passive:true});
  }

  ready(function(){
    markMedia();
    improveVerticalFeeds();
    activeBottomNav();
    addTapFeedback();

    // Re-run after Supabase renders dynamic content.
    setTimeout(markMedia, 1200);
    setTimeout(markMedia, 2800);
  });
})();
