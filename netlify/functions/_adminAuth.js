const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROFILES_TABLE = process.env.PROFILES_TABLE || "profiles";
const ADMINS_TABLE = process.env.ADMINS_TABLE || "admin_users";
const AUDIT_TABLE = process.env.ADMIN_AUDIT_TABLE || "admin_audit_logs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  const authHeader =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

function createAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function isAuthorizedAdmin(admin, token) {
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false,
      statusCode: 401,
      error: "Invalid or expired session",
    };
  }

  const userId = user.id;
  const userEmail = safeLower(user.email);

  const { data: adminRow, error: adminRowError } = await admin
    .from(ADMINS_TABLE)
    .select("id,email,user_id,is_active")
    .or(`user_id.eq.${userId},email.eq.${userEmail}`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!adminRowError && adminRow) {
    return {
      ok: true,
      user,
      source: "admin_users",
    };
  }

  const { data: profileRow, error: profileError } = await admin
    .from(PROFILES_TABLE)
    .select("id,email,user_id,is_admin,admin,is_active")
    .or(`user_id.eq.${userId},email.eq.${userEmail}`)
    .limit(1)
    .maybeSingle();

  if (!profileError && profileRow) {
    const flaggedAdmin =
      profileRow.is_admin === true || profileRow.admin === true;

    const activeOk =
      profileRow.is_active === undefined || profileRow.is_active === true;

    if (flaggedAdmin && activeOk) {
      return {
        ok: true,
        user,
        source: "profiles",
      };
    }
  }

  const allowedEmails = String(
    process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || ""
  )
    .split(",")
    .map(safeLower)
    .filter(Boolean);

  if (allowedEmails.includes(userEmail)) {
    return {
      ok: true,
      user,
      source: "env",
    };
  }

  return {
    ok: false,
    statusCode: 403,
    error: "Admin access required",
    message: "Logged in, but not authorized as an active admin.",
    email: userEmail,
  };
}

async function requireAdmin(event) {
  const token = getBearerToken(event);
  if (!token) {
    return {
      ok: false,
      response: json(401, { error: "Missing bearer token" }),
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      response: json(500, { error: err.message || "Server configuration error" }),
    };
  }

  const authCheck = await isAuthorizedAdmin(admin, token);
  if (!authCheck.ok) {
    return {
      ok: false,
      response: json(authCheck.statusCode || 403, {
        error: authCheck.error || "Admin access required",
        message: authCheck.message,
        email: authCheck.email,
      }),
    };
  }

  return {
    ok: true,
    admin,
    user: authCheck.user,
    source: authCheck.source,
  };
}

async function writeAuditLog(admin, payload = {}) {
  try {
    const insertPayload = {
      admin_user_id: payload.admin_user_id || null,
      admin_email: payload.admin_email || null,
      action: payload.action || "unknown_action",
      target_table: payload.target_table || "profiles",
      target_id: payload.target_id || null,
      target_label: payload.target_label || null,
      before_data: payload.before_data ?? null,
      after_data: payload.after_data ?? null,
      meta: payload.meta ?? null,
    };

    const { error } = await admin
      .from(AUDIT_TABLE)
      .insert(insertPayload);

    if (error) {
      console.error("audit log insert failed:", error.message);
    }
  } catch (err) {
    console.error("audit log write error:", err.message || String(err));
  }
}

module.exports = {
  PROFILES_TABLE,
  ADMINS_TABLE,
  AUDIT_TABLE,
  corsHeaders,
  json,
  safeLower,
  getBearerToken,
  createAdminClient,
  isAuthorizedAdmin,
  requireAdmin,
  writeAuditLog,
};
