const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function xmlEscape(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

exports.handler = async () => {
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("id, slug, updated_at, created_at, approved")
      .eq("approved", true)
      .order("id", { ascending: false })
      .limit(5000);

    if (error) throw error;

    const urls = (data || []).map((p) => {
      const loc = p.slug
        ? `https://nairobi-sweets.com/profile.html?slug=${encodeURIComponent(p.slug)}`
        : `https://nairobi-sweets.com/profile.html?id=${encodeURIComponent(p.id)}`;

      return `
  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${xmlEscape(p.updated_at || p.created_at || new Date().toISOString())}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }).join("");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: err.message
    };
  }
};
