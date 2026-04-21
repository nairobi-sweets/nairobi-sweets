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

    const { ids } = JSON.parse(event.body || "{}");
    if (!Array.isArray(ids) || !ids.length) {
      return json(400, { error: "No IDs provided" });
    }

    const { error } = await supabase
      .from("profiles")
      .delete()
      .in("id", ids);

    if (error) throw error;

    return json(200, { ok: true, deleted: ids.length });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || "Delete failed" });
  }
};
