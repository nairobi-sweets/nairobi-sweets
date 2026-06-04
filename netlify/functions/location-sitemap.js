const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE_URL = "https://nairobi-sweets.com";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const STATIC_LOCATIONS = [
  "nairobi",
  "kilimani",
  "westlands",
  "lavington",
  "ngong-road",
  "embakasi",
  "south-b",
  "south-c",
  "parklands",
  "karen",
  "rongai",
  "kitengela",
  "kasarani",
  "roysambu",
  "ruaka",
  "ruiru",
  "kiambu",
  "thika",
  "juja",
  "zimmerman",
  "mirema",
  "trm",
  "githurai",
  "donholm",
  "umoja",
  "buruburu",
  "fedha",
  "syokimau",
  "athi-river",
  "thindigua",
  "kiambu-road",
  "kahawa-west",
  "kahawa-sukari",
  "juja-farm",
  "kimbo"
];

exports.handler = async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables.");
    }

    const { data, error } = await sb
      .from("profiles")
      .select("location, coverage_areas, coverage, areas, approved, is_approved, status, updated_at, created_at")
      .limit(5000);

    if (error) throw error;

    const locations = new Set(STATIC_LOCATIONS);

    (data || [])
      .filter((p) =>
        p.approved === true ||
        p.is_approved === true ||
        String(p.status || "").toLowerCase() === "approved" ||
        String(p.status || "").toLowerCase() === "active"
      )
      .forEach((p) => {
        const rawValues = [
          p.location,
          p.coverage_areas,
          p.coverage,
          p.areas
        ];

        rawValues.forEach((value) => {
          if (!value) return;

          if (Array.isArray(value)) {
            value.forEach((v) => {
              const slug = slugify(v);
              if (slug) locations.add(slug);
            });
            return;
          }

          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                parsed.forEach((v) => {
                  const slug = slugify(v);
                  if (slug) locations.add(slug);
                });
                return;
              }
            } catch (_) {}

            value.split(/[,;\n]/).forEach((v) => {
              const slug = slugify(v);
              if (slug) locations.add(slug);
            });
          }
        });
      });

    const urls = [...locations]
      .filter(Boolean)
      .sort()
      .map((slug) => {
        return `  <url>
    <loc>${escapeXml(`${SITE_URL}/seo/locations/${slug}.html`)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      },
      body: xml
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      },
      body: `Location sitemap error: ${err.message}`
    };
  }
};
