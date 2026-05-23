let allProfiles = [];
let activeFilter = "home";

const grid = document.querySelector(".profiles") || document.getElementById("profilesGrid");
const searchInput = document.querySelector(".search-box") || document.getElementById("searchInput");
const statsNumber = document.querySelector(".stats-number");
const totalProfiles = document.getElementById("totalProfiles");
const totalViews = document.getElementById("totalViews");
const totalLikes = document.getElementById("totalLikes");
const vipProfiles = document.getElementById("vipProfiles");

function toggleMenu() {
  const menu = document.getElementById("mobileMenu") || document.getElementById("sideMenu");
  if (menu) menu.classList.toggle("active");
}

function openSweet() {
  const panel = document.getElementById("sweetPanel") || document.getElementById("aiPanel");
  if (panel) panel.classList.add("active");
}

function closeSweet() {
  const panel = document.getElementById("sweetPanel") || document.getElementById("aiPanel");
  if (panel) panel.classList.remove("active");
}

window.toggleMenu = toggleMenu;
window.openSweet = openSweet;
window.closeSweet = closeSweet;

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
    profile.photo ||
    profile.main_photo ||
    "/assets/logo/logo-badge.png"
  );
}

function getName(profile) {
  return safeText(
    profile.stage_name || profile.name || profile.full_name,
    "Verified Profile"
  );
}

function getLocation(profile) {
  return safeText(profile.location, "Nairobi");
}

function getLikes(profile) {
  return Number(profile.likes_count ?? profile.likes ?? 0);
}

function getViews(profile) {
  return Number(profile.views_count ?? profile.views ?? 0);
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

function aiBio(profile) {
  return safeText(
    profile.bio,
    `${getName(profile)} is available in ${getLocation(profile)}. View photos and connect directly through WhatsApp or call.`
  );
}

function hasWhatsapp(profile) {
  return Boolean(profile.phone || profile.whatsapp);
}

function scoreProfile(profile) {
  let score = 0;

  const plan = getPlan(profile);

  if (plan.includes("vvip") || plan.includes("signature")) score += 1000;
  if (plan.includes("vip")) score += 700;
  if (plan.includes("featured")) score += 350;

  score += getLikes(profile) * 3;
  score += getViews(profile) * 0.5;

  if (safeImage(profile)) score += 80;
  if (hasWhatsapp(profile)) score += 100;
  if (profile.created_at) score += Math.max(0, 50 - daysOld(profile.created_at));

  return score;
}

function daysOld(dateString) {
  const created = new Date(dateString);
  if (Number.isNaN(created.getTime())) return 999;

  const diff = Date.now() - created.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function showSkeletons() {
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 6 })
    .map(() => `<div class="loading-card"></div>`)
    .join("");
}

function updateStats(list) {
  const profileCount = list.length;
  const views = list.reduce((sum, profile) => sum + getViews(profile), 0);
  const likes = list.reduce((sum, profile) => sum + getLikes(profile), 0);
  const vipCount = list.filter(profile => getPlan(profile).includes("vip")).length;

  if (statsNumber) statsNumber.textContent = profileCount.toLocaleString();
  if (totalProfiles) totalProfiles.textContent = profileCount.toLocaleString();
  if (totalViews) totalViews.textContent = views.toLocaleString();
  if (totalLikes) totalLikes.textContent = likes.toLocaleString();
  if (vipProfiles) vipProfiles.textContent = vipCount.toLocaleString();
}

function compactBio(text, max = 125) {
  const clean = safeText(text, "");
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim() + "...";
}

