const {
  safeString,
  json,
  requirePermission,
  assertValidRole,
  canAssignRole,
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
    const email = safeString(body.email).toLowerCase();
    const requestedRole = assertValidRole(body.role);
    const isActive = body.isActive === false ? false : true;

    if (!userId) {
      return json(400, { ok: false, error: "userId is required" });
    }

    if (!canAssignRole(adminRow.role, requestedRole)) {
      return json(403, { ok: false, error: "You cannot assign that role" });
    }

    const now = new Date().toISOString();

    const payload = {
      user_id: userId,
      email: email || null,
      role: requestedRole,
      is_active: isActive,
      updated_at: now,
      updated_by: authUser.id,
    };

    const { data: existing, error: existingError } = await adminClient
      .from("admin_users")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      return json(500, { ok: false, error: existingError.message });
    }

    let result;
    let action;

    if (existing) {
      const { data, error } = await adminClient
        .from("admin_users")
        .update(payload)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle();

      if (error) {
        return json(500, { ok: false, error: error.message });
      }

      result = data;
      action = "updated";
    } else {
      const insertPayload = {
        ...payload,
        created_at: now,
        created_by: authUser.id,
      };

      const { data, error } = await adminClient
        .from("admin_users")
        .insert(insertPayload)
        .select("*")
        .maybeSingle();

      if (error) {
        return json(500, { ok: false, error: error.message });
      }

      result = data;
      action = "created";
    }

    return json(200, {
      ok: true,
      action,
      adminUser: result
    });
  } catch (error) {
    return json(400, {
      ok: false,
      error: error.message || "Unexpected server error"
    });
  }
};
