const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

exports.handler = async () => {
  try {

    /*
    ==========================================
    STATIC SEO LOCATIONS
    ==========================================
    */

    const staticLocations = [
      "Nairobi",
      "Westlands",
      "Kilimani",
      "Karen",
      "Lavington",
      "Ngong Road",
      "Embakasi",
      "Pipeline",
      "South B",
      "South C",
      "Parklands",
      "Roysambu",
      "Kasarani",
      "Zimmerman",
      "Mirema",
      "TRM Drive",
      "Ruaka",
      "Ruiru",
      "Kiambu",
      "Thika",
      "Juja",
      "Kitengela",
      "Rongai",
      "Syokimau",
      "Mlolongo",
      "Athi River",
      "Mombasa",
      "Kisumu",
      "Nakuru",
      "Eldoret"
    ];

    /*
    ==========================================
    FETCH APPROVED PROFILES
    ==========================================
    */

    const { data, error } = await supabase
      .from("profiles")
      .select("location")
      .eq("approved", true);

    if (error) {
      throw error;
    }

    /*
    ==========================================
    EXTRACT LOCATIONS
    ==========================================
    */

    const dynamicLocations = [];

    (data || []).forEach(profile => {
      if (!profile.location) return;

      profile.location
        .split(",")
        .map(x => x.trim())
        .filter(Boolean)
        .forEach(loc => dynamicLocations.push(loc));
    });

    /*
    ==========================================
    MERGE + DEDUPE
    ==========================================
    */

    const allLocations = [
      ...staticLocations,
      ...dynamicLocations
    ];

    const uniqueLocations = [
      ...new Set(
        allLocations.map(x => x.trim())
      )
    ];

    /*
    ==========================================
    BUILD XML
    ==========================================
    */

    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    uniqueLocations.forEach(location => {

      const slug = slugify(location);

      xml += `
<url>
  <loc>${escapeXml(`https://nairobi-sweets.com/seo/locations/${slug}.html`)}</loc>
  <changefreq>daily</changefreq>
  <priority>0.8</priority>
</url>`;
    });

    xml += `</urlset>`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600"
      },
      body: xml
    };

  } catch (err) {

    console.error("LOCATION SITEMAP ERROR:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};
