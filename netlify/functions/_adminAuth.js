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
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok:false, response:json(401,{ok:false,message:"Please sign in to the vault."}) };
  let admin, session = null;
  // Supabase access tokens must be verified by Auth, never merely decoded.
  if (token.split(".").length === 3) {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return {ok:false,response:json(401,{ok:false,message:"Session expired or invalid. Please sign in again."})};
    const result = await supabase.from("admin_users")
      .select("id,name,email,role,is_active,auth_user_id")
      .eq("auth_user_id", data.user.id).eq("is_active", true).maybeSingle();
    if (result.error) return {ok:false,response:json(500,{ok:false,message:"Could not verify admin account."})};
    admin = result.data;
  } else {
    // Retain compatibility for existing role-login clients.
    const result = await supabase.from("admin_sessions").select("*")
      .eq("token",token).gt("expires_at",new Date().toISOString()).maybeSingle();
    if (result.error) return {ok:false,response:json(500,{ok:false,message:"Could not verify admin session."})};
    session = result.data;
    if (!session) return {ok:false,response:json(401,{ok:false,message:"Session expired or invalid"})};
    const resultAdmin = await supabase.from("admin_users")
      .select("id,name,email,role,is_active,auth_user_id")
      .eq("id",session.admin_id).eq("is_active",true).maybeSingle();
    if (resultAdmin.error) return {ok:false,response:json(500,{ok:false,message:"Could not verify admin account."})};
    admin = resultAdmin.data;
  }
  if (!admin) return {ok:false,response:json(403,{ok:false,message:"This account is not an active linked admin."})};
  admin.role = String(admin.role || "").toLowerCase();
  if (requiredPermission && !hasPermission(admin.role,requiredPermission))
    return {ok:false,response:json(403,{ok:false,message:"Permission denied",required_permission:requiredPermission,role:admin.role})};
  return {ok:true,admin,session};
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
