const {
  PROFILES_TABLE,
  corsHeaders,
  sendJson,
  requireAdmin,
  writeAuditLog,
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return sendJson(405, { error: "Method not allowed" });
    }

    const auth = await requireAdmin(event);
    if (!auth.ok) return auth.response;

    const { admin, user, source } = auth;
    const body = JSON.parse(event.body || "{}");
    const profileId = body.profile_id;

    if (!profileId) {
      return sendJson(400, { error: "profile_id is required" });
    }

    const { data: beforeRow, error: beforeError } = await admin
      .from(PROFILES_TABLE)
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    if (beforeError) {
      return sendJson(500, {
        error: "Failed to read current profile state",
        details: beforeError.message,
      });
    }

    if (!beforeRow) {
      return sendJson(404, { error: "Profile not found" });
    }

    const patch = {
      approval_status: "approved",
      payment_status: "paid",
      payment_verified: true,
      status: "active",
      verified: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from(PROFILES_TABLE)
      .update(patch)
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) {
      return sendJson(500, {
        error: "Failed to go live",
        details: error.message,
      });
    }

    await writeAuditLog(admin, {
      admin_user_id: user.id,
      admin_email: user.email || null,
      action: "go_live_profile",
      target_table: PROFILES_TABLE,
      target_id: String(profileId),
      target_label: data.stage_name || data.full_name || data.name || null,
      before_data: beforeRow,
      after_data: data,
      meta: {
        source,
        go_live: true,
      },
    });

    return sendJson(200, {
      ok: true,
      profile: data,
    });
  } catch (err) {
    return sendJson(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};
