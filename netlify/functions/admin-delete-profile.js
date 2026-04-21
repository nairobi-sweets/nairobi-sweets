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

    if (!profileId) {
      return json(400, { error: "profile_id is required" });
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

    const { error } = await admin
      .from(PROFILES_TABLE)
      .delete()
      .eq("id", profileId);

    if (error) {
      return json(500, {
        error: "Failed to delete profile",
        details: error.message,
      });
    }

    await writeAuditLog(admin, {
      admin_user_id: user.id,
      admin_email: user.email || null,
      action: "delete_profile",
      target_table: PROFILES_TABLE,
      target_id: String(profileId),
      target_label:
        beforeRow.stage_name || beforeRow.full_name || beforeRow.name || null,
      before_data: beforeRow,
      after_data: null,
      meta: {
        source,
        deleted: true,
      },
    });

    return json(200, {
      ok: true,
      deleted: true,
      profile_id: profileId,
    });
  } catch (err) {
    return json(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};
