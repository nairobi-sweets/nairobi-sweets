document.body.innerHTML = `
<header>
  <a href="../index.html" class="brand">
    <img src="../assets/logo/logo-navbar.png" alt="Nairobi Sweets">
    <span>Nairobi Sweets</span>
  </a>

  <nav class="menu">
    <a href="../index.html">Home</a>
    <a href="../locations/nairobi.html">Nairobi</a>
    <a href="../locations/kilimani.html">Kilimani</a>
    <a href="../locations/westlands.html">Westlands</a>
    <a href="../locations/ruaka.html">Ruaka</a>
    <a href="../locations/kasarani.html">Kasarani</a>
    <a href="../shorts.html">Shorts</a>
    <a href="../join.html" class="join">Join Now</a>
  </nav>
</header>

<section class="hero">
  <h1>${window.LOCATION_TITLE || "Location"} Profiles</h1>
  <p>Browse verified profiles in ${window.LOCATION_TITLE || "this location"}.</p>
</section>

<section class="grid" id="profilesGrid"></section>

<footer>© Nairobi Sweets</footer>
`;

const style = document.createElement("style");
style.innerHTML = `
*{margin:0;padding:0;box-sizing:border-box}

body{
  background:#020617;
  color:white;
  font-family:Arial,Helvetica,sans-serif;
}

a{text-decoration:none;color:inherit}

header{
  background:#000;
  padding:22px 34px;
  border-bottom:1px solid rgba(255,216,75,.18);
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:22px;
  flex-wrap:wrap;
}

.brand{
  display:flex;
  align-items:center;
  gap:14px;
}

.brand img{
  width:70px;
  height:70px;
  object-fit:contain;
}

.brand span{
  color:#ffd84b;
  font-size:38px;
  font-weight:900;
}

.menu{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.menu a{
  background:#101936;
  color:#fff;
  border:1px solid rgba(255,216,75,.2);
  padding:12px 16px;
  border-radius:999px;
  font-weight:800;
}

.menu a:hover,
.menu .join{
  background:#ffd84b;
  color:#000;
}

.hero{
  text-align:center;
  padding:60px 20px 30px;
}

.hero h1{
  color:#ffd84b;
  font-size:clamp(44px,7vw,86px);
  font-weight:900;
}

.hero p{
  color:#b7bdd1;
  font-size:22px;
  margin-top:16px;
}

.grid{
  padding:20px;
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:24px;
}

.card{
  background:#071038;
  border-radius:26px;
  overflow:hidden;
  border:1px solid #ffbf00;
  position:relative;
}

.card-image{
  width:100%;
  aspect-ratio:3/4;
  background:#000;
  overflow:hidden;
}

.card-image img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.badge{
  position:absolute;
  top:16px;
  right:16px;
  background:rgba(0,0,0,.7);
  color:#ffd84b;
  border:1px solid rgba(255,216,75,.3);
  padding:10px 18px;
  border-radius:999px;
  font-weight:900;
}

.card-body{padding:20px}

.card-name{
  font-size:26px;
  font-weight:900;
  margin-bottom:14px;
}

.card-name a:hover{color:#ffd84b}

.meta{
  color:#d8dced;
  line-height:1.6;
}

.stats-line{
  margin-top:14px;
  color:#ffdb70;
  font-weight:900;
}

.bio{
  margin-top:14px;
  color:#cbd5e1;
  font-size:15px;
  line-height:1.5;
  min-height:65px;
}

.actions{
  margin-top:20px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
}

.action-btn{
  height:52px;
  border-radius:16px;
  font-weight:900;
  display:flex;
  align-items:center;
  justify-content:center;
  border:none;
  cursor:pointer;
}

.whatsapp-btn{background:#25D366;color:#001b09}
.call-btn{background:#ffd84b;color:#000}
.like-btn{background:#ff3f86;color:white;grid-column:1/3}

.empty{
  grid-column:1/-1;
  text-align:center;
  color:#ffd84b;
  font-size:28px;
  font-weight:900;
  padding:80px 20px;
}

footer{
  padding:60px 20px;
  text-align:center;
  color:#7f8bb0;
}

@media(max-width:1100px){
  .grid{grid-template-columns:repeat(3,1fr)}
}

@media(max-width:800px){
  .grid{grid-template-columns:repeat(2,1fr)}
}

@media(max-width:560px){
  .grid{grid-template-columns:1fr}
  .brand span{font-size:28px}
  .brand img{width:54px;height:54px}
}
`;
document.head.appendChild(style);

