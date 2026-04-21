const {
  safeString,
  json,
  requirePermission,
  assertValidRole,
  canAssignRole,
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

    const { adminClient, authUser, adminRow } = auth;

    const body = JSON.parse(event.body || "{}");
    const userId = safeString(body.userId);
    const nextRole = assertValidRole(body.role);

    if (!userId) {
      return json(400, { ok: false, error: "userId is required" });
    }

    if (!canAssignRole(adminRow.role, nextRole)) {
      return json(403, { ok: false, error: "You cannot assign that role" });
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

    if (normalizeRole(target.role) === "super_admin" && authUser.id === userId && nextRole !== "super_admin") {
      return json(400, { ok: false, error: "You cannot demote yourself from super_admin" });
    }

    const { data, error } = await adminClient
      .from("admin_users")
      .update({
        role: nextRole,
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
