const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
try {
if (event.httpMethod !== "POST") {
return {
statusCode: 405,
body: JSON.stringify({
success: false,
error: "Method not allowed"
})
};
}

```
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const body = JSON.parse(event.body || "{}");

const {
  profileId,
  stageName,
  phone,
  whatsapp
} = body;

if (!profileId) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      success: false,
      error: "Missing profileId"
    })
  };
}

const cleanName = String(stageName || "user")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const username =
  cleanName +
  Math.floor(1000 + Math.random() * 9000);

const password =
  "NS" +
  Math.floor(100000 + Math.random() * 900000);

const email =
  `${username}@nairobi-sweets.com`;

// Create Auth User
const { data: authData, error: authError } =
  await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

if (authError) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      step: "create_auth_user",
      error: authError.message
    })
  };
}

const userId = authData.user.id;

// Update profile
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
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      step: "update_profile",
      error: profileError.message
    })
  };
}

// Save mapping
const { error: mappingError } =
  await supabase
    .from("profile_users")
    .insert({
      profile_id: profileId,
      user_id: userId,
      username,
      email,
      active: true
    });

if (mappingError) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      step: "save_mapping",
      error: mappingError.message
    })
  };
}

const loginMessage =
```

`Welcome to Nairobi Sweets

Your account has been created.

Login:
https://nairobi-sweets.com/login.html

Username: ${username}
Password: ${password}

Please login and change your password.`;

```
const number =
  String(whatsapp || phone || "")
    .replace(/\D/g, "");

const whatsappUrl =
  number
    ? `https://wa.me/${number}?text=${encodeURIComponent(loginMessage)}`
    : "";

return {
  statusCode: 200,
  body: JSON.stringify({
    success: true,
    username,
    password,
    email,
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
step: "catch",
error: err.message,
stack: err.stack
})
};
}
};
