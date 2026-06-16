const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async function () {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
        })
      };
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({
        live_lat: null,
        live_lng: null,
        live_accuracy: null,
        live_location_url: null,
        live_location_enabled: false,
        live_location_updated_at: null,
        live_location_expires_at: null
      })
      .eq("live_location_enabled", true)
      .lte("live_location_expires_at", now);

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: error.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, expired_before: now })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message || String(err) })
    };
  }
};
