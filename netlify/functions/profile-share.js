const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function esc(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

exports.handler = async function (event) {
  const id = event.queryStringParameters?.id;

  if (!id) {
    return {
      statusCode: 302,
      headers: { Location: "/" },
      body: ""
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !profile) {
    return {
      statusCode: 302,
      headers: { Location: "/" },
      body: ""
    };
  }

  const name = esc(profile.stage_name || "Nairobi Sweets Profile");
  const location = esc(profile.location || "Nairobi");
  const bio = esc(profile.bio || profile.about || "View this Nairobi Sweets profile.");
  const image = profile.photo_url || profile.image_url || "https://nairobi-sweets.com/assets/logo/logo-badge.png";

  const shareUrl = `https://nairobi-sweets.com/profile/${id}`;
  const realUrl = `https://nairobi-sweets.com/profile.html?id=${id}`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${name} | Nairobi Sweets</title>
<meta property="og:title" content="${name} | Nairobi Sweets">
<meta property="og:description" content="📍 ${location} - ${bio}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${shareUrl}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<script>
  window.location.replace("${realUrl}");
</script>
</head>
<body>
  <p>Opening profile...</p>
  <a href="${realUrl}">Open profile</a>
</body>
</html>`
  };
};
