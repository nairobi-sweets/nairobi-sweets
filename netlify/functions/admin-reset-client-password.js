const { createClient } = require("@supabase/supabase-js");

const LOGIN_URL = "https://nairobi-sweets.com/login.html";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };
}

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function makePassword() {
  return `NS2026#${Math.random().toString(36).slice(2, 10)}`;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, message: "Method not allowed" });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        success: false,
        message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify."
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = JSON.parse(event.body || "{}");
    const profileId = body.profileId || body.id;

    if (!profileId) {
      return json(400, { success: false, message: "Missing profileId." });
    }

    const { data: login, error: loginError } = await supabase
      .from("profile_users")
      .select("id,profile_id,user_id,username,email")
      .eq("profile_id", Number(profileId))
      .maybeSingle();

    if (loginError) {
      return json(500, {
        success: false,
        step: "fetch_login",
        message: loginError.message
      });
    }

    if (!login) {
      return json(404, {
        success: false,
        message: "No login found for this profile."
      });
    }

    if (!login.user_id) {
      return json(400, {
        success: false,
        message: "This login has no auth user_id attached."
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id,phone,whatsapp")
      .eq("id", Number(profileId))
      .maybeSingle();

    const newPassword = makePassword();

    const { error: resetError } =
      await supabase.auth.admin.updateUserById(
        login.user_id,
        { password: newPassword }
      );

    if (resetError) {
      return json(500, {
        success: false,
        step: "reset_auth_password",
        message: resetError.message
      });
    }

    const loginMessage =
`Nairobi Sweets Password Reset

Login:
${LOGIN_URL}

Username: ${login.username}
New Password: ${newPassword}

Please login and change your password.`;

    const number = cleanPhone(body.whatsapp || body.phone || profile?.whatsapp || profile?.phone);
    const whatsappUrl = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(loginMessage)}`
      : "";

    return json(200, {
      success: true,
      message: "Password reset successfully.",
      username: login.username,
      email: login.email,
      password: newPassword,
      loginMessage,
      whatsappUrl,
      whatsappLink: whatsappUrl
    });

  } catch (error) {
    return json(500, {
      success: false,
      step: "catch",
      message: error.message
    });
  }
};
