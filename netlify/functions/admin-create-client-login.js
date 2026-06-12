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

const {
  profileId,
  stageName,
  phone,
  whatsapp
} = JSON.parse(event.body || "{}");

if (!profileId) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      success: false,
      message: "Profile ID is required"
    })
  };
}

// Generate username
const baseUsername =
  (stageName || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 12);

const randomNumber = Math.floor(1000 + Math.random() * 9000);

const username = `${baseUsername}${randomNumber}`;

// Generate temporary password
const password =
  "NS" +
  Math.floor(100000 + Math.random() * 900000);

const email = `${username}@nairobi-sweets.com`;

// Create Supabase Auth User
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
      message: authError.message
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
    email,
    last_login_at: null
  })
  .eq("id", profileId);

if (profileError) {
  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      message: profileError.message
    })
  };
}

// Save login mapping
await supabase
  .from("profile_users")
  .insert({
    profile_id: profileId,
    user_id: userId,
    username,
    email,
    active: true
  });

const loginUrl =
  "https://nairobi-sweets.com/login.html";

const whatsappMessage =
```

`Welcome to Nairobi Sweets

Your account has been created.

Login:
${loginUrl}

Username: ${username}
Password: ${password}

Please login and change your password immediately.`;

```
const whatsappNumber =
  (whatsapp || phone || "")
    .replace(/\D/g, "");

let whatsappLink = "";

if (whatsappNumber) {
  whatsappLink =
    `https://wa.me/${whatsappNumber}?text=` +
    encodeURIComponent(whatsappMessage);
}

return {
  statusCode: 200,
  body: JSON.stringify({
    success: true,
    profileId,
    userId,
    username,
    password,
    email,
    whatsappLink,
    whatsappMessage
  })
};
```

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
