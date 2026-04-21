const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROFILES_TABLE = process.env.PROFILES_TABLE || "profiles";
const ADMINS_TABLE = process.env.ADMINS_TABLE || "admin_users";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

function getBearerToken(event) {
  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

function safeLower(value) {
  return String(value || "").trim().toLowerCase();
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "GET") {
      return json(405, { error: "Method not allowed" });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const token = getBearerToken(event);
    if (!token) {
      return json(401, { error: "Missing bearer token" });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Validate logged-in user from JWT
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return json(401, { error: "Invalid or expired session" });
    }

    const userEmail = safeLower(user.email);
    const userId = user.id;

    // 2. Check admin access
    let isAuthorizedAdmin = false;
    let adminSource = null;

    // A. Check dedicated admin_users table first
    const { data: adminRow, error: adminRowError } = await admin
      .from(ADMINS_TABLE)
      .select("id,email,user_id,is_active")
      .or(`user_id.eq.${userId},email.eq.${userEmail}`)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!adminRowError && adminRow) {
      isAuthorizedAdmin = true;
      adminSource = "admin_users";
    }

    // B. Fallback to profiles.is_admin = true
    if (!isAuthorizedAdmin) {
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
          isAuthorizedAdmin = true;
          adminSource = "profiles";
        }
      }
    }

    // C. Final fallback to ADMIN_EMAIL env
    if (!isAuthorizedAdmin) {
      const allowedEmails = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
        .split(",")
        .map((v) => safeLower(v))
        .filter(Boolean);

      if (allowedEmails.includes(userEmail)) {
        isAuthorizedAdmin = true;
        adminSource = "env";
      }
    }

    if (!isAuthorizedAdmin) {
      return json(403, {
        error: "Admin access required",
        message: "Logged in, but not authorized as an active admin.",
        email: userEmail,
      });
    }

    // 3. Search params
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
      return json(500, {
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

    return json(200, {
      ok: true,
      admin: {
        id: userId,
        email: userEmail,
        source: adminSource,
      },
      summary,
      profiles: rows,
    });
  } catch (err) {
    return json(500, {
      error: "Server error",
      details: err.message || String(err),
    });
  }
};
