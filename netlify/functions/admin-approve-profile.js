const { json, requirePermission } = require("./_adminAuth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requirePermission(event, "admins.manage");
    if (!auth.ok) return auth.response;

    const { adminClient, adminRow } = auth;

    const body = JSON.parse(event.body || "{}");
    const profileId = String(body.profileId || "").trim();
    const action = String(body.action || "").trim().toLowerCase();

    if (!profileId) {
      return json(400, { ok: false, error: "profileId is required" });
    }

    let patch = {};

    if (action === "approve") {
      patch = {
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: adminRow.email || adminRow.id || "admin",
        status: "approved"
      };
    } else if (action === "unapprove") {
      patch = {
        is_approved: false,
        status: "pending"
      };
    } else if (action === "reject") {
      patch = {
        is_approved: false,
        status: "rejected"
      };
    } else {
      return json(400, { ok: false, error: "Invalid action" });
    }

    const { data, error } = await adminClient
      .from("profiles")
      .update(patch)
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, {
      ok: true,
      message: `Profile ${action}d successfully`,
      profile: data
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error"
    });
  }
};
