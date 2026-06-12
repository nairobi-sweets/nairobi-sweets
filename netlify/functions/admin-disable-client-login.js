const { createClient } = require("@supabase/supabase-js");

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };
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
      .select("id,user_id,username,email")
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

    const { error: updateError } = await supabase
      .from("profile_users")
      .update({
        active: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", login.id);

    if (updateError) {
      return json(500, {
        success: false,
        step: "disable_profile_users",
        message: updateError.message
      });
    }

    if (login.user_id) {
      const { error: banError } = await supabase.auth.admin.updateUserById(
        login.user_id,
        {
          ban_duration: "876000h"
        }
      );

      if (banError) {
        return json(500, {
          success: false,
          step: "disable_auth_user",
          message: banError.message
        });
      }
    }

    return json(200, {
      success: true,
      message: "Client login disabled successfully.",
      username: login.username,
      email: login.email
    });

  } catch (error) {
    return json(500, {
      success: false,
      step: "catch",
      message: error.message
    });
  }
};
