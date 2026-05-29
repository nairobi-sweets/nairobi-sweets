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

exports.handler = async (event) => {
  try {

    const authHeader =
      event.headers.authorization ||
      event.headers.Authorization ||
      "";

    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return json(401, {
        ok: false,
        message: "Missing token"
      });
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
      return json(500, {
        ok: false,
        message: sessionError.message
      });
    }

    if (!session) {
      return json(401, {
        ok: false,
        message: "Session expired or invalid"
      });
    }

    const { data: admin, error: adminError } =
      await supabase
        .from("admin_users")
        .select(`
          id,
          name,
          email,
          role,
          is_active,
          created_at
        `)
        .eq("id", session.admin_id)
        .eq("is_active", true)
        .maybeSingle();

    if (adminError) {
      return json(500, {
        ok: false,
        message: adminError.message
      });
    }

    if (!admin) {
      return json(401, {
        ok: false,
        message: "Admin account not found"
      });
    }

    return json(200, {
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        is_active: admin.is_active,
        created_at: admin.created_at
      }
    });

  } catch (error) {

    return json(500, {
      ok: false,
      message: error.message
    });

  }
};
