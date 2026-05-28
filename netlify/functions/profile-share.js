const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function escapeHtml(value = "") {
  return String(value)
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) {
    return {
      statusCode: 302,
      headers: { Location: "/" },
      body: ""
    };
  }

  const name = escapeHtml(profile.stage_name || profile.name || "Nairobi Sweets Profile");
  const location = escapeHtml(profile.location || "Nairobi");
  const bio = escapeHtml(profile.bio || profile.about || "View this premium Nairobi Sweets profile.");
  const image = profile.photo_url || profile.image_url || "https://nairobi-sweets.com/assets/logo/logo-badge.png";

  const shareUrl = `https://nairobi-sweets.com/profile/${id}`;
  const realUrl = `https://nairobi-sweets.com/profile.html?id=${id}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${name} | Nairobi Sweets</title>
<meta name="description" content="${bio}">

<meta property="og:title" content="${name} | Nairobi Sweets">
<meta property="og:description" content="📍 ${location} - ${bio}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${shareUrl}">
<meta property="og:type" content="profile">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${name} | Nairobi Sweets">
<meta name="twitter:description" content="📍 ${location} - ${bio}">
<meta name="twitter:image" content="${image}">

<meta http-equiv="refresh" content="0;url=${realUrl}">
</head>
<body>
<script>
window.location.href = "${realUrl}";
</script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: html
  };
};
