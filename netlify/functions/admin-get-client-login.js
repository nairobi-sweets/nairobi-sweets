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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,stage_name,phone,whatsapp,last_login_at")
      .eq("id", Number(profileId))
      .maybeSingle();

    if (profileError) {
      return json(500, {
        success: false,
        step: "fetch_profile",
        message: profileError.message
      });
    }

    if (!profile) {
      return json(404, { success: false, message: "Profile not found." });
    }

    const { data: login, error: loginError } = await supabase
      .from("profile_users")
      .select("id,profile_id,user_id,username,email,active,created_at,updated_at")
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
      return json(200, {
        success: true,
        exists: false,
        message: "No client login found for this profile.",
        profile
      });
    }

    const loginMessage =
`Welcome to Nairobi Sweets

Your account already exists.

Login:
${LOGIN_URL}

Username: ${login.username}

If you forgot your password, contact admin for reset.`;

    const number = cleanPhone(profile.whatsapp || profile.phone);
    const whatsappUrl = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(loginMessage)}`
      : "";

    return json(200, {
      success: true,
      exists: true,
      login,
      profile,
      username: login.username,
      email: login.email,
      active: login.active,
      lastLoginAt: profile.last_login_at || null,
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
