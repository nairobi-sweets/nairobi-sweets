const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const body = JSON.parse(event.body || "{}");

    const {
      stage_name,
      phone,
      whatsapp,
      location,
      area,
      city,
      bio,
      photo_url,
      tier
    } = body;

    if (!stage_name || !phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Name and phone are required" })
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        stage_name,
        phone,
        whatsapp: whatsapp || phone,
        location,
        area,
        city: city || "Nairobi",
        bio,
        photo_url,
        tier: tier || "featured",
        approved: true,
        subscription_status: "active",
        views_count: 0,
        likes_count: 0,
        is_featured: tier === "featured",
        is_vip: tier === "vip",
        is_vvip: tier === "vvip" || tier === "signature",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, profile: data })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
