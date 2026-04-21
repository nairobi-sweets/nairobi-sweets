const { createClient } = require("@supabase/supabase-js");
const { json, requireAdmin } = require("./_admin-auth");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    await requireAdmin(event);

    const { profile_id } = JSON.parse(event.body || "{}");
    if (!profile_id) return json(400, { error: "Missing profile_id" });

    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: "approved",
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile_id);

    if (error) throw error;

    return json(200, { ok: true });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || "Approve failed" });
  }
};
