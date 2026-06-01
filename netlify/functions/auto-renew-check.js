const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async () => {
  try {
    const now = new Date();
    const soon = new Date();
    soon.setDate(now.getDate() + 2);

    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("approved", true)
      .eq("is_expired", false)
      .lte("plan_expires_at", soon.toISOString());

    if (error) throw error;

    const profiles = data || [];

    for (const p of profiles) {
      await sb.from("profiles").update({
        renewal_due: true,
        last_renewal_check_at: new Date().toISOString()
      }).eq("id", p.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        checked: profiles.length,
        message: "Auto-renew check complete"
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: err.message
      })
    };
  }
};
