const {
  AUDIT_TABLE,
  corsHeaders,
  json,
  requireAdmin,
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "GET") {
      return json(405, { error: "Method not allowed" });
    }

    const auth = await requireAdmin(event);
    if (!auth.ok) return auth.response;

    const { admin } = auth;
    const qs = event.queryStringParameters || {};
    const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
    const action = String(qs.action || "").trim();

    let query = admin
      .from(AUDIT_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (action) {
      query = query.eq("action", action);
    }

    const { data, error } = await query;

    if (error) {
      return json(500, {
        error: "Failed to load audit logs",
        details: error.message,
      });
    }

    return json(200, {
      ok: true,
      logs: data || [],
    });
  } catch (err) {
    return json(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};const {
  AUDIT_TABLE,
  corsHeaders,
  json,
  requireAdmin,
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "GET") {
      return json(405, { error: "Method not allowed" });
    }

    const auth = await requireAdmin(event);
    if (!auth.ok) return auth.response;

    const { admin } = auth;
    const qs = event.queryStringParameters || {};
    const limit = Math.min(parseInt(qs.limit || "50", 10) || 50, 200);
    const action = String(qs.action || "").trim();

    let query = admin
      .from(AUDIT_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (action) {
      query = query.eq("action", action);
    }

    const { data, error } = await query;

    if (error) {
      return json(500, {
        error: "Failed to load audit logs",
        details: error.message,
      });
    }

    return json(200, {
      ok: true,
      logs: data || [],
    });
  } catch (err) {
    return json(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};
