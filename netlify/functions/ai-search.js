const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(data)
  };
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function clean(value) {
  return String(value || "").toLowerCase().trim();
}

function getPhoto(profile) {
  return (
    profile.photo_url ||
    profile.image_url ||
    profile.profile_photo ||
    profile.avatar_url ||
    profile.photo ||
    profile.main_photo ||
    null
  );
}

function getName(profile) {
  return (
    profile.stage_name ||
    profile.name ||
    profile.full_name ||
    "Verified Profile"
  );
}

function scoreProfile(profile, query) {
  const q = clean(query);

  const text = clean(`
    ${profile.stage_name || ""}
    ${profile.name || ""}
    ${profile.full_name || ""}
    ${profile.location || ""}
    ${profile.bio || ""}
    ${profile.plan || ""}
    ${profile.plan_name || ""}
    ${profile.package || ""}
    ${profile.body_type || ""}
    ${profile.phone || ""}
    ${profile.whatsapp || ""}
    online now available vip vvip featured
  `);

  const words = q.split(/\s+/).filter(Boolean);

  let score = 0;

  if (!q) score += 1;

  for (const word of words) {
    if (text.includes(word)) score += 10;

    if (word === "online" || word === "now" || word === "available") {
      score += 6;
    }

    if (word === "vip" && text.includes("vip")) {
      score += 20;
    }

    if (word === "vvip" && (text.includes("vvip") || text.includes("signature"))) {
      score += 25;
    }

    if (word === "whatsapp" && (profile.phone || profile.whatsapp)) {
      score += 18;
    }

    if (word === "near" && profile.location) {
      score += 5;
    }

    if (word === "liked" || word === "likes" || word === "popular") {
      score += Number(profile.likes_count || profile.likes || 0) * 0.2;
    }

    if (word === "views" || word === "trending") {
      score += Number(profile.views_count || profile.views || 0) * 0.05;
    }
  }

  score += Number(profile.likes_count || profile.likes || 0) * 0.04;
  score += Number(profile.views_count || profile.views || 0) * 0.01;

  if (getPhoto(profile)) score += 5;
  if (profile.phone || profile.whatsapp) score += 5;

  return score;
}

function makeAnswer(query, results) {
  if (!results.length) {
    return `
      No exact match found 😢<br><br>
      Try: • VIP in Kilimani • Westlands • Online now
    `;
  }

  const top = results[0];
  const locations = [
    ...new Set(results.map(p => p.location).filter(Boolean))
  ].slice(0, 4);

  return `
    Sweet found ${results.length} match${results.length === 1 ? "" : "es"} 💋<br><br>
    Best match: <b>${getName(top)}</b>${top.location ? ` in ${top.location}` : ""}.<br>
    ${locations.length ? `Hot areas: ${locations.join(", ")}.` : ""}
  `;
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const query = clean(body.query);

    if (!query) {
      return json(400, { error: "Missing query" });
    }

    const { data, error } = await supabase
      .from(process.env.PROFILES_TABLE || "profiles")
      .select("*")
      .eq("approved", true)
      .limit(200);

    if (error) {
      console.log("Sweet AI Supabase error:", error);

      return json(500, {
        error: "Could not search profiles",
        details: error.message
      });
    }

    const ranked = (data || [])
      .map(profile => ({
        ...profile,
        ai_score: scoreProfile(profile, query)
      }))
      .filter(profile => profile.ai_score > 0)
      .sort((a, b) => b.ai_score - a.ai_score)
      .slice(0, 12);

    return json(200, {
      ok: true,
      query,
      answer: makeAnswer(query, ranked),
      results: ranked.map(profile => ({
        id: profile.id,
        stage_name: getName(profile),
        location: profile.location || "Nairobi",
        bio: profile.bio || "",
        phone: profile.phone || profile.whatsapp || null,
        plan: profile.plan || profile.plan_name || profile.package || "featured",
        photo_url: getPhoto(profile),
        likes_count: profile.likes_count || profile.likes || 0,
        views_count: profile.views_count || profile.views || 0,
        ai_score: Math.round(profile.ai_score)
      }))
    });

  } catch (error) {
    console.log("Sweet AI fatal error:", error);

    return json(500, {
      error: "Sweet AI failed",
      details: error.message
    });
  }
};
