const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeToken() {
  return crypto.randomBytes(48).toString("hex");
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, {
        ok: false,
        message: "Method not allowed",
      });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        ok: false,
        message: "Missing Supabase environment variables",
      });
    }

    const body = JSON.parse(event.body || "{}");

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return json(400, {
        ok: false,
        message: "Email and password are required",
      });
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return json(500, {
        ok: false,
        message: error.message,
      });
    }

    if (!admin) {
      return json(401, {
        ok: false,
        message: "Invalid login details",
      });
    }

    const match = await bcrypt.compare(password, admin.password_hash || "");

    if (!match) {
      return json(401, {
        ok: false,
        message: "Invalid login details",
      });
    }

    const token = makeToken();

    const expiresAt = new Date(
      Date.now() + 12 * 60 * 60 * 1000
    ).toISOString();

    const { error: sessionError } = await supabase
      .from("admin_sessions")
      .insert({
        admin_id: admin.id,
        token,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });

    if (sessionError) {
      return json(500, {
        ok: false,
        message: sessionError.message,
      });
    }

    await supabase
      .from("admin_audit_logs")
      .insert({
        action: "admin_login",
        admin_name: admin.name || admin.email,
        profile_id: null,
        profile_name: null,
        details: `Role: ${admin.role}`,
        created_at: new Date().toISOString(),
      })
      .then(() => null)
      .catch(() => null);

    return json(200, {
      ok: true,
      message: "Login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      expires_at: expiresAt,
    });

  } catch (error) {
    return json(500, {
      ok: false,
      message: error.message,
    });
  }
};
