const {
  PROFILES_TABLE,
  corsHeaders,
  json,
  requireAdmin,
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const auth = await requireAdmin(event);
    if (!auth.ok) return auth.response;

    const { admin } = auth;
    const body = JSON.parse(event.body || "{}");

    const profileId = body.profile_id;

    if (!profileId) {
      return json(400, { error: "profile_id is required" });
    }

    const { error } = await admin
      .from(PROFILES_TABLE)
      .delete()
      .eq("id", profileId);

    if (error) {
      return json(500, {
        error: "Failed to delete profile",
        details: error.message,
      });
    }

    return json(200, {
      ok: true,
      deleted: true,
      profile_id: profileId,
    });
  } catch (err) {
    return json(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};
