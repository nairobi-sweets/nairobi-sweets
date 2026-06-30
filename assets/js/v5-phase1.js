/* =========================================================
   Nairobi Sweets V5 Phase 1 Foundation JS
   Safe enhancements only. Preserves existing inline logic.
   ========================================================= */
(function(){
  'use strict';
  const d=document,w=window;
  const LOG='[Nairobi Sweets V5 Phase 1]';
  function toast(msg){
    let t=d.getElementById('nsToast');
    if(!t){t=d.createElement('div');t.id='nsToast';t.className='ns-toast';d.body.appendChild(t);}
    t.textContent=msg;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2600);
  }
  function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
  function isStandalone(){return w.matchMedia('(display-mode: standalone)').matches||w.navigator.standalone===true;}
  function activeNav(){
    const nav=d.querySelector('.bottom-nav'); if(!nav) return;
    const path=(location.pathname.replace(/\/$/,'')||'/');
    nav.querySelectorAll('a,button').forEach(el=>{
      const onclick=el.getAttribute('onclick')||''; const href=el.getAttribute('href')||'';
      let target=href;
      const m=onclick.match(/window\.location\.href=['"]([^'"]+)/); if(m) target=m[1];
      if(!target && onclick.includes('openSweet')) return;
      try{target=new URL(target||'/',location.origin).pathname.replace(/\/$/,'')||'/';}catch(e){target='/';}
      el.classList.toggle('active',target===path);
      el.setAttribute('aria-label', el.textContent.trim() || 'Navigation');
    });
  }
  function mediaPolish(){
    d.querySelectorAll('img').forEach((img,i)=>{
      if(i>1 && !img.hasAttribute('loading')) img.loading='lazy';
      if(!img.hasAttribute('decoding')) img.decoding='async';
      img.addEventListener('error',()=>{ if(!img.dataset.nsFallback){img.dataset.nsFallback='1';img.src='/assets/logo/logo-badge.png';}}, {once:true});
    });
    d.querySelectorAll('video').forEach(video=>{
      video.playsInline=true; video.setAttribute('playsinline','');
      if(!video.hasAttribute('preload')) video.preload='metadata';
      video.addEventListener('waiting',()=>video.classList.add('ns-skeleton'));
      video.addEventListener('canplay',()=>video.classList.remove('ns-skeleton'));
      video.addEventListener('loadeddata',()=>video.classList.remove('ns-skeleton'));
    });
  }
  function installPolish(){
    const btn=d.getElementById('installAppBtn');
    if(!btn) return;
    if(isStandalone()){btn.style.display='none';return;}
    if(isIOS()){btn.style.display='block';btn.textContent='📲 Add to Home Screen';}
    w.addEventListener('beforeinstallprompt',e=>{e.preventDefault();w.__nsInstallPrompt=e;btn.style.display='block';btn.textContent='📲 Install Nairobi Sweets';});
    btn.addEventListener('click',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      if(isIOS()){toast('iPhone: tap Share, then Add to Home Screen.');return;}
      if(w.__nsInstallPrompt){w.__nsInstallPrompt.prompt();await w.__nsInstallPrompt.userChoice.catch(()=>null);w.__nsInstallPrompt=null;btn.style.display='none';return;}
      toast('Open browser menu and choose Install app.');
    },true);
  }
  function countUpStats(){
    const nums=d.querySelectorAll('.stats-number');
    if(!nums.length || !('IntersectionObserver' in w)) return;
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting) return;
        const el=entry.target; io.unobserve(el);
        const end=parseInt(String(el.textContent).replace(/\D/g,''),10); if(!Number.isFinite(end)) return;
        let start=0, t0=performance.now(), dur=850;
        function step(t){const p=Math.min(1,(t-t0)/dur); const v=Math.round(end*(1-Math.pow(1-p,3))); el.textContent=v.toLocaleString(); if(p<1) requestAnimationFrame(step);}
        requestAnimationFrame(step);
      });
    },{threshold:.35});
    nums.forEach(n=>io.observe(n));
  }
  function patchSearchUX(){
    const input=d.getElementById('searchInput')||d.querySelector('.search-box'); if(!input) return;
    input.setAttribute('autocomplete','off'); input.setAttribute('inputmode','search'); input.setAttribute('aria-label','Search Nairobi Sweets profiles');
    let timer; input.addEventListener('input',()=>{clearTimeout(timer); timer=setTimeout(()=>{ if(input.value.trim().length>1) toast('Searching: '+input.value.trim());},500);});
  }
  function boot(){activeNav();mediaPolish();installPolish();countUpStats();patchSearchUX();console.info(LOG,'loaded');}
  if(d.readyState==='loading') d.addEventListener('DOMContentLoaded',boot); else boot();
  w.addEventListener('load',mediaPolish,{once:true});
})();
