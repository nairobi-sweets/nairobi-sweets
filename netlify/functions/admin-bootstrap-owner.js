const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, message: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");

    if (body.secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      return json(403, { ok: false, message: "Invalid bootstrap secret" });
    }

    const name = String(body.name || "Owner").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return json(400, { ok: false, message: "Email and password required" });
    }

    if (password.length < 8) {
      return json(400, { ok: false, message: "Password must be 8+ characters" });
    }

    const { data: existing } = await supabase
      .from("admin_users")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return json(409, { ok: false, message: "Owner email already exists" });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from("admin_users")
      .insert({
        name,
        email,
        password_hash,
        role: "owner",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("id,name,email,role,is_active,created_at")
      .single();

    if (error) {
      return json(500, { ok: false, message: error.message });
    }

    return json(200, {
      ok: true,
      message: "Owner created",
      owner: data
    });

  } catch (error) {
    return json(500, { ok: false, message: error.message });
  }
};
