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

    const { queue_id, profile_id } = JSON.parse(event.body || "{}");
    if (!queue_id) return json(400, { error: "Missing queue_id" });

    const { error: paymentError } = await supabase
      .from("stk_push_payments")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", queue_id);

    if (paymentError) throw paymentError;

    if (profile_id) {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          payment_status: "paid",
          status: "active",
          expires_at: expires.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile_id);

      if (profileError) throw profileError;
    }

    return json(200, { ok: true });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || "Approve payment failed" });
  }
};