const supabaseScript = document.createElement("script");
supabaseScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
supabaseScript.onload = startApp;
document.head.appendChild(supabaseScript);

const SUPABASE_URL = "https://dkjlvyynvgtijccitvvd.supabase.co";
const SUPABASE_KEY = "sb_publishable_LtXESbvWOeL5EiUi1aYXSg_Ynm8qywm";

let sb;
let profiles = [];

function getImage(p){
  return p.photo_url || p.image_url || p.profile_photo || p.avatar_url || p.photo || "../assets/logo/logo-badge.png";
}

function getName(p){
  return p.stage_name || p.name || p.full_name || "Profile";
}

function getTier(p){
  const plan = String(p.plan || "").toLowerCase();

  if(plan === "vvip" || plan === "signature") return "👑 VVIP";
  if(plan === "vip") return "⭐ VIP";

  return "✨ Featured";
}

function cleanPhone(phone){
  let n = String(phone || "").replace(/\D/g,"");

  if(n.startsWith("0")) n = "254" + n.slice(1);
  if(n.startsWith("7") || n.startsWith("1")) n = "254" + n;

  return n;
}

async function startApp(){
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending:false });

  if(error){
    document.getElementById("profilesGrid").innerHTML =
      `<div class="empty">${error.message}</div>`;
    return;
  }

  const filter = String(window.LOCATION_FILTER || "").toLowerCase();

  profiles = (data || []).filter(p =>
    String(p.location || "").toLowerCase().includes(filter)
  );

  renderProfiles();
}

function renderProfiles(){
  const grid = document.getElementById("profilesGrid");

  if(!profiles.length){
    grid.innerHTML = `<div class="empty">No profiles found for ${window.LOCATION_TITLE}</div>`;
    return;
  }

  grid.innerHTML = profiles.map(profile=>{
    const rawPhone = profile.phone || profile.whatsapp || "";
    const phone = cleanPhone(rawPhone);

    return `
      <article class="card">
        <div class="badge">${getTier(profile)}</div>

        <div class="card-image">
          <a href="../profile.html?id=${profile.id}">
            <img src="${getImage(profile)}" loading="lazy" onerror="this.src='../assets/logo/logo-badge.png'">
          </a>
        </div>

        <div class="card-body">
          <div class="card-name">
            <a href="../profile.html?id=${profile.id}">
              ${getName(profile)}
            </a>
          </div>

          <div class="meta">
            <div>📍 ${profile.location || "Nairobi"}</div>
            <div>📞 ${rawPhone}</div>
          </div>

          <div class="stats-line">
            ❤️ ${profile.likes_count || 0} likes • 👁️ ${profile.views_count || 0} views
          </div>

          <div class="bio">
            ${profile.bio || "Premium Nairobi profile."}
          </div>

          <div class="actions">
            <a class="action-btn whatsapp-btn" href="https://wa.me/${phone}" target="_blank">WhatsApp</a>
            <a class="action-btn call-btn" href="tel:${rawPhone}">Call</a>
            <button class="action-btn like-btn" onclick="likeProfile(${profile.id})">❤️ Like</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function likeProfile(id){
  await sb.rpc("increment_profile_likes", { p_profile_id:id });

  const profile = profiles.find(p => Number(p.id) === Number(id));

  if(profile){
    profile.likes_count = Number(profile.likes_count || 0) + 1;
    renderProfiles();
  }
}
