const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, message: "Method not allowed" })
      };
    }

    const { email, password, secret } = JSON.parse(event.body || "{}");

    if (secret !== process.env.ADMIN_SETUP_SECRET) {
      return {
        statusCode: 403,
        body: JSON.stringify({ ok: false, message: "Invalid setup secret" })
      };
    }

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, message: "Email and password required" })
      };
    }

    if (password.length < 8) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, message: "Password must be at least 8 characters" })
      };
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { error } = await supabase
      .from("admin_users")
      .update({ password_hash })
      .eq("email", email.toLowerCase())
      .eq("is_active", true);

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: "Admin password updated" })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, message: error.message })
    };
  }
};
