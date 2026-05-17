const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const body = JSON.parse(event.body || "{}");

    if (!body.stage_name || !body.phone) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Stage name and phone are required"
        })
      };
    }

    const tier = body.tier || "featured";

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        stage_name: body.stage_name,
        phone: body.phone,
        whatsapp: body.whatsapp || body.phone,

        location: body.location || body.area || "Nairobi",
        area: body.area || body.location || "Nairobi",
        city: body.city || "Nairobi",

        bio: body.bio || "",
        photo_url: body.photo_url || "",
        image_url: body.photo_url || "",

        tier,

        approved: true,
        subscription_status: "active",

        views_count: Number(body.views_count || 0),
        likes_count: Number(body.likes_count || 0),

        is_featured: tier === "featured",
        is_vip: tier === "vip",
        is_vvip: tier === "vvip" || tier === "signature",

        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        profile: data
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};
