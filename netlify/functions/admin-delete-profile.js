const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROFILES_TABLE = process.env.PROFILES_TABLE || "profiles";
const ADMINS_TABLE = process.env.ADMINS_TABLE || "admin_users";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

function safeLower(value) {
  return String(value || "").trim().toLowerCase();
}

function getBearerToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

async function isAuthorizedAdmin(admin, token) {
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);

  if (error || !user) return { ok: false, reason: "Invalid or expired session" };

  const userEmail = safeLower(user.email);
  const userId = user.id;

  const { data: adminRow } = await admin
    .from(ADMINS_TABLE)
    .select("id")
    .or(`user_id.eq.${userId},email.eq.${userEmail}`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (adminRow) return { ok: true, user };

  const { data: profileRow } = await admin
    .from(PROFILES_TABLE)
    .select("id,is_admin,admin,is_active")
    .or(`user_id.eq.${userId},email.eq.${userEmail}`)
    .limit(1)
    .maybeSingle();

  if (profileRow && (profileRow.is_admin === true || profileRow.admin === true)) {
    if (profileRow.is_active === undefined || profileRow.is_active === true) {
      return { ok: true, user };
    }
  }

  const allowedEmails = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map(safeLower)
    .filter(Boolean);

  if (allowedEmails.includes(userEmail)) return { ok: true, user };

  return { ok: false, reason: "Admin access required" };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase environment variables" });
    }

    const token = getBearerToken(event);
    if (!token) return json(401, { error: "Missing bearer token" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authCheck = await isAuthorizedAdmin(admin, token);
    if (!authCheck.ok) return json(403, { error: authCheck.reason });

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
      return json(500, { error: "Failed to delete profile", details: error.message });
    }

    return json(200, { ok: true, deleted: true, profile_id: profileId });
  } catch (err) {
    return json(500, { error: "Server error", details: err.message || String(err) });
  }
};
