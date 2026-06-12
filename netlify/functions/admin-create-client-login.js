const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ success:false, message:"Method not allowed" }) };
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ success:false, message:"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify." }) };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = JSON.parse(event.body || "{}");

    const profileId = body.profileId || body.id;
    const stageName = body.stageName || body.stage_name || "client";
    const phone = body.phone || "";
    const whatsapp = body.whatsapp || "";
    const inputUsername = body.username || "";
    const inputPassword = body.password || body.tempPassword || "";
    const inputEmail = body.email || "";

    if (!profileId) {
      return { statusCode: 400, body: JSON.stringify({ success:false, message:"Missing profileId." }) };
    }

    const cleanBase = String(stageName)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20) || "client";

    const username = String(inputUsername || `${cleanBase}${Math.floor(1000 + Math.random() * 9000)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    const password = inputPassword || `NS2026#${Math.random().toString(36).slice(2, 10)}`;

    const email = String(inputEmail || `${username}@clients.nairobi-sweets.com`).toLowerCase();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id,user_id,username,email")
      .eq("id", profileId)
      .maybeSingle();

    if (!existingProfile) {
      return { statusCode: 404, body: JSON.stringify({ success:false, message:`Profile ID ${profileId} not found.` }) };
    }

    const { data: existingLogin } = await supabase
      .from("profile_users")
      .select("id,username,email")
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (existingLogin) {
      return { statusCode: 409, body: JSON.stringify({ success:false, message:"Username or email already exists. Try another username/email." }) };
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        profile_id: profileId,
        stage_name: stageName
      }
    });

    if (authError) {
      return { statusCode: 500, body: JSON.stringify({ success:false, step:"create_auth_user", message:authError.message }) };
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        user_id: userId,
        username,
        email
      })
      .eq("id", profileId);

    if (profileError) {
      return { statusCode: 500, body: JSON.stringify({ success:false, step:"update_profile", message:profileError.message }) };
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
      return { statusCode: 500, body: JSON.stringify({ success:false, step:"save_mapping", message:mappingError.message }) };
    }

    const loginUrl = "https://nairobi-sweets.com/login.html";

    const loginMessage =
`Welcome to Nairobi Sweets

Your account has been created.

Login:
${loginUrl}

Username: ${username}
Password: ${password}

Please login and change your password.`;

    const number = String(whatsapp || phone || "").replace(/\D/g, "");
    const whatsappUrl = number ? `https://wa.me/${number}?text=${encodeURIComponent(loginMessage)}` : "";

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Login created successfully.",
        profileId,
        userId,
        username,
        password,
        email,
        loginMessage,
        whatsappUrl,
        whatsappLink: whatsappUrl
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success:false,
        step:"catch",
        message:error.message
      })
    };
  }
};
