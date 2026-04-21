const {
  safeString,
  json,
  requirePermission,
  normalizeRole,
} = require("./_adminAuth");

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

    const { adminClient, authUser } = auth;

    const body = JSON.parse(event.body || "{}");
    const userId = safeString(body.userId);

    if (!userId) {
      return json(400, { ok: false, error: "userId is required" });
    }

    const { data: target, error: targetError } = await adminClient
      .from("admin_users")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError) {
      return json(500, { ok: false, error: targetError.message });
    }

    if (!target) {
      return json(404, { ok: false, error: "Admin user not found" });
    }

    if (normalizeRole(target.role) === "super_admin" && authUser.id === userId) {
      return json(400, { ok: false, error: "You cannot deactivate yourself" });
    }

    const { data, error } = await adminClient
      .from("admin_users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: authUser.id,
      })
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, {
      ok: true,
      adminUser: data
    });
  } catch (error) {
    return json(400, {
      ok: false,
      error: error.message || "Unexpected server error"
    });
  }
};
