const { corsHeaders, json, requireAdmin } = require("./_adminAuth");

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

    return json(200, {
      ok: true,
      admin: {
        id: auth.user.id,
        email: auth.user.email || "",
        source: auth.source,
      },
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        paid: 0,
        unpaid: 0,
      },
      profiles: [],
    });
  } catch (err) {
    return json(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};
