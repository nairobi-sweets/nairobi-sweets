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

function cleanUsername(value) {
  return String(value || "client")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 18) || "client";
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

    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("id,stage_name,phone,whatsapp,username,email,user_id")
      .eq("id", profileId)
      .maybeSingle();

    if (profileFetchError) {
      return json(500, {
        success: false,
        step: "fetch_profile",
        message: profileFetchError.message
      });
    }

    if (!profile) {
      return json(404, {
        success: false,
        message: `Profile ID ${profileId} not found.`
      });
    }

    const { data: existingLogin } = await supabase
      .from("profile_users")
      .select("id,username,email")
      .eq("profile_id", Number(profileId))
      .maybeSingle();

    if (existingLogin) {
      const message =
`Welcome to Nairobi Sweets

Your account already exists.

Login:
${LOGIN_URL}

Username: ${existingLogin.username}

If you forgot your password, contact admin for reset.`;

      const number = cleanPhone(profile.whatsapp || profile.phone);
      const whatsappUrl = number
        ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
        : "";

      return json(200, {
        success: true,
        alreadyExists: true,
        message: "This profile already has a login.",
        username: existingLogin.username,
        email: existingLogin.email,
        loginMessage: message,
        whatsappUrl,
        whatsappLink: whatsappUrl
      });
    }

    const base = cleanUsername(body.username || profile.stage_name);
    const unique = Date.now().toString().slice(-6);
    const username = `${base}${unique}`;
    const email = `${username}@clients.nairobi-sweets.com`;
    const password = body.password || makePassword();

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          profile_id: profileId,
          stage_name: profile.stage_name || ""
        }
      });

    if (authError) {
      return json(500, {
        success: false,
        step: "create_auth_user",
        message: authError.message
      });
    }

    const userId = authData.user.id;

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        user_id: userId,
        username,
        email
      })
      .eq("id", profileId);

    if (profileUpdateError) {
      return json(500, {
        success: false,
        step: "update_profile",
        message: profileUpdateError.message
      });
    }

    const { error: mappingError } = await supabase
      .from("profile_users")
      .insert({
        profile_id: Number(profileId),
        user_id: userId,
        username,
        email,
        active: true
      });

    if (mappingError) {
      return json(500, {
        success: false,
        step: "save_mapping",
        message: mappingError.message
      });
    }

    const loginMessage =
`Welcome to Nairobi Sweets

Your account has been created.

Login:
${LOGIN_URL}

Username: ${username}
Password: ${password}

Please login and change your password.`;

    const number = cleanPhone(profile.whatsapp || profile.phone || body.whatsapp || body.phone);
    const whatsappUrl = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(loginMessage)}`
      : "";

    return json(200, {
      success: true,
      alreadyExists: false,
      message: "Login created successfully.",
      profileId,
      userId,
      username,
      password,
      email,
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
