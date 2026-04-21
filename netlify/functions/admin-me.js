const { json, requirePermission } = require("./_adminAuth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requirePermission(event, "dashboard.read");
    if (!auth.ok) return auth.response;

    const { authUser, adminRow } = auth;

    return json(200, {
      ok: true,
      admin: {
        user_id: authUser.id,
        email: authUser.email || adminRow.email || "",
        role: adminRow.role,
        permissions: adminRow.permissions,
        is_active: adminRow.is_active
      }
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error",
    });
  }
};
