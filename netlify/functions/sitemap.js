const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async () => {
  try {

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("slug, updated_at")
      .eq("approved", true);

    if (error) throw error;

    let urls = `
<url>
  <loc>https://nairobi-sweets.com/</loc>
</url>

<url>
  <loc>https://nairobi-sweets.com/join.html</loc>
</url>

<url>
  <loc>https://nairobi-sweets.com/trending.html</loc>
</url>

<url>
  <loc>https://nairobi-sweets.com/shorts.html</loc>
</url>

<url>
  <loc>https://nairobi-sweets.com/reel.html</loc>
</url>
`;

    profiles.forEach(profile => {
      urls += `
<url>
  <loc>https://nairobi-sweets.com/profile.html?slug=${profile.slug}</loc>
  <lastmod>${new Date(profile.updated_at).toISOString()}</lastmod>
</url>
`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml"
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
