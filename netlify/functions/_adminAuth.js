const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  };
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROLE_PERMISSIONS = {
  owner: [
    "profiles.view",
    "profiles.create",
    "profiles.edit",
    "profiles.approve",
    "profiles.delete",
    "payments.view",
    "payments.retry",
    "renewals.run",
    "analytics.view",
    "staff.manage"
  ],

  manager: [
    "profiles.view",
    "profiles.create",
    "profiles.edit",
    "profiles.approve",
    "payments.view",
    "payments.retry",
    "renewals.run",
    "analytics.view"
  ],

  staff: [
    "profiles.view",
    "profiles.approve",
    "analytics.view"
  ]
};

function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

async function getAdminFromRequest(event, requiredPermission = null) {
  const authHeader =
    event.headers.authorization ||
    event.headers.Authorization ||
    "";

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false,
      response: json(401, {
        ok: false,
        message: "Missing admin token"
      })
    };
  }

  const now = new Date().toISOString();

  const { data: session, error: sessionError } =
    await supabase
      .from("admin_sessions")
      .select("*")
      .eq("token", token)
      .gt("expires_at", now)
      .maybeSingle();

  if (sessionError) {
    return {
      ok: false,
      response: json(500, {
        ok: false,
        message: sessionError.message
      })
    };
  }

  if (!session) {
    return {
      ok: false,
      response: json(401, {
        ok: false,
        message: "Session expired or invalid"
      })
    };
  }

  const { data: admin, error: adminError } =
    await supabase
      .from("admin_users")
      .select("id,name,email,role,is_active")
      .eq("id", session.admin_id)
      .eq("is_active", true)
      .maybeSingle();

  if (adminError) {
    return {
      ok: false,
      response: json(500, {
        ok: false,
        message: adminError.message
      })
    };
  }

  if (!admin) {
    return {
      ok: false,
      response: json(401, {
        ok: false,
        message: "Admin account not found or inactive"
      })
    };
  }

  if (
    requiredPermission &&
    !hasPermission(admin.role, requiredPermission)
  ) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        message: "Permission denied",
        required_permission: requiredPermission,
        role: admin.role
      })
    };
  }

  return {
    ok: true,
    admin,
    session
  };
}

async function auditAdminAction({
  action,
  admin,
  profile_id = null,
  profile_name = null,
  details = null
}) {
  try {
    await supabase
      .from("admin_audit_logs")
      .insert({
        action,
        admin_name:
          admin?.name ||
          admin?.email ||
          "Unknown Admin",
        profile_id,
        profile_name,
        details,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.log("Audit failed:", error.message);
  }
}

module.exports = {
  supabase,
  json,
  ROLE_PERMISSIONS,
  hasPermission,
  getAdminFromRequest,
  auditAdminAction
};
