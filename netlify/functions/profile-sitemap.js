```javascript
// netlify/functions/profile-sitemap.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async () => {
  try {

    const { data: profiles, error } = await sb
      .from("profiles")
      .select(`
        id,
        slug,
        updated_at,
        approved
      `)
      .eq("approved", true)
      .order("id", { ascending: false });

    if (error) throw error;

    const urls = (profiles || [])
      .map(profile => {

        const profileUrl =
          profile.slug &&
          String(profile.slug).trim() !== ""
            ? `https://nairobi-sweets.com/profile.html?slug=${encodeURIComponent(profile.slug)}`
            : `https://nairobi-sweets.com/profile.html?id=${profile.id}`;

        const lastmod =
          profile.updated_at ||
          new Date().toISOString();

        return `
<url>
  <loc>${profileUrl}</loc>
  <lastmod>${lastmod}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls}

</urlset>`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600"
      },
      body: xml
    };

  } catch (err) {

    return {
      statusCode: 500,
      body: err.message
    };

  }
};
```
