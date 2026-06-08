const { createClient } = require("@supabase/supabase-js");

const SITE_URL = "https://nairobi-sweets.com";
const VERSION = "profiles-fixed-v4-existing-pages-only";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let sb = null;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!sb) sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return sb;
}

function nowISO() {
  return new Date().toISOString();
}

function xmlHeader() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n`;
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function urlTag(loc, priority = "0.80", changefreq = "daily", lastmod = nowISO()) {
  return `
  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
}

function sitemapTag(loc) {
  return `
  <sitemap>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(nowISO())}</lastmod>
  </sitemap>`;
}

function buildUrlset(urls) {
  return `${xmlHeader()}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

function buildSitemapIndex() {
  return `${xmlHeader()}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
  `${SITE_URL}/dynamic-static-sitemap.xml`,
  `${SITE_URL}/dynamic-location-sitemap.xml`,
  `${SITE_URL}/dynamic-category-sitemap.xml`,
  `${SITE_URL}/dynamic-profile-sitemap.xml`
].map(sitemapTag).join("\n")}
</sitemapindex>`;
}

/*
  IMPORTANT:
  Only list URLs here that REALLY exist on your site.
  If a page is not created/deployed, do not put it in the sitemap.
*/

const existingLocationPages = [
  "roysambu",
  "kasarani",
  "westlands",
  "kilimani",
  "ruaka",
  "ruiru",
  "kiambu",
  "zimmerman",
  "mirema",
  "githurai",
  "kahawa-west",
  "kahawa-sukari",
  "syokimau",
  "athi-river",
  "thindigua",
  "kiambu-road",
  "parklands",
  "lavington",
  "karen",
  "kitengela"
];

const existingCategoryPages = [
  "featured",
  "vip",
  "signature",
  "top-rated",
  "most-viewed",
  "most-liked",
  "trending-this-week",
  "new-this-week"
];

const existingLocationCategoryPages = [
  "roysambu-vip",
  "roysambu-signature",
  "kasarani-vip",
  "kasarani-signature",
  "westlands-vip",
  "westlands-signature",
  "kilimani-vip",
  "kilimani-signature",
  "ruaka-vip",
  "ruaka-signature",
  "ruiru-vip",
  "ruiru-signature",
  "kiambu-vip",
  "kiambu-signature",
  "zimmerman-vip",
  "zimmerman-signature",
  "mirema-vip",
  "mirema-signature",
  "kahawa-west-vip",
  "kahawa-west-signature",
  "kahawa-sukari-vip",
  "kahawa-sukari-signature",
  "githurai-vip",
  "githurai-signature",
  "syokimau-vip",
  "syokimau-signature",
  "athi-river-vip",
  "athi-river-signature",
  "thindigua-vip",
  "thindigua-signature",
  "kiambu-road-vip",
  "kiambu-road-signature",
  "parklands-vip",
  "parklands-signature",
  "lavington-vip",
  "lavington-signature",
  "karen-vip",
  "karen-signature",
  "kitengela-vip",
  "kitengela-signature"
];

function staticSitemap() {
  return buildUrlset([
    urlTag(`${SITE_URL}/`, "1.00", "daily"),
    urlTag(`${SITE_URL}/join.html`, "0.90", "weekly"),
    urlTag(`${SITE_URL}/login.html`, "0.60", "monthly"),
    urlTag(`${SITE_URL}/trending.html`, "0.95", "hourly"),
    urlTag(`${SITE_URL}/shorts.html`, "0.95", "hourly"),
    urlTag(`${SITE_URL}/reel.html`, "0.95", "hourly"),
    urlTag(`${SITE_URL}/profile.html`, "0.85", "daily")
  ]);
}

function locationSitemap() {
  return buildUrlset(
    existingLocationPages.map((loc) =>
      urlTag(`${SITE_URL}/seo/locations/${loc}.html`, "0.90", "daily")
    )
  );
}

function categorySitemap() {
  const baseUrls = existingCategoryPages.map((cat) =>
    urlTag(`${SITE_URL}/seo/categories/${cat}.html`, "0.95", "daily")
  );

  const matrixUrls = existingLocationCategoryPages.map((page) =>
    urlTag(`${SITE_URL}/seo/categories/${page}.html`, "0.88", "daily")
  );

  return buildUrlset([...baseUrls, ...matrixUrls]);
}

async function profileSitemap() {
  const client = getSupabase();

  if (!client) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const { data, error } = await client
    .from("active_profiles_view")
    .select("*")
    .limit(5000);

  if (error) throw error;

  const urls = (data || [])
    .filter((profile) => profile.id || profile.profile_id)
    .map((profile) => {
      const id = profile.id || profile.profile_id;

      const rawName =
        profile.stage_name ||
        profile.name ||
        profile.display_name ||
        profile.full_name ||
        "profile";

      const rawLocation =
        profile.location ||
        profile.town ||
        profile.area ||
        "nairobi";

      const existingSlug =
        profile.slug ||
        profile.profile_slug ||
        profile.seo_slug ||
        "";

      const slug = existingSlug
        ? slugify(existingSlug)
        : slugify(`${rawName}-${rawLocation}-${id}`);

      return urlTag(
        `${SITE_URL}/profile.html?slug=${encodeURIComponent(slug)}`,
        "0.80",
        "weekly",
        profile.updated_at || profile.created_at || profile.inserted_at || nowISO()
      );
    });

  return buildUrlset(urls);
}

exports.handler = async function (event) {
  try {
    const type = event.queryStringParameters?.type || "index";

    let body;

    if (type === "static") {
      body = staticSitemap();
    } else if (type === "locations") {
      body = locationSitemap();
    } else if (type === "categories") {
      body = categorySitemap();
    } else if (type === "profiles" || type === "profile") {
      body = await profileSitemap();
    } else if (type === "health") {
      body = `${xmlHeader()}<health>
  <status>ok</status>
  <function>generate-sitemaps</function>
  <version>${VERSION}</version>
  <supabaseUrl>${SUPABASE_URL ? "present" : "missing"}</supabaseUrl>
  <serviceRole>${SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing"}</serviceRole>
</health>`;
    } else {
      body = buildSitemapIndex();
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: "Sitemap generation failed: " + (err.message || String(err))
    };
  }
};
