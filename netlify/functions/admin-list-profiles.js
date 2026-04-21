const { json, requirePermission } = require("./_adminAuth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requirePermission(event, "profiles.read");
    if (!auth.ok) return auth.response;

    const { adminClient, adminRow } = auth;

    const { data, error } = await adminClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, {
      ok: true,
      profiles: Array.isArray(data) ? data : [],
      currentAdmin: {
        role: adminRow.role,
        permissions: adminRow.permissions
      }
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error"
    });
  }
};
