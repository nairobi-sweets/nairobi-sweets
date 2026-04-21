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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const ROLE_PERMISSIONS = {
  viewer: ["profiles.read", "dashboard.read"],
  admin: ["profiles.read", "dashboard.read", "profiles.approve", "profiles.renew"],
  super_admin: [
    "profiles.read",
    "dashboard.read",
    "profiles.approve",
    "profiles.renew",
    "profiles.delete",
    "admins.manage"
  ]
};

function normalizeRole(role) {
  const clean = safeString(role).toLowerCase();
  if (clean === "super_admin") return "super_admin";
  if (clean === "admin") return "admin";
  if (clean === "viewer") return "viewer";
  return "";
}

function getPermissionsForRole(role) {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized] || [];
}

function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

async function getAuthenticatedAdmin(event) {
  const token = getBearerToken(event);
  if (!token) {
    return {
      ok: false,
      response: json(401, { ok: false, error: "Missing bearer token" }),
    };
  }

  const { adminClient } = getSupabaseClients();

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);

  if (userError || !userData?.user) {
    return {
      ok: false,
      response: json(401, { ok: false, error: "Invalid or expired session" }),
    };
  }

  const authUser = userData.user;

  const { data: adminRow, error: adminError } = await adminClient
    .from("admin_users")
    .select("*")
    .eq("user_id", authUser.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    return {
      ok: false,
      response: json(500, { ok: false, error: adminError.message }),
    };
  }

  if (!adminRow) {
    return {
      ok: false,
      response: json(403, { ok: false, error: "Admin access required" }),
    };
  }

  const role = normalizeRole(adminRow.role);

  if (!role) {
    return {
      ok: false,
      response: json(403, { ok: false, error: "Invalid admin role" }),
    };
  }

  return {
    ok: true,
    adminClient,
    authUser,
    adminRow: {
      ...adminRow,
      role,
      permissions: getPermissionsForRole(role)
    }
  };
}

async function requirePermission(event, permission) {
  const auth = await getAuthenticatedAdmin(event);
  if (!auth.ok) return auth;

  if (!hasPermission(auth.adminRow.role, permission)) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: `Permission denied: ${permission}`,
        role: auth.adminRow.role
      }),
    };
  }

  return auth;
}

function assertValidRole(role) {
  const normalized = normalizeRole(role);
  if (!normalized) {
    throw new Error("Invalid role. Allowed roles: viewer, admin, super_admin");
  }
  return normalized;
}

function canAssignRole(actorRole, targetRole) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);

  if (!actor || !target) return false;
  if (actor !== "super_admin") return false;

  return ["viewer", "admin", "super_admin"].includes(target);
}

module.exports = {
  safeString,
  json,
  normalizeRole,
  getPermissionsForRole,
  hasPermission,
  getAuthenticatedAdmin,
  requirePermission,
  assertValidRole,
  canAssignRole,
};
