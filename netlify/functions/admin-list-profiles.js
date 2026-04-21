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
    body: JSON.stringify(body),
  };
}

function getBearerToken(headers = {}) {
  const auth = headers.authorization || headers.Authorization || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const ADMIN_TOKEN = (process.env.ADMIN_APPROVAL_TOKEN || "").trim();
    const suppliedToken = getBearerToken(event.headers);

    if (!ADMIN_TOKEN || suppliedToken !== ADMIN_TOKEN) {
      return json(401, { ok: false, error: "Unauthorized" });
    }

    const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
    const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { ok: false, error: "Missing Supabase env vars" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, { ok: true, profiles: data || [] });
  } catch (err) {
    return json(500, { ok: false, error: err.message || "Server error" });
  }
};
