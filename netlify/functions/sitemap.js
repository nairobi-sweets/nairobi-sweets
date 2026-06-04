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

function cleanSlug(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeDate(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function profileSlug(profile) {
  return (
    cleanSlug(profile.slug) ||
    cleanSlug(`${profile.stage_name || profile.name || "profile"}-${profile.location || profile.id}`)
  );
}

function profileUrl(profile) {
  const slug = profileSlug(profile);

  if (slug) {
    return `${SITE_URL}/profile.html?slug=${encodeURIComponent(slug)}`;
  }

  return `${SITE_URL}/profile.html?id=${encodeURIComponent(profile.id)}`;
}

exports.handler = async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables.");
    }

    const { data, error } = await sb
      .from("profiles")
      .select(`
        id,
        slug,
        stage_name,
        name,
        location,
        updated_at,
        created_at,
        approved,
        is_approved,
        status
      `)
      .order("id", { ascending: false })
      .limit(5000);

    if (error) throw error;

    const profiles = (data || []).filter((p) => {
      return (
        p.approved === true ||
        p.is_approved === true ||
        String(p.status || "").toLowerCase() === "approved" ||
        String(p.status || "").toLowerCase() === "active"
      );
    });

    const urls = profiles
      .map((profile) => {
        const url = profileUrl(profile);
        const lastmod = safeDate(profile.updated_at || profile.created_at);

        return `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
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
      body: `Profile sitemap error: ${err.message}`
    };
  }
};
