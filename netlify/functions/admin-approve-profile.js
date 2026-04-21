const { createClient } = require("@supabase/supabase-js");

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

function getBearerToken(headers = {}) {
  const auth = headers.authorization || headers.Authorization || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
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

    const body = JSON.parse(event.body || "{}");
    const profileId = String(body.profileId || "").trim();
    const action = String(body.action || "approve").trim().toLowerCase();

    if (!profileId) {
      return json(400, { ok: false, error: "profileId is required" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let patch;

    if (action === "approve") {
      patch = {
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: "vault-admin",
        status: "approved",
      };
    } else if (action === "reject") {
      patch = {
        is_approved: false,
        status: "rejected",
      };
    } else if (action === "unapprove") {
      patch = {
        is_approved: false,
        status: "pending",
      };
    } else {
      return json(400, { ok: false, error: "Invalid action" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, {
      ok: true,
      message: `Profile ${action}d successfully`,
      profile: data,
    });
  } catch (err) {
    return json(500, { ok: false, error: err.message || "Server error" });
  }
};
