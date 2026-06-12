const { createClient } = require("@supabase/supabase-js");

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

```
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const body = JSON.parse(event.body || "{}");

const profileId = body.profileId;
const whatsapp = body.whatsapp || "";
const phone = body.phone || "";

if (!profileId) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      success: false,
      message: "Missing profileId"
    })
  };
}

const { data: login, error: loginError } = await supabase
  .from("profile_users")
  .select("*")
  .eq("profile_id", profileId)
  .single();

if (loginError || !login) {
  return {
    statusCode: 404,
    body: JSON.stringify({
      success: false,
      message: "No login found for this profile."
    })
  };
}

const newPassword =
  "NS2026#" +
  Math.random().toString(36).substring(2, 10);

const { error: resetError } =
  await supabase.auth.admin.updateUserById(
    login.user_id,
    {
      password: newPassword
    }
  );

if (resetError) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      message: resetError.message
    })
  };
}

const loginMessage =
```

`🔐 Nairobi Sweets Password Reset

Login:
https://nairobi-sweets.com/login.html

Username: ${login.username}

New Password:
${newPassword}

Please login and change your password immediately.`;

```
const number =
  String(whatsapp || phone || "")
    .replace(/\D/g, "");

const whatsappUrl = number
  ? `https://wa.me/${number}?text=${encodeURIComponent(loginMessage)}`
  : "";

return {
  statusCode: 200,
  body: JSON.stringify({
    success: true,
    username: login.username,
    password: newPassword,
    whatsappUrl,
    loginMessage
  })
};
```

} catch (err) {
return {
statusCode: 500,
body: JSON.stringify({
success: false,
message: err.message
})
};
}
};
