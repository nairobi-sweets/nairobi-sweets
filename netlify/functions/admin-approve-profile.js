const { json, requirePermission, safeString } = require("./_adminAuth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requirePermission(event, "profiles.approve");
    if (!auth.ok) return auth.response;

    const { adminClient, adminRow, authUser } = auth;

    const body = JSON.parse(event.body || "{}");
    const profileId = safeString(body.profileId);
    const action = safeString(body.action).toLowerCase();

    if (!profileId) {
      return json(400, { ok: false, error: "profileId is required" });
    }

    let patch = {};

    if (action === "approve") {
      patch = {
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: authUser?.email || adminRow?.user_id || "admin",
        status: "approved"
      };
    } else if (action === "unapprove") {
      patch = {
        is_approved: false,
        status: "pending"
      };
    } else {
      return json(400, {
        ok: false,
        error: "Invalid action. Allowed actions: approve, unapprove"
      });
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
      message: action === "approve"
        ? "Profile approved successfully"
        : "Profile moved back to pending successfully",
      profile: data
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error"
    });
  }
};
