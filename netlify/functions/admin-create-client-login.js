const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({
          success: false,
          message: "Method not allowed"
        })
      };
    }

    const {
      profileId,
      username,
      email,
      password
    } = JSON.parse(event.body || "{}");

    if (!profileId || !username || !email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Missing required fields"
        })
      };
    }

    // Check username already exists
    const { data: existingUser } = await supabase
      .from("profile_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingUser) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Username already exists"
        })
      };
    }

    // Create Supabase Auth user
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (authError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: authError.message
        })
      };
    }

    const userId = authUser.user.id;

    // Link profile to auth user
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        user_id: userId,
        username,
        email
      })
      .eq("id", profileId);

    if (profileError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: profileError.message
        })
      };
    }

    // Save login record
    const { error: loginError } = await supabase
      .from("profile_users")
      .insert({
        profile_id: profileId,
        user_id: userId,
        username,
        email,
        active: true,
        created_at: new Date().toISOString()
      });

    if (loginError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: loginError.message
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        user_id: userId,
        username,
        email,
        login_url: "https://nairobi-sweets.com/login.html",
        whatsapp_message:
`Welcome to Nairobi Sweets

Your account has been created.

Login:
https://nairobi-sweets.com/login.html

Username: ${username}
Password: ${password}

Please login and change your password.`
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: error.message
      })
    };
  }
};
