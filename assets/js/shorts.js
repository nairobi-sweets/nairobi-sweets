const SUPABASE_URL =
  "https://dkjlvyynvgtijccitvvd.supabase.co";

const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRramx2eXludmd0aWpjY2l0dnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDA4MzIsImV4cCI6MjA5MTExNjgzMn0.6wlZCQPJ2En4egpQUo5LAyQhee2hkCQ_tHGxfxbv1EQ";

const sb = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const feed = document.getElementById("feed");

/* HELPERS */

function safePhone(phone){

  let p = String(phone || "")
    .replace(/\D/g,"");

  if(!p) return "";

  if(p.startsWith("0")){
    p = "254" + p.slice(1);
  }

  if(
    p.startsWith("7") ||
    p.startsWith("1")
  ){
    p = "254" + p;
  }

  return p;
}

function getMedia(profile){

  return (
    profile.short_url ||
    profile.video_url ||
    profile.photo_url ||
    profile.image_url ||
    profile.profile_photo ||
    profile.avatar_url ||
    profile.photo ||
    "/assets/logo/logo-badge.png"
  );
}

function isVideo(url){

  return String(url || "")
    .match(/\.(mp4|webm|mov)$/i);
}

function getName(profile){

  return (
    profile.stage_name ||
    profile.name ||
    "Verified Profile"
  );
}

function getBadge(profile){

  const plan = String(
    profile.plan ||
    profile.package ||
    profile.tier ||
    ""
  ).toLowerCase();

  if(
    plan.includes("vvip") ||
    plan.includes("signature")
  ){
    return "👑 VVIP Pick";
  }

  if(plan.includes("vip")){
    return "👑 VIP Pick";
  }

  return "🔥 Sweet Pick";
}

function aiPick(profile){

  const views =
    Number(
      profile.views_count ||
      profile.views ||
      0
    );

  const likes =
    Number(
      profile.likes_count ||
      profile.likes ||
      0
    );

  if(views > 2000){
    return "🔥 Trending Tonight";
  }

  if(likes > 100){
    return "💋 Most Liked";
  }

  if(
    String(
      profile.plan ||
      ""
    )
    .toLowerCase()
    .includes("vip")
  ){
    return "👑 VIP Energy";
  }

  return "⚡ Sweet Recommends";
}

/* RENDER */

function renderShort(profile){

  const media = getMedia(profile);

  const phone =
    safePhone(
      profile.phone ||
      profile.whatsapp
    );

  const mediaTag = isVideo(media)

    ? `
      <video
        class="short-media"
        src="${media}"
        autoplay
        muted
        loop
        playsinline
      ></video>
    `

    : `
      <img
        class="short-media"
        src="${media}"

        onerror="
          this.src='/assets/logo/logo-badge.png'
        "
      >
    `;

  return `
    <section class="short">

      ${mediaTag}

      <div class="overlay"></div>

      <div class="online-pulse"></div>

      <div class="ai-pick">
        ${aiPick(profile)}
      </div>

      <div class="info">

        <div class="badge">
          ${getBadge(profile)}
        </div>

        <div class="name">
          ${getName(profile)}
        </div>

        <div class="location">
          📍 ${profile.location || "Nairobi"}
          ·
          🟢 Online Now
        </div>

        <div class="bio">
          ${
            profile.bio ||
            "Tap WhatsApp or call to connect."
          }
        </div>

      </div>

      <div class="side-actions">

        <a
          class="action"
          onclick="likeShort('${profile.id}')"
        >
          ❤️
        </a>

        <a class="action">
          👁️
        </a>

        ${
          phone
          ? `
            <a
              class="action whatsapp"
              href="https://wa.me/${phone}"
              target="_blank"
            >
              💬
            </a>
          `
          : ""
        }

        ${
          phone
          ? `
            <a
              class="action call"
              href="tel:${phone}"
            >
              ☎
            </a>
          `
          : ""
        }

      </div>

    </section>
  `;
}

/* LOAD */

async function loadShorts(){

  const { data, error } = await sb

    .from("profiles")

    .select("*")

    .eq("approved", true)

    .order(
      "created_at",
      { ascending:false }
    )

    .limit(50);

  if(error){

    feed.innerHTML = `
      <div class="empty">
        ${error.message}
      </div>
    `;

    return;
  }

  if(!data || !data.length){

    feed.innerHTML = `
      <div class="empty">
        No shorts yet.
      </div>
    `;

    return;
  }

  /* AI SORT */

  const ranked = data.sort((a,b)=>{

    const scoreA =
      (
        Number(a.likes_count || 0) * 3
      ) +
      (
        Number(a.views_count || 0)
      );

    const scoreB =
      (
        Number(b.likes_count || 0) * 3
      ) +
      (
        Number(b.views_count || 0)
      );

    return scoreB - scoreA;
  });

  feed.innerHTML =
    ranked.map(renderShort).join("");

  autoPlayVideos();
}

/* VIDEO AUTO PLAY */

function autoPlayVideos(){

  const videos =
    document.querySelectorAll("video");

  const observer =
    new IntersectionObserver(

      entries => {

        entries.forEach(entry => {

          if(entry.isIntersecting){

            entry.target.play();

          }else{

            entry.target.pause();

          }

        });

      },

      {
        threshold:0.7
      }

    );

  videos.forEach(video => {
    observer.observe(video);
  });
}

/* LIKE */

async function likeShort(id){

  try{

    const { data } = await sb

      .from("profiles")

      .select("likes_count")

      .eq("id", id)

      .single();

    const likes =
      Number(data?.likes_count || 0) + 1;

    await sb

      .from("profiles")

      .update({
        likes_count:likes
      })

      .eq("id", id);

  }catch(err){

    console.log(err);

  }
}

window.likeShort = likeShort;

/* START */

loadShorts();
