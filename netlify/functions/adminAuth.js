const { createClient } = require("@supabase/supabase-js");

function safeString(value) {
  return value == null ? "" : String(value).trim();
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
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

function getSupabaseClients() {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  return { adminClient };
}

async function requireAdmin(event) {
  const token = getBearerToken(event);
  if (!token) {
    return {
      ok: false,
      statusCode: 401,
      response: json(401, { ok: false, error: "Missing bearer token" }),
    };
  }

  const { adminClient } = getSupabaseClients();

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);

  if (userError || !userData?.user) {
    return {
      ok: false,
      statusCode: 401,
      response: json(401, { ok: false, error: "Invalid or expired session" }),
    };
  }

  const user = userData.user;

  const { data: adminRow, error: adminError } = await adminClient
    .from("admin_users")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    return {
      ok: false,
      statusCode: 500,
      response: json(500, { ok: false, error: adminError.message }),
    };
  }

  if (!adminRow) {
    return {
      ok: false,
      statusCode: 403,
      response: json(403, { ok: false, error: "Admin access required" }),
    };
  }

  if (!["admin", "super_admin"].includes(String(adminRow.role || "").trim())) {
    return {
      ok: false,
      statusCode: 403,
      response: json(403, { ok: false, error: "Insufficient admin role" }),
    };
  }

  return {
    ok: true,
    adminClient,
    authUser: user,
    adminRow,
  };
}

module.exports = {
  safeString,
  json,
  requireAdmin,
};
