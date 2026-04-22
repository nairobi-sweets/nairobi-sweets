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
    const approvalStatus = String(body.approval_status || "approved")
      .trim()
      .toLowerCase();

    if (!profileId) {
      return json(400, { error: "profile_id is required" });
    }

    if (!["pending", "approved", "rejected"].includes(approvalStatus)) {
      return json(400, {
        error: "approval_status must be 'pending', 'approved', or 'rejected'",
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
      approval_status: approvalStatus,
      updated_at: new Date().toISOString(),
    };

    if (approvalStatus === "approved") {
      patch.status = "active";
    }

    const { data, error } = await admin
      .from(PROFILES_TABLE)
      .update(patch)
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) {
      return json(500, {
        error: "Failed to update approval",
        details: error.message,
      });
    }

    await writeAuditLog(admin, {
      admin_user_id: user.id,
      admin_email: user.email || null,
      action: "approve_profile",
      target_table: PROFILES_TABLE,
      target_id: String(profileId),
      target_label: data.stage_name || data.full_name || data.name || null,
      before_data: beforeRow,
      after_data: data,
      meta: {
        source,
        approval_status: approvalStatus,
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
