const { createClient } = require("@supabase/supabase-js");

const SITE_URL = "https://nairobi-sweets.com";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async () => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("slug, updated_at")
      .eq("approved", true)
      .not("slug", "is", null);

    if (error) throw error;

    const staticUrls = [
      "/",
      "/join.html",
      "/login.html",
      "/public-signup-payment-page.html",
      "/profile.html",
      "/trending.html",
      "/shorts.html",
      "/reel.html",
      "/payment-status.html",
      "/seo/locations/nairobi.html",
      "/seo/locations/westlands.html",
      "/seo/locations/kilimani.html",
      "/seo/locations/kileleshwa.html",
      "/seo/locations/ruaka.html",
      "/seo/locations/runda.html",
      "/seo/locations/rongai.html",
      "/seo/locations/syokimau.html",
      "/seo/locations/thika-road.html",
      "/seo/locations/mombasa.html",
      "/seo/locations/kisumu.html",
      "/seo/locations/nakuru.html",
      "/seo/locations/eldoret.html",
      "/seo/categories/featured.html",
      "/seo/categories/vip.html",
      "/seo/categories/signature.html"
    ];

    const urls = staticUrls.map(path => `
  <url>
    <loc>${SITE_URL}${path}</loc>
    <priority>0.8</priority>
  </url>`);

    (data || []).forEach(profile => {
      urls.push(`
  <url>
    <loc>${SITE_URL}/profile.html?slug=${encodeURIComponent(profile.slug)}</loc>
    <lastmod>${new Date(profile.updated_at || Date.now()).toISOString()}</lastmod>
    <priority>0.9</priority>
  </url>`);
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Sitemap error: " + err.message
    };
  }
};
