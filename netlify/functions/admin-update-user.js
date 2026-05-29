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

    const userId = String(body.id || body.user_id || "").trim();
    const name = body.name !== undefined ? String(body.name || "").trim() : null;
    const email = body.email !== undefined ? String(body.email || "").trim().toLowerCase() : null;
    const role = body.role !== undefined ? String(body.role || "").trim().toLowerCase() : null;
    const password = body.password !== undefined ? String(body.password || "") : null;
    const isActive =
      body.is_active !== undefined
        ? Boolean(body.is_active)
        : null;

    if (!userId) {
      return json(400, {
        ok: false,
        message: "User ID is required"
      });
    }

    const { data: targetUser, error: targetError } = await supabase
      .from("admin_users")
      .select("id,name,email,role,is_active")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      return json(500, {
        ok: false,
        message: targetError.message
      });
    }

    if (!targetUser) {
      return json(404, {
        ok: false,
        message: "Admin user not found"
      });
    }

    if (
      targetUser.role === "owner" &&
      auth.admin.role !== "owner"
    ) {
      return json(403, {
        ok: false,
        message: "Only owner can modify owner accounts"
      });
    }

    if (
      role === "owner" &&
      auth.admin.role !== "owner"
    ) {
      return json(403, {
        ok: false,
        message: "Only owner can assign owner role"
      });
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (name !== null) {
      if (!name) {
        return json(400, {
          ok: false,
          message: "Name cannot be empty"
        });
      }
      updates.name = name;
    }

    if (email !== null) {
      if (!email) {
        return json(400, {
          ok: false,
          message: "Email cannot be empty"
        });
      }
      updates.email = email;
    }

    if (role !== null) {
      if (!ALLOWED_ROLES.includes(role)) {
        return json(400, {
          ok: false,
          message: "Invalid role"
        });
      }
      updates.role = role;
    }

    if (isActive !== null) {
      if (
        targetUser.id === auth.admin.id &&
        isActive === false
      ) {
        return json(400, {
          ok: false,
          message: "You cannot deactivate your own account"
        });
      }
      updates.is_active = isActive;
    }

    if (password !== null && password.length > 0) {
      if (password.length < 8) {
        return json(400, {
          ok: false,
          message: "Password must be at least 8 characters"
        });
      }

      updates.password_hash = await bcrypt.hash(
        password,
        12
      );
    }

    const { data, error } = await supabase
      .from("admin_users")
      .update(updates)
      .eq("id", userId)
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
      action: "admin_user_updated",
      admin: auth.admin,
      details: `Updated admin user ${data.email}`
    });

    return json(200, {
      ok: true,
      message: "Admin user updated",
      user: data
    });

  } catch (error) {
    return json(500, {
      ok: false,
      message: error.message
    });
  }
};
