let allProfiles = [];
let activeFilter = "home";

const grid = document.querySelector(".profiles");
const searchInput = document.querySelector(".search-box");
const statsNumber = document.querySelector(".stats-number");

function safeText(value, fallback = "") {
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function safePhone(phone) {
  const raw = String(phone || "").replace(/\D/g, "");

  if (!raw) return null;
  if (raw.startsWith("0")) return "254" + raw.slice(1);
  if (raw.startsWith("7") || raw.startsWith("1")) return "254" + raw;

  return raw;
}

function safeImage(profile) {
  return (
    profile.photo_url ||
    profile.image_url ||
    profile.profile_photo ||
    profile.avatar_url ||
    profile.main_photo ||
    profile.photo ||
    profile.image ||
    "/assets/logo/logo-badge.png"
  );
}

function getName(profile) {
  return safeText(
    profile.stage_name ||
    profile.name ||
    profile.full_name,
    "Verified Profile"
  );
}

function getLocation(profile) {
  return safeText(
    profile.location ||
    profile.town ||
    profile.area,
    "Nairobi"
  );
}

function getPlan(profile) {
  return String(
    profile.plan ||
    profile.plan_name ||
    profile.package ||
    profile.tier ||
    "featured"
  ).toLowerCase();
}

function getBadge(profile) {
  const plan = getPlan(profile);

  if (plan.includes("vvip") || plan.includes("signature")) return "👑 VVIP";
  if (plan.includes("vip")) return "⭐ VIP";

  return "✨ Featured";
}

function getLikes(profile) {
  return Number(profile.likes_count || profile.likes || 0);
}

function getViews(profile) {
  return Number(profile.views_count || profile.views || 0);
}

function getBio(profile) {
  return safeText(
    profile.bio ||
    profile.description,
    `Meet ${getName(profile)} from ${getLocation(profile)}.`
  );
}

function compactBio(text, max = 130) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max).trim() + "..." : text;
}

function showSkeletons() {
  grid.innerHTML = Array.from({ length: 5 })
    .map(() => `<div class="loading-card"></div>`)
    .join("");
}

function updateStats(list) {
  if (statsNumber) {
    statsNumber.textContent = list.length.toLocaleString();
  }
}

function renderProfiles(list) {
  updateStats(list);

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty">
        No profiles found. Check Supabase approved rows.
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(profile => {
    const phone = safePhone(profile.phone || profile.whatsapp);
    const image = safeImage(profile);
    const name = getName(profile);
    const location = getLocation(profile);
    const bio = compactBio(getBio(profile));

    return `
      <article class="card">

        <span class="online-dot"></span>

        <div class="featured-badge">
          ${getBadge(profile)}
        </div>

        <a href="/profile.html?id=${profile.id}" onclick="viewProfile('${profile.id}')">
          <img
            src="${image}"
            class="card-image"
            loading="lazy"
            alt="${name}"
            onerror="this.onerror=null;this.src='/assets/logo/logo-badge.png';"
          >
        </a>

        <div class="card-body">

          <div class="card-name">${name}</div>

          <div class="online">Online Now</div>

          <div class="location">📍 ${location}</div>

          <div class="phone">📞 ${phone || "Contact hidden"}</div>

          <div class="bio">${bio}</div>

          <div class="engagement">
            <span onclick="likeProfile('${profile.id}')" id="likes-${profile.id}">
              ❤️ ${getLikes(profile)} likes
            </span>
            <span>•</span>
            <span id="views-${profile.id}">
              👁️ ${getViews(profile)} views
            </span>
          </div>

          <div class="action-row">
            ${
              phone
                ? `
                  <a class="call-btn" href="tel:${phone}">CALL</a>
                  <a class="wa-btn" href="https://wa.me/${phone}" target="_blank">WHATSAPP</a>
                `
                : `<button class="disabled-contact">CONTACT HIDDEN</button>`
            }
          </div>

        </div>

      </article>
    `;
  }).join("");
}

function applyFilters() {
  const search = searchInput ? searchInput.value.toLowerCase().trim() : "";

  let list = [...allProfiles];

  if (activeFilter !== "home") {
    list = list.filter(profile => {
      const text = `
        ${getName(profile)}
        ${getLocation(profile)}
        ${getBio(profile)}
        ${getPlan(profile)}
        ${profile.phone || ""}
        ${profile.whatsapp || ""}
      `.toLowerCase();

      if (activeFilter === "vip") return getPlan(profile).includes("vip");
      if (activeFilter === "whatsapp") return Boolean(profile.phone || profile.whatsapp);
      if (activeFilter === "online") return true;

      return text.includes(activeFilter);
    });
  }

  if (search) {
    list = list.filter(profile => {
      const text = `
        ${getName(profile)}
        ${getLocation(profile)}
        ${getBio(profile)}
        ${getPlan(profile)}
        ${profile.phone || ""}
        ${profile.whatsapp || ""}
      `.toLowerCase();

      return text.includes(search);
    });
  }

  list.sort((a, b) => {
    const scoreA = getLikes(a) * 3 + getViews(a);
    const scoreB = getLikes(b) * 3 + getViews(b);
    return scoreB - scoreA;
  });

  renderProfiles(list);
}

function setupFilters() {
  document.querySelectorAll(".filters button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filters button").forEach(btn => {
        btn.classList.remove("active");
      });

      button.classList.add("active");

      activeFilter = button.textContent
        .replace(/[^\w\s]/g, "")
        .trim()
        .toLowerCase();

      applyFilters();
    });
  });
}

function setupSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", applyFilters);
}

async function loadProfiles() {
  showSkeletons();

  if (typeof sb === "undefined") {
    grid.innerHTML = `
      <div class="empty">
        Supabase is not connected. Check config.js.
      </div>
    `;
    return;
  }

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  console.log("SUPABASE DATA:", data);
  console.log("SUPABASE ERROR:", error);

  if (error) {
    grid.innerHTML = `
      <div class="empty">
        Supabase error: ${error.message}
      </div>
    `;
    return;
  }

  allProfiles = data || [];

  renderProfiles(allProfiles);
}

async function likeProfile(id) {
  const profile = allProfiles.find(p => String(p.id) === String(id));
  if (!profile) return;

  const newLikes = getLikes(profile) + 1;

  const { error } = await sb
    .from("profiles")
    .update({ likes_count: newLikes })
    .eq("id", id);

  if (error) return console.log(error);

  profile.likes_count = newLikes;

  const el = document.getElementById(`likes-${id}`);
  if (el) el.innerHTML = `❤️ ${newLikes} likes`;
}

async function viewProfile(id) {
  const profile = allProfiles.find(p => String(p.id) === String(id));
  if (!profile) return;

  const newViews = getViews(profile) + 1;

  await sb
    .from("profiles")
    .update({ views_count: newViews })
    .eq("id", id);
}

window.likeProfile = likeProfile;
window.viewProfile = viewProfile;

setupFilters();
setupSearch();
loadProfiles();
