const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, updated_at, created_at")
      .or("approved.eq.true,is_approved.eq.true,status.eq.approved,status.eq.active")
      .order("id", { ascending: false })
      .limit(5000);

    if (error) throw error;

    const urls = (data || []).map((p) => {
      const lastmod = p.updated_at || p.created_at || new Date().toISOString();

      return `
  <url>
    <loc>https://nairobi-sweets.com/profile.html?id=${p.id}</loc>
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      },
      body: xml
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Failed to generate profile sitemap: " + err.message
    };
  }
};