function renderProfiles(list) {
  if (!grid) return;

  updateStats(list);

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty">
        No profiles found. Try another location or filter.
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(profile => {
    const phone = safePhone(profile.phone || profile.whatsapp);
    const image = safeImage(profile);
    const name = getName(profile);
    const location = getLocation(profile);
    const bio = compactBio(aiBio(profile));

    const buttons = phone
      ? `
        <a class="call-btn btn call" href="tel:${phone}">CALL</a>
        <a class="wa-btn btn whatsapp" href="https://wa.me/${phone}" target="_blank">WHATSAPP</a>
      `
      : `
        <button class="btn disabled-contact" disabled>CONTACT HIDDEN</button>
      `;

    return `
      <article class="card">
        <span class="online-dot"></span>

        <div class="featured-badge badge">
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
          <div class="card-name name">${name}</div>

          <div class="online online-text">Online Now</div>

          <div class="location">
            📍 ${location}
          </div>

          <div class="phone">
            📞 ${phone || "Contact hidden"}
          </div>

          <div class="bio">
            ${bio}
          </div>

          <div class="engagement">
            <span class="heart-like" id="likes-${profile.id}" onclick="likeProfile('${profile.id}')">
              ❤️ ${getLikes(profile)} likes
            </span>
            <span>•</span>
            <span id="views-${profile.id}">
              👁️ ${getViews(profile)} views
            </span>
          </div>

          <div class="action-row actions">
            ${buttons}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function applyFilters() {
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  let list = [...allProfiles];

  if (activeFilter && activeFilter !== "home") {
    list = list.filter(profile => {
      const plan = getPlan(profile);
      const text = `
        ${profile.stage_name || ""}
        ${profile.name || ""}
        ${profile.full_name || ""}
        ${profile.location || ""}
        ${profile.bio || ""}
        ${profile.body_type || ""}
        ${profile.plan || ""}
        ${profile.package || ""}
      `.toLowerCase();

      if (activeFilter === "vip") return plan.includes("vip");
      if (activeFilter === "online") return true;
      if (activeFilter === "whatsapp") return hasWhatsapp(profile);

      return text.includes(activeFilter);
    });
  }

  if (query) {
    list = list.filter(profile => {
      const text = `
        ${profile.stage_name || ""}
        ${profile.name || ""}
        ${profile.full_name || ""}
        ${profile.location || ""}
        ${profile.bio || ""}
        ${profile.body_type || ""}
        ${profile.plan || ""}
        ${profile.package || ""}
        ${profile.phone || ""}
        ${profile.whatsapp || ""}
      `.toLowerCase();

      return text.includes(query);
    });
  }

  list.sort((a, b) => scoreProfile(b) - scoreProfile(a));

  renderProfiles(list);
}

function setupFilterButtons() {
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

      if (activeFilter === "home") activeFilter = "home";
      if (activeFilter === "vip") activeFilter = "vip";
      if (activeFilter === "online") activeFilter = "online";
      if (activeFilter === "whatsapp") activeFilter = "whatsapp";

      applyFilters();
    });
  });
}

function setupSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    applyFilters();
  });
}

async function loadProfiles() {
  showSkeletons();

  if (typeof sb === "undefined") {
    if (grid) {
      grid.innerHTML = `
        <div class="empty">
          Supabase is not connected. Check assets/js/config.js.
        </div>
      `;
    }
    return;
  }

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    if (grid) {
      grid.innerHTML = `
        <div class="empty">
          Could not load profiles. Refresh page.
        </div>
      `;
    }

    return;
  }

  allProfiles = (data || []).sort((a, b) => scoreProfile(b) - scoreProfile(a));

  applyFilters();
}

async function likeProfile(id) {
  const profile = allProfiles.find(item => String(item.id) === String(id));
  if (!profile) return;

  const newLikes = getLikes(profile) + 1;

  const { error } = await sb
    .from("profiles")
    .update({ likes_count: newLikes })
    .eq("id", id);

  if (error) {
    console.error(error);
    return;
  }

  profile.likes_count = newLikes;

  const el = document.getElementById(`likes-${id}`);
  if (el) el.innerHTML = `❤️ ${newLikes} likes`;

  applyFilters();
}

async function viewProfile(id) {
  const profile = allProfiles.find(item => String(item.id) === String(id));
  if (!profile) return;

  const newViews = getViews(profile) + 1;

  const { error } = await sb
    .from("profiles")
    .update({ views_count: newViews })
    .eq("id", id);

  if (!error) {
    profile.views_count = newViews;

    const el = document.getElementById(`views-${id}`);
    if (el) el.innerHTML = `👁️ ${newViews} views`;
  }
}

window.likeProfile = likeProfile;
window.viewProfile = viewProfile;

setupFilterButtons();
setupSearch();
loadProfiles();
