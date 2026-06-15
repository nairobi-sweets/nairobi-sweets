const { createClient } = require("@supabase/supabase-js");

const LOGIN_URL = "https://nairobi-sweets.com/login.html";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  };
}

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function makePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";

  let pwd = "NS26";

  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return pwd;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, {
        success: false,
        message: "Method not allowed"
      });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        success: false,
        message:
          "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify."
      });
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    const body = JSON.parse(event.body || "{}");
    const profileId = body.profileId || body.id;

    if (!profileId) {
      return json(400, {
        success: false,
        message: "Missing profileId."
      });
    }

    const numericProfileId = Number(profileId);

    if (!Number.isFinite(numericProfileId)) {
      return json(400, {
        success: false,
        message: "Invalid profileId."
      });
    }

    let login = null;
    let profile = null;

    const { data: profileLogin, error: profileLoginError } =
      await supabase
        .from("profile_users")
        .select("id,profile_id,user_id,username,email")
        .eq("profile_id", numericProfileId)
        .maybeSingle();

    if (profileLoginError) {
      console.log(
        "profile_users lookup skipped:",
        profileLoginError.message
      );
    }

    if (profileLogin) {
      login = profileLogin;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,user_id,username,email,phone,whatsapp,stage_name")
        .eq("id", numericProfileId)
        .maybeSingle();

    if (profileError) {
      return json(500, {
        success: false,
        step: "fetch_profile",
        message: profileError.message
      });
    }

    profile = profileData;

    if (!login && profile) {
      login = {
        user_id: profile.user_id,
        username: profile.username,
        email: profile.email
      };
    }

    if (!login) {
      return json(404, {
        success: false,
        message:
          "User login not found. Create client login first."
      });
    }

    if (!login.user_id) {
      return json(400, {
        success: false,
        message:
          "This profile has no linked Supabase Auth user_id."
      });
    }

    if (!login.username) {
      return json(400, {
        success: false,
        message:
          "This profile has no username saved."
      });
    }

    const newPassword = makePassword();

    const { error: resetError } =
      await supabase.auth.admin.updateUserById(
        login.user_id,
        {
          password: newPassword
        }
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

Username:
${login.username}

New Password:
${newPassword}

Please login and change your password immediately.`;

    const number = cleanPhone(
      body.whatsapp ||
      body.phone ||
      profile?.whatsapp ||
      profile?.phone
    );

    const whatsappUrl = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(loginMessage)}`
      : "";

    try {
      await supabase.from("audit_logs").insert({
        action: "PASSWORD_RESET",
        profile_id: numericProfileId,
        profile_name:
          profile?.stage_name || login.username || null,
        details:
          `Password reset for ${login.username}`,
        created_at: new Date().toISOString()
      });
    } catch (auditError) {
      console.log(
        "Audit log skipped:",
        auditError.message || auditError
      );
    }

    return json(200, {
      success: true,
      message: "Password reset successfully.",
      profileId: numericProfileId,
      username: login.username,
      email: login.email || profile?.email || "",
      password: newPassword,
      tempPassword: newPassword,
      loginMessage,
      whatsappUrl,
      whatsappLink: whatsappUrl
    });

  } catch (error) {
    return json(500, {
      success: false,
      step: "catch",
      message: error.message || "Password reset failed."
    });
  }
};
