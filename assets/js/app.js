let allProfiles = [];

/* MENU */

const sideMenu = document.getElementById("sideMenu");
const menuBackdrop = document.getElementById("menuBackdrop");

function openMenu(){
  sideMenu.classList.add("active");
  menuBackdrop.classList.add("active");
  document.body.classList.add("menu-open");
}

function closeMenuPanel(){
  sideMenu.classList.remove("active");
  menuBackdrop.classList.remove("active");
  document.body.classList.remove("menu-open");
}

document.getElementById("menuToggle").onclick = openMenu;
document.getElementById("closeMenu").onclick = closeMenuPanel;
menuBackdrop.onclick = closeMenuPanel;

/* HELPERS */

function safeText(v,f=""){
  return v && String(v).trim()
    ? String(v).trim()
    : f;
}

function safePhone(phone){

  const raw = String(phone || "")
    .replace(/\D/g,"");

  if(!raw) return null;

  if(raw.startsWith("0")){
    return "254" + raw.slice(1);
  }

  if(raw.startsWith("7") || raw.startsWith("1")){
    return "254" + raw;
  }

  return raw;
}

function safeImage(p){

  return (
    p.photo_url ||
    p.image_url ||
    p.profile_photo ||
    p.avatar_url ||
    p.photo ||
    p.main_photo ||
    "/assets/logo/logo-badge.png"
  );
}

function getName(p){

  return safeText(
    p.stage_name ||
    p.name ||
    p.full_name,
    "Verified Profile"
  );
}

function getLikes(p){
  return Number(p.likes_count ?? p.likes ?? 0);
}

function getViews(p){
  return Number(p.views_count ?? p.views ?? 0);
}

function safePlan(p){

  const plan = String(
    p.plan ||
    p.plan_name ||
    p.package ||
    "featured"
  ).toLowerCase();

  if(
    plan.includes("vvip") ||
    plan.includes("signature")
  ){
    return "👑 VVIP";
  }

  if(plan.includes("vip")){
    return "⭐ VIP";
  }

  return "✨ Featured";
}

function aiBio(p){

  return safeText(
    p.bio,
    `${getName(p)} is available in ${safeText(p.location,"Nairobi")}. View photos and connect directly through WhatsApp or call.`
  );
}

/* LOADING */

function showSkeletons(){

  document.getElementById("profilesGrid").innerHTML =
    Array.from({length:6})
      .map(()=>`<div class="loading-card"></div>`)
      .join("");
}

/* STATS */

function updateStats(list){

  document.getElementById("totalProfiles").textContent =
    list.length;

  document.getElementById("totalViews").textContent =
    list.reduce((s,p)=>s+getViews(p),0)
      .toLocaleString();

  document.getElementById("totalLikes").textContent =
    list.reduce((s,p)=>s+getLikes(p),0)
      .toLocaleString();

  document.getElementById("vipProfiles").textContent =
    list.filter(p =>
      String(
        p.plan ||
        p.plan_name ||
        ""
      )
      .toLowerCase()
      .includes("vip")
    ).length;
}

/* RENDER */

function renderProfiles(list){

  updateStats(list);

  const grid =
    document.getElementById("profilesGrid");

  if(!list.length){

    grid.innerHTML = `
      <div class="empty">
        No profiles found.
      </div>
    `;

    return;
  }

  grid.innerHTML = list.map(p => {

    const phone = safePhone(
      p.phone || p.whatsapp
    );

    const buttons = phone
      ? `
        <a
          class="btn whatsapp"
          href="https://wa.me/${phone}"
          target="_blank"
        >
          WhatsApp
        </a>

        <a
          class="btn call"
          href="tel:${phone}"
        >
          Call
        </a>
      `
      : `
        <button
          class="btn disabled-contact"
          disabled
        >
          Contact Hidden
        </button>
      `;

    return `
      <article class="card">

        <div class="badge">
          ${safePlan(p)}
        </div>

        <div class="online-dot"></div>

        <div class="card-image-wrap">

          <a
            href="/profile.html?id=${p.id}"
            onclick="viewProfile('${p.id}')"
          >

            <img
              src="${safeImage(p)}"
              class="card-image"
              loading="lazy"
              alt="${getName(p)}"

              onerror="
                this.onerror=null;
                this.src='/assets/logo/logo-badge.png';
              "
            >

          </a>

        </div>

        <div class="card-body">

          <div class="name">
            ${getName(p)}
          </div>

          <span class="online-text">
            Online Now
          </span>

          <div class="location">
            📍 ${safeText(p.location,"Nairobi")}
          </div>

          <div class="phone">
            📞 ${phone || "Contact hidden"}
          </div>

          <div class="bio">
            ${aiBio(p)}
          </div>

          <div class="engagement">

            <span
              class="heart-like"
              id="likes-${p.id}"
              onclick="likeProfile('${p.id}')"
            >
              ❤️ ${getLikes(p)} likes
            </span>

            <span>•</span>

            <span id="views-${p.id}">
              👁️ ${getViews(p)} views
            </span>

          </div>

          <div class="actions">
            ${buttons}
          </div>

        </div>

      </article>
    `;

  }).join("");
}

