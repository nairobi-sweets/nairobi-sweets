const { safeString, json, requirePermission } = require("./_adminAuth");

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

    const { adminClient, authUser, adminRow } = auth;

    const body = JSON.parse(event.body || "{}");
    const profileId = safeString(body.profileId);
    const tableName = safeString(body.tableName) || "profiles";
    const idColumn = safeString(body.idColumn) || "id";

    if (!profileId) {
      return json(400, { ok: false, error: "profileId is required" });
    }

    const { data: existing, error: existingError } = await adminClient
      .from(tableName)
      .select("*")
      .eq(idColumn, profileId)
      .maybeSingle();

    if (existingError) {
      return json(500, { ok: false, error: existingError.message });
    }

    if (!existing) {
      return json(404, { ok: false, error: "Profile not found" });
    }

    const patch = {};
    const now = new Date().toISOString();

    if ("payment_status" in existing) patch.payment_status = "approved";
    else if ("status" in existing) patch.status = "approved";
    else patch.payment_status = "approved";

    if ("approval_status" in existing) patch.approval_status = "approved";
    if ("listing_status" in existing) patch.listing_status = "active";
    if ("is_approved" in existing) patch.is_approved = true;
    if ("approved_at" in existing) patch.approved_at = now;
    if ("updated_at" in existing) patch.updated_at = now;
    if ("approved_by" in existing) patch.approved_by = authUser.id;
    if ("last_admin_action_by" in existing) patch.last_admin_action_by = authUser.id;
    if ("last_admin_action_role" in existing) patch.last_admin_action_role = adminRow.role;

    const { data: updated, error: updateError } = await adminClient
      .from(tableName)
      .update(patch)
      .eq(idColumn, profileId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      return json(500, { ok: false, error: updateError.message });
    }

    return json(200, {
      ok: true,
      message: "Profile approved successfully",
      profile: updated,
      currentAdmin: {
        role: adminRow.role,
        permissions: adminRow.permissions
      }
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error",
    });
  }
};
