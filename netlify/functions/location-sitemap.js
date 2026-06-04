const { createClient } = require("@supabase/supabase-js");

const SITE_URL = "https://nairobi-sweets.com";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const LOCATIONS = [
  "nairobi","kilimani","westlands","lavington","ngong-road","embakasi",
  "south-b","south-c","parklands","karen","rongai","kitengela",
  "kasarani","roysambu","ruaka","ruiru","kiambu","thika","juja",
  "zimmerman","mirema","trm","githurai","donholm","umoja","buruburu",
  "fedha","syokimau","athi-river","thindigua","kiambu-road",
  "kahawa-west","kahawa-sukari","juja-farm","kimbo"
];

exports.handler = async () => {
  try {
    const locationSet = new Set(LOCATIONS);

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data } = await sb
        .from("profiles")
        .select("location, approved, is_approved, status")
        .limit(5000);

      (data || []).forEach((p) => {
        const active =
          p.approved === true ||
          p.is_approved === true ||
          String(p.status || "").toLowerCase() === "approved" ||
          String(p.status || "").toLowerCase() === "active";

        if (!active || !p.location) return;

        const slug = String(p.location)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        if (slug) locationSet.add(slug);
      });
    }

    const urls = [...locationSet].sort().map((slug) => `
  <url>
    <loc>${escapeXml(`${SITE_URL}/seo/locations/${slug}.html`)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join("");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`
    };

  } catch (error) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`
    };
  }
};