/* LOAD */

async function loadProfiles(){

  showSkeletons();

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("approved",true)
    .order("created_at",{ascending:false});

  if(error){

    console.error(error);

    document.getElementById(
      "profilesGrid"
    ).innerHTML = `
      <div class="empty">
        Could not load profiles.
      </div>
    `;

    return;
  }

  allProfiles = data || [];

  renderProfiles(allProfiles);
}

/* LIKE */

async function likeProfile(id){

  const p = allProfiles.find(
    x => String(x.id) === String(id)
  );

  if(!p) return;

  const newLikes = getLikes(p) + 1;

  const { error } = await sb
    .from("profiles")
    .update({
      likes_count:newLikes
    })
    .eq("id",id);

  if(error){
    console.log(error);
    return;
  }

  p.likes_count = newLikes;

  document.getElementById(
    `likes-${id}`
  ).innerHTML =
    `❤️ ${newLikes} likes`;

  updateStats(allProfiles);
}

/* VIEW */

async function viewProfile(id){

  const p = allProfiles.find(
    x => String(x.id) === String(id)
  );

  if(!p) return;

  const newViews = getViews(p) + 1;

  const { error } = await sb
    .from("profiles")
    .update({
      views_count:newViews
    })
    .eq("id",id);

  if(!error){

    p.views_count = newViews;

    const el =
      document.getElementById(
        `views-${id}`
      );

    if(el){

      el.innerHTML =
        `👁️ ${newViews} views`;
    }

    updateStats(allProfiles);
  }
}

/* SEARCH */

document
.getElementById("searchInput")
.addEventListener("input",e=>{

  const q =
    e.target.value.toLowerCase();

  renderProfiles(

    allProfiles.filter(p =>

      `
        ${p.stage_name || ""}
        ${p.name || ""}
        ${p.location || ""}
        ${p.bio || ""}
      `
      .toLowerCase()
      .includes(q)

    )

  );
});

/* SORT */

document
.getElementById("sortSelect")
.addEventListener("change",e=>{

  let list = [...allProfiles];

  if(e.target.value==="likes"){

    list.sort(
      (a,b)=>
        getLikes(b)-getLikes(a)
    );
  }

  if(e.target.value==="views"){

    list.sort(
      (a,b)=>
        getViews(b)-getViews(a)
    );
  }

  if(e.target.value==="newest"){

    list.sort(
      (a,b)=>
        new Date(b.created_at || 0)
        -
        new Date(a.created_at || 0)
    );
  }

  renderProfiles(list);
});

/* MAP */

function initMap(){

  const map =
    L.map("nairobiMap")
    .setView(
      [-1.286389,36.817223],
      12
    );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom:19,
      attribution:"© OpenStreetMap"
    }
  ).addTo(map);

  [
    ["CBD",-1.286389,36.817223],
    ["Kilimani",-1.2921,36.7856],
    ["Westlands",-1.2676,36.8108],
    ["Kasarani",-1.2257,36.8951],
    ["Ruiru",-1.1466,36.9615],
    ["Kikuyu",-1.2450,36.6630]
  ]

  .forEach(([n,lat,lng]) => {

    L.marker([lat,lng])
      .addTo(map)
      .bindPopup(n);

  });
}

/* START */

initMap();
loadProfiles();
