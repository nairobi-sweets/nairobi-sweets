const {
  PROFILES_TABLE,
  corsHeaders,
  sendJson,
  safeLower,
  requireAdmin,
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "GET") {
      return sendJson(405, { error: "Method not allowed" });
    }

    const auth = await requireAdmin(event);
    if (!auth.ok) return auth.response;

    const { admin, user, source } = auth;
    const qs = event.queryStringParameters || {};
    const search = String(qs.search || "").trim();
    const status = String(qs.status || "").trim().toLowerCase();
    const limit = Math.min(parseInt(qs.limit || "200", 10) || 200, 500);

    let query = admin
      .from(PROFILES_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(
        [
          `name.ilike.%${search}%`,
          `full_name.ilike.%${search}%`,
          `stage_name.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          `plan.ilike.%${search}%`,
          `payment_status.ilike.%${search}%`,
          `approval_status.ilike.%${search}%`,
          `status.ilike.%${search}%`,
        ].join(",")
      );
    }

    if (status) {
      if (status === "pending" || status === "approved") {
        query = query.eq("approval_status", status);
      } else if (status === "paid" || status === "unpaid") {
        query = query.eq("payment_status", status);
      }
    }

    const { data, error } = await query;

    if (error) {
      return sendJson(500, {
        error: "Failed to load profiles",
        details: error.message,
      });
    }

    const rows = Array.isArray(data) ? data : [];

    const summary = {
      total: rows.length,
      pending: rows.filter((r) => safeLower(r.approval_status) === "pending").length,
      approved: rows.filter((r) => safeLower(r.approval_status) === "approved").length,
      paid: rows.filter((r) => safeLower(r.payment_status) === "paid").length,
      unpaid: rows.filter((r) => safeLower(r.payment_status) === "unpaid").length,
    };

    return sendJson(200, {
      ok: true,
      admin: {
        id: user.id,
        email: user.email || "",
        source,
      },
      summary,
      profiles: rows,
    });
  } catch (err) {
    return sendJson(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};
