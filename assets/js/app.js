let allProfiles = [];
let activeFilter = "home";

const grid = document.querySelector(".profiles");
const searchInput = document.querySelector(".search-box");
const statsNumber = document.querySelector(".stats-number");

/* =========================
   MENU
========================= */

function toggleMenu() {
  const menu = document.getElementById("mobileMenu");

  if (menu) {
    menu.classList.toggle("active");
  }
}

window.toggleMenu = toggleMenu;

/* =========================
   HELPERS
========================= */

function safeText(value, fallback = "") {
  return value && String(value).trim()
    ? String(value).trim()
    : fallback;
}

function safePhone(phone) {
  const raw = String(phone || "").replace(/\D/g, "");

  if (!raw) return null;

  if (raw.startsWith("0")) {
    return "254" + raw.slice(1);
  }

  if (raw.startsWith("7") || raw.startsWith("1")) {
    return "254" + raw;
  }

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
    profile.photo1 ||
    profile.photo_1 ||
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

  if (plan.includes("vvip") || plan.includes("signature")) {
    return "👑 VVIP";
  }

  if (plan.includes("vip")) {
    return "⭐ VIP";
  }

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
    profile.description ||
    profile.about,
    `Meet ${getName(profile)} from ${getLocation(profile)}.`
  );
}

function compactBio(text, max = 130) {
  if (!text) return "";

  return text.length > max
    ? text.slice(0, max).trim() + "..."
    : text;
}

function scoreProfile(profile) {
  let score = 0;

  const plan = getPlan(profile);

  if (plan.includes("vvip") || plan.includes("signature")) score += 1000;
  if (plan.includes("vip")) score += 700;
  if (plan.includes("featured")) score += 300;

  score += getLikes(profile) * 3;
  score += getViews(profile);

  if (safeImage(profile)) score += 60;
  if (profile.phone || profile.whatsapp) score += 80;

  return score;
}

/* =========================
   LOADING
========================= */

function showSkeletons() {
  if (!grid) return;

  grid.innerHTML = Array.from({ length: 5 })
    .map(() => `<div class="loading-card"></div>`)
    .join("");
}

/* =========================
   STATS
========================= */

function updateStats(list) {
  if (statsNumber) {
    statsNumber.textContent = list.length.toLocaleString();
  }
}

/* =========================
   RENDER
========================= */

function renderProfiles(list) {
  if (!grid) return;

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

        <a
          href="/profile.html?id=${profile.id}"
          onclick="viewProfile('${profile.id}')"
        >
          <img
            src="${image}"
            class="card-image"
            loading="lazy"
            alt="${name}"
            onerror="this.onerror=null;this.src='/assets/logo/logo-badge.png';"
          >
        </a>

        <div class="card-body">

          <div class="card-name">
            ${name}
          </div>

          <div class="online">
            Online Now
          </div>

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

            <span
              onclick="likeProfile('${profile.id}')"
              id="likes-${profile.id}"
              style="cursor:pointer;"
            >
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

                  <a
                    class="call-btn"
                    href="tel:${phone}"
                  >
                    <i>☎</i>
                    <span>CALL</span>
                  </a>

                  <a
                    class="wa-btn"
                    href="https://wa.me/${phone}"
                    target="_blank"
                  >
                    <img
                      src="/assets/icons/whatsapp.png"
                      alt="WhatsApp"
                      class="wa-real-icon"
                      onerror="this.style.display='none';"
                    >
                    <span>WHATSAPP</span>
                  </a>

                `
                : `

                  <button class="disabled-contact">
                    CONTACT HIDDEN
                  </button>

                `
            }

          </div>

        </div>

      </article>
    `;
  }).join("");
}

/* =========================
   FILTERS
========================= */

function applyFilters() {
  const search = searchInput
    ? searchInput.value.toLowerCase().trim()
    : "";

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

      if (activeFilter === "vip") {
        return getPlan(profile).includes("vip");
      }

      if (activeFilter === "whatsapp") {
        return Boolean(profile.phone || profile.whatsapp);
      }

      if (activeFilter === "online") {
        return true;
      }

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

  list.sort((a, b) => scoreProfile(b) - scoreProfile(a));

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

/* =========================
   SUPABASE LOAD
========================= */

async function loadProfiles() {
  showSkeletons();

  if (typeof sb === "undefined") {
    grid.innerHTML = `
      <div class="empty">
        Supabase is not connected. Check assets/js/config.js.
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

  applyFilters();
}

/* =========================
   LIKES + VIEWS
========================= */

async function likeProfile(id) {
  const profile = allProfiles.find(
    p => String(p.id) === String(id)
  );

  if (!profile) return;

  const newLikes = getLikes(profile) + 1;

  const { error } = await sb
    .from("profiles")
    .update({ likes_count: newLikes })
    .eq("id", id);

  if (error) {
    console.log(error);
    return;
  }

  profile.likes_count = newLikes;

  const el = document.getElementById(`likes-${id}`);

  if (el) {
    el.innerHTML = `❤️ ${newLikes} likes`;
  }

  updateStats(allProfiles);
}

async function viewProfile(id) {
  const profile = allProfiles.find(
    p => String(p.id) === String(id)
  );

  if (!profile) return;

  const newViews = getViews(profile) + 1;

  const { error } = await sb
    .from("profiles")
    .update({ views_count: newViews })
    .eq("id", id);

  if (!error) {
    profile.views_count = newViews;
  }
}

window.likeProfile = likeProfile;
window.viewProfile = viewProfile;

/* =========================
   START
========================= */

setupFilters();
setupSearch();
loadProfiles();
