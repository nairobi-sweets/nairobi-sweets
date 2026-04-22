const {
  PROFILES_TABLE,
  corsHeaders,
  json,
  requireAdmin,
  writeAuditLog,
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

    const { admin, user, source } = auth;
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

    const { data: beforeRow, error: beforeError } = await admin
      .from(PROFILES_TABLE)
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    if (beforeError) {
      return json(500, {
        error: "Failed to read current profile state",
        details: beforeError.message,
      });
    }

    if (!beforeRow) {
      return json(404, { error: "Profile not found" });
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

    await writeAuditLog(admin, {
      admin_user_id: user.id,
      admin_email: user.email || null,
      action: "toggle_payment",
      target_table: PROFILES_TABLE,
      target_id: String(profileId),
      target_label: data.stage_name || data.full_name || data.name || null,
      before_data: beforeRow,
      after_data: data,
      meta: {
        source,
        payment_status: paymentStatus,
      },
    });

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
