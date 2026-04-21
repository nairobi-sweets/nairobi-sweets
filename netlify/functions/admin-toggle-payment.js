const {
  PROFILES_TABLE,
  corsHeaders,
  json,
  requireAdmin,
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const auth = await requireAdmin(event);
    if (!auth.ok) return auth.response;

    const { admin } = auth;
    const body = JSON.parse(event.body || "{}");

    const profileId = body.profile_id;
    const paymentStatus = String(body.payment_status || "").trim().toLowerCase();

    if (!profileId) {
      return json(400, { error: "profile_id is required" });
    }

    if (!["paid", "unpaid"].includes(paymentStatus)) {
      return json(400, {
        error: "payment_status must be 'paid' or 'unpaid'",
      });
    }

    const patch = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    };

    if (paymentStatus === "paid") {
      patch.payment_verified = true;
    }

    const { data, error } = await admin
      .from(PROFILES_TABLE)
      .update(patch)
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) {
      return json(500, {
        error: "Failed to update payment status",
        details: error.message,
      });
    }

    return json(200, {
      ok: true,
      profile: data,
    });
  } catch (err) {
    return json(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};
