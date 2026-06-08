const { createClient } = require("@supabase/supabase-js");

const SITE_URL = "https://nairobi-sweets.com";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const locations = [
  "nairobi","roysambu","kasarani","westlands","kilimani","ruaka","ruiru","kiambu",
  "zimmerman","mirema","trm","githurai","kahawa-west","kahawa-sukari",
  "donholm","umoja","buruburu","fedha","syokimau","athi-river",
  "thindigua","kiambu-road","parklands","lavington","karen","kitengela"
];

const categories = [
  "verified","vip","signature","featured",
  "top-rated","most-viewed","most-liked",
  "trending-this-week","new-this-week"
];

function xmlHeader() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n`;
}

function urlTag(loc, priority = "0.80", changefreq = "daily") {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function buildUrlset(urls) {
  return `${xmlHeader()}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

function buildSitemapIndex() {
  return `${xmlHeader()}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <sitemap>
    <loc>${SITE_URL}/.netlify/functions/generate-sitemaps?type=static</loc>
  </sitemap>

  <sitemap>
    <loc>${SITE_URL}/.netlify/functions/generate-sitemaps?type=locations</loc>
  </sitemap>

  <sitemap>
    <loc>${SITE_URL}/.netlify/functions/generate-sitemaps?type=categories</loc>
  </sitemap>

  <sitemap>
    <loc>${SITE_URL}/.netlify/functions/generate-sitemaps?type=profiles</loc>
  </sitemap>

</sitemapindex>`;
}

async function profileSitemap() {
  const { data, error } = await sb
    .from("active_profiles_view")
    .select("id, slug, updated_at, created_at")
    .limit(5000);

  if (error) throw error;

  const urls = (data || [])
    .filter(p => p.slug || p.id)
    .map(p => {
      const slug = p.slug
        ? encodeURIComponent(String(p.slug))
        : encodeURIComponent(String(p.id));

      return `
  <url>
    <loc>${SITE_URL}/profile.html?slug=${slug}</loc>
    <lastmod>${p.updated_at || p.created_at || new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>`;
    });

  return buildUrlset(urls);
}

function locationSitemap() {
  const urls = locations.map(loc =>
    urlTag(`${SITE_URL}/seo/locations/${loc}.html`, "0.90", "daily")
  );

  return buildUrlset(urls);
}

function categorySitemap() {
  const base = categories.map(cat =>
    urlTag(`${SITE_URL}/seo/categories/${cat}.html`, "0.95", "daily")
  );

  const matrix = [];

  const matrixLocations = [
    "roysambu","kasarani","westlands","kilimani","ruaka","ruiru","kiambu",
    "zimmerman","mirema","githurai","kahawa-west","kahawa-sukari",
    "donholm","umoja","buruburu","fedha","syokimau","athi-river",
    "thindigua","kiambu-road","parklands","lavington","karen","kitengela"
  ];

  matrixLocations.forEach(loc => {
    matrix.push(urlTag(`${SITE_URL}/seo/categories/${loc}-vip.html`, "0.88", "daily"));
    matrix.push(urlTag(`${SITE_URL}/seo/categories/${loc}-signature.html`, "0.88", "daily"));
  });

  return buildUrlset([...base, ...matrix]);
}

function staticSitemap() {
  const urls = [
    urlTag(`${SITE_URL}/`, "1.00", "daily"),
    urlTag(`${SITE_URL}/join.html`, "0.90", "weekly"),
    urlTag(`${SITE_URL}/login.html`, "0.60", "monthly"),
    urlTag(`${SITE_URL}/trending.html`, "0.95", "hourly"),
    urlTag(`${SITE_URL}/shorts.html`, "0.95", "hourly"),
    urlTag(`${SITE_URL}/reel.html`, "0.95", "hourly"),
    urlTag(`${SITE_URL}/profile.html`, "0.85", "daily"),
    urlTag(`${SITE_URL}/seo/index.html`, "0.95", "daily"),
    urlTag(`${SITE_URL}/seo/categories/index.html`, "0.95", "daily"),
    urlTag(`${SITE_URL}/seo/locations/index.html`, "0.95", "daily")
  ];

  return buildUrlset(urls);
}

exports.handler = async function(event) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain" },
        body: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      };
    }

    const type = event.queryStringParameters?.type || "index";

    let body;

    if (type === "profiles") body = await profileSitemap();
    else if (type === "locations") body = locationSitemap();
    else if (type === "categories") body = categorySitemap();
    else if (type === "static") body = staticSitemap();
    else body = buildSitemapIndex();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      },
      body
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Sitemap generation failed: " + err.message
    };
  }
};
