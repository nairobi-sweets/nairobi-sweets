const fs = require("fs");
const path = require("path");

const city = process.argv[2] || "nairobi";

const titleCity =
  city.charAt(0).toUpperCase() +
  city.slice(1);

const html = `
<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>

<title>${titleCity} Escorts | Nairobi Sweets</title>

<meta
  name="description"
  content="Verified premium profiles in ${titleCity}. Browse Nairobi Sweets luxury listings."
/>

<style>

*{
  margin:0;
  padding:0;
  box-sizing:border-box;
}

body{
  background:#020617;
  color:white;
  font-family:Arial,Helvetica,sans-serif;
}

a{
  text-decoration:none;
  color:inherit;
}

.container{
  width:min(1500px,95%);
  margin:auto;
}

header{
  background:#000;
  border-bottom:1px solid rgba(255,216,75,.18);
  padding:20px;
  position:sticky;
  top:0;
  z-index:999;
}

.nav{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:20px;
  flex-wrap:wrap;
}

.logo{
  display:flex;
  align-items:center;
  gap:14px;
}

.logo img{
  width:62px;
  height:62px;
  object-fit:contain;
}

.logo h1{
  color:#ffd84b;
  font-size:42px;
  font-weight:900;
}

.menu{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
}

.menu a{
  background:#101936;
  padding:12px 18px;
  border-radius:999px;
  border:1px solid rgba(255,216,75,.2);
  font-weight:800;
}

.menu a:hover{
  background:#ffd84b;
  color:#000;
}

.hero{
  padding:60px 0 40px;
}

.hero-card{
  background:#071038;
  border-radius:32px;
  border:1px solid rgba(255,216,75,.14);
  padding:40px;
}

.hero h2{
  font-size:64px;
  color:#ffd84b;
  margin-bottom:14px;
}

.hero p{
  color:#b6c2e2;
  font-size:22px;
}

.grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:24px;
  padding-bottom:80px;
}

.card{
  background:#071038;
  border-radius:28px;
  overflow:hidden;
  border:1px solid rgba(255,216,75,.18);
}

.image-wrap{
  width:100%;
  aspect-ratio:3/4;
  background:#000;
  overflow:hidden;
}

.image-wrap img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.card-body{
  padding:22px;
}

.name{
  font-size:28px;
  font-weight:900;
  margin-bottom:10px;
}

.location{
  color:#d6deef;
  margin-bottom:10px;
}

.phone{
  color:#ffd84b;
  font-weight:900;
  margin-bottom:12px;
}

.bio{
  color:#b8c2de;
  line-height:1.6;
  min-height:70px;
}

.stats{
  margin-top:14px;
  color:#ffd84b;
  font-weight:900;
}

.actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin-top:18px;
}

.btn{
  height:50px;
  border:none;
  border-radius:16px;
  font-weight:900;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
}

.whatsapp{
  background:#25D366;
  color:#001b09;
}

.call{
  background:#ffd84b;
  color:#000;
}

.footer{
  padding:40px 0;
  color:#7f8eb6;
}

@media(max-width:1200px){

  .grid{
    grid-template-columns:repeat(3,1fr);
  }

}

@media(max-width:900px){

  .grid{
    grid-template-columns:repeat(2,1fr);
  }

}

@media(max-width:600px){

  .grid{
    grid-template-columns:1fr;
  }

  .hero h2{
    font-size:42px;
  }

}

</style>

</head>

<body>

<header>

<div class="container nav">

  <a href="/" class="logo">

    <img
      src="/assets/logo/logo-navbar.png"
      alt="Nairobi Sweets"
    >

    <h1>Nairobi Sweets</h1>

  </a>

  <nav class="menu">

    <a href="/">Home</a>

    <a href="/shorts.html">Shorts</a>

    <a href="/join.html">Join Now</a>

  </nav>

</div>

</header>

<section class="hero">

<div class="container">

<div class="hero-card">

<h2>${titleCity} Profiles</h2>

<p>
Browse verified premium profiles in ${titleCity}.
</p>

</div>

</div>

</section>

<section>

<div class="container">

<div class="grid" id="profilesGrid">

Loading profiles...

</div>

</div>

</section>

<div class="container footer">

<a href="/">Home</a>
|
<a href="/join.html">Join</a>
|
<a href="/shorts.html">Shorts</a>

</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>

const SUPABASE_URL =
"https://dkjlvyynvgtijccitvvd.supabase.co";

const SUPABASE_KEY =
"sb_publishable_LtXESbvWOeL5EiUi1aYXSg_Ynm8qywm";

const sb = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

function getPhoto(p){

  return (
    p.photo_url ||
    p.image_url ||
    p.profile_photo ||
    p.avatar_url ||
    p.photo ||
    "/assets/logo/logo-badge.png"
  );

}

function getName(p){

  return (
    p.stage_name ||
    p.name ||
    "Profile"
  );

}

function cleanPhone(phone){

  let p = String(phone || "")
    .replace(/\\D/g,"");

  if(p.startsWith("0")){
    p = "254" + p.slice(1);
  }

  if(p.startsWith("7")){
    p = "254" + p;
  }

  return p;

}

async function loadProfiles(){

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("approved", true)
    .ilike("location", "%${titleCity}%");

  if(error){

    document.getElementById(
      "profilesGrid"
    ).innerHTML =
      "<h2>" + error.message + "</h2>";

    return;
  }

  if(!data.length){

    document.getElementById(
      "profilesGrid"
    ).innerHTML =
      "<h2>No profiles found in ${titleCity}</h2>";

    return;
  }

  document.getElementById(
    "profilesGrid"
  ).innerHTML = data.map(profile => {

    const phone =
      profile.phone || "";

    const whatsapp =
      cleanPhone(phone);

    return \`

      <div class="card">

        <div class="image-wrap">

          <img
            src="\${getPhoto(profile)}"
            onerror="this.src='/assets/logo/logo-badge.png'"
          >

        </div>

        <div class="card-body">

          <div class="name">

            \${getName(profile)}

          </div>

          <div class="location">

            📍 \${profile.location || "${titleCity}"}

          </div>

          <div class="phone">

            📞 \${phone}

          </div>

          <div class="bio">

            \${profile.bio || "Verified premium profile"}

          </div>

          <div class="stats">

            ❤️ \${profile.likes_count || 0}
            •
            👁️ \${profile.views_count || 0}

          </div>

          <div class="actions">

            <a
              class="btn whatsapp"
              target="_blank"
              href="https://wa.me/\${whatsapp}"
            >
              WhatsApp
            </a>

            <a
              class="btn call"
              href="tel:\${phone}"
            >
              Call
            </a>

          </div>

        </div>

      </div>

    \`;

  }).join("");

}

loadProfiles();

</script>

</body>
</html>
`;

const outputDir =
path.join(__dirname, "seo", "locations");

if(!fs.existsSync(outputDir)){
  fs.mkdirSync(outputDir, {
    recursive:true
  });
}

fs.writeFileSync(
  path.join(outputDir, city + ".html"),
  html
);

console.log(
  "Generated:",
  city + ".html"
);
