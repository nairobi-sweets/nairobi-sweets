const { createClient } = require("@supabase/supabase-js");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
    body: JSON.stringify(body, null, 2),
  };
}

function getBearerToken(event) {
  const authHeader =
    event.headers.authorization ||
    event.headers.Authorization ||
    "";

  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7).trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const token = getBearerToken(event);

    const sb = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await sb.auth.getUser(token);

    if (userError || !userData?.user) {
      return json(401, {
        ok: false,
        stage: "auth.getUser",
        supabase_url: supabaseUrl,
        error: userError?.message || "Invalid session",
      });
    }

    const authUser = userData.user;

    const { data: adminRows, error: adminError } = await sb
      .from("admin_users")
      .select("*")
      .limit(10);

    const { data: exactRow, error: exactError } = await sb
      .from("admin_users")
      .select("*")
      .eq("user_id", authUser.id)
      .maybeSingle();

    return json(200, {
      ok: true,
      supabase_url: supabaseUrl,
      auth_user_id: authUser.id,
      auth_email: authUser.email || null,
      exact_match_found: !!exactRow,
      exact_match_error: exactError?.message || null,
      admin_users_error: adminError?.message || null,
      admin_users_sample_count: Array.isArray(adminRows) ? adminRows.length : 0,
      admin_users_sample: Array.isArray(adminRows)
        ? adminRows.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            email: r.email,
            role: r.role,
            is_active: r.is_active,
          }))
        : [],
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error",
    });
  }
};
