const {
  supabase,
  json,
  getAdminFromRequest
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, {
        ok: false,
        message: "Method not allowed"
      });
    }

    const auth = await getAdminFromRequest(
      event,
      "analytics.view"
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return json(500, {
        ok: false,
        message: error.message
      });
    }

    return json(200, {
      ok: true,
      logs: data || []
    });

  } catch (error) {
    return json(500, {
      ok: false,
      message: error.message
    });
  }
};
