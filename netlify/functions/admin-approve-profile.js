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
