const fs = require("fs");
const path = require("path");

const locations = [
  ["Zimmerman", "zimmerman", "Zimmerman, Mirema, TRM and nearby Thika Road areas"],
  ["Mirema", "mirema", "Mirema, Roysambu, TRM Drive and Zimmerman"],
  ["TRM", "trm", "TRM Drive, Roysambu, Mirema and Thika Road"],
  ["Githurai", "githurai", "Githurai 44, Githurai 45, Kahawa West and Mwihoko"],
  ["Donholm", "donholm", "Donholm, Greenspan, Savannah and Tena"],
  ["Umoja", "umoja", "Umoja, Innercore, Tena and Buruburu"],
  ["Buruburu", "buruburu", "Buruburu, Tena, Umoja and Jogoo Road"],
  ["Fedha", "fedha", "Fedha, Embakasi, Tassia and Nyayo Estate"],
  ["Syokimau", "syokimau", "Syokimau, Mlolongo, Katani and Airport Road"],
  ["Athi River", "athi-river", "Athi River, Mlolongo, Kitengela and Syokimau"],
  ["Thindigua", "thindigua", "Thindigua, Kiambu Road, Ridgeways and Runda"],
  ["Kiambu Road", "kiambu-road", "Kiambu Road, Thindigua, Ridgeways and Runda"],
  ["Kahawa West", "kahawa-west", "Kahawa West, Githurai, Kamiti Road and Kahawa Sukari"],
  ["Kahawa Sukari", "kahawa-sukari", "Kahawa Sukari, Kahawa Wendani, Kenyatta Road and Ruiru"],
  ["Juja Farm", "juja-farm", "Juja Farm, Juja, Kalimoni and JKUAT"],
  ["Kimbo", "kimbo", "Kimbo, Ruiru, Kamakis and Eastern Bypass"]
];

const outDir = path.join(__dirname, "..", "seo", "locations");
fs.mkdirSync(outDir, { recursive: true });

function page(name, slug, areas) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${name} Premium Profiles | Nairobi Sweets</title>
<meta name="description" content="Browse premium, VIP and Signature profiles in ${name} on Nairobi Sweets.">
<link rel="canonical" href="https://nairobi-sweets.com/seo/locations/${slug}.html">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:title" content="${name} Premium Profiles | Nairobi Sweets">
<meta property="og:description" content="Browse premium profiles in ${name} on Nairobi Sweets.">
<meta property="og:url" content="https://nairobi-sweets.com/seo/locations/${slug}.html">
<meta property="og:type" content="website">
<meta property="og:image" content="https://nairobi-sweets.com/assets/logo/logo-badge.png">
<link rel="icon" href="/assets/logo/logo-badge.png">
<style>
body{margin:0;font-family:Arial,Helvetica,sans-serif;background:radial-gradient(circle at top,#10164f,#050713 55%,#000);color:#fff}
a{text-decoration:none;color:inherit}.wrap{max-width:1180px;margin:auto;padding:24px}
.nav{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.brand{color:#ffd84b;font-weight:950;font-size:24px}
.nav a{padding:10px 14px;border:1px solid rgba(255,216,75,.18);border-radius:999px}
.hero{margin-top:25px;padding:34px;border-radius:28px;background:linear-gradient(135deg,rgba(255,216,75,.15),rgba(255,79,163,.08));border:1px solid rgba(255,255,255,.1)}
h1{color:#ffd84b;font-size:clamp(38px,6vw,70px);line-height:1}.hero p,.card p,.notice{color:#cfd5e6;line-height:1.7}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px}.card{background:#111a38;border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:18px}
.card h3{color:#ffd84b}.cta{display:inline-block;margin-top:12px;background:#ffd84b;color:#000;padding:10px 14px;border-radius:12px;font-weight:900}
.notice{margin-top:30px;padding:18px;border-radius:18px;background:rgba(255,216,75,.08)}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.grid{grid-template-columns:1fr}}
</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebPage","name":"${name} Premium Profiles","url":"https://nairobi-sweets.com/seo/locations/${slug}.html","description":"Browse premium profiles in ${name} on Nairobi Sweets.","isPartOf":{"@type":"WebSite","name":"Nairobi Sweets","url":"https://nairobi-sweets.com"}}
</script>
</head>
<body>
<div class="wrap">
<nav class="nav">
<a class="brand" href="/">Nairobi Sweets</a>
<a href="/seo/locations/index.html">Locations</a>
<a href="/seo/categories/index.html">Categories</a>
<a href="/trending.html">Trending</a>
<a href="/join.html">Join</a>
</nav>

<section class="hero">
<h1>${name} Premium Profiles</h1>
<p>Browse Featured, VIP and Signature profiles around ${areas}. Explore premium profile discovery, trending profiles and top-rated listings on Nairobi Sweets.</p>
</section>

<section class="grid">
<div class="card"><h3>Featured Profiles</h3><p>Discover Featured profiles in ${name}.</p><a class="cta" href="/seo/categories/featured.html">View</a></div>
<div class="card"><h3>VIP Profiles</h3><p>Explore VIP profiles in ${name}.</p><a class="cta" href="/seo/categories/vip.html">View</a></div>
<div class="card"><h3>Signature Profiles</h3><p>Browse Signature profiles in ${name}.</p><a class="cta" href="/seo/categories/signature.html">View</a></div>
<div class="card"><h3>Trending Profiles</h3><p>See trending Nairobi Sweets profiles.</p><a class="cta" href="/trending.html">View</a></div>
</section>

<section class="grid">
<a class="card" href="/seo/locations/kilimani.html"><h3>Kilimani</h3><p>Explore Kilimani profiles.</p></a>
<a class="card" href="/seo/locations/westlands.html"><h3>Westlands</h3><p>Explore Westlands profiles.</p></a>
<a class="card" href="/seo/locations/roysambu.html"><h3>Roysambu</h3><p>Explore Roysambu profiles.</p></a>
<a class="card" href="/seo/locations/kasarani.html"><h3>Kasarani</h3><p>Explore Kasarani profiles.</p></a>
</section>

<div class="notice">Nairobi Sweets is a profile discovery platform. Listings are managed by individual users. Visitors should verify profile information independently.</div>
</div>
</body>
</html>`;
}

for (const [name, slug, areas] of locations) {
  fs.writeFileSync(path.join(outDir, `${slug}.html`), page(name, slug, areas));
}

console.log(`Created ${locations.length} SEO location pages.`);