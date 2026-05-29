const bcrypt = require("bcryptjs");

const {
  supabase,
  json,
  getAdminFromRequest,
  auditAdminAction
} = require("./_adminAuth");

const ALLOWED_ROLES = [
  "owner",
  "manager",
  "staff"
];

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, {
        ok: false,
        message: "Method not allowed"
      });
    }

    const auth = await getAdminFromRequest(
      event,
      "staff.manage"
    );

    if (!auth.ok) {
      return auth.response;
    }

    const body = JSON.parse(event.body || "{}");

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "staff").trim().toLowerCase();

    if (!name || !email || !password) {
      return json(400, {
        ok: false,
        message: "Name, email, and password are required"
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return json(400, {
        ok: false,
        message: "Invalid role"
      });
    }

    if (
      auth.admin.role !== "owner" &&
      role === "owner"
    ) {
      return json(403, {
        ok: false,
        message: "Only owner can create another owner"
      });
    }

    if (password.length < 8) {
      return json(400, {
        ok: false,
        message: "Password must be at least 8 characters"
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const { data, error } = await supabase
      .from("admin_users")
      .insert({
        name,
        email,
        password_hash: passwordHash,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      return json(500, {
        ok: false,
        message: error.message
      });
    }

    await auditAdminAction({
      action: "admin_user_created",
      admin: auth.admin,
      details: `Created ${role} account for ${email}`
    });

    return json(200, {
      ok: true,
      message: "Admin user created",
      user: data
    });

  } catch (error) {
    return json(500, {
      ok: false,
      message: error.message
    });
  }
};
