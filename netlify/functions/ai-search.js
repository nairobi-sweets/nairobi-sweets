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

function clean(text) {
  return String(text || "").trim().toLowerCase();
}

function scoreProfile(profile, query) {
  const q = clean(query);

  const name = clean(profile.stage_name || profile.name || profile.full_name);
  const location = clean(profile.location);
  const bio = clean(profile.bio);
  const bodyType = clean(profile.body_type);
  const plan = clean(profile.plan || profile.plan_name || profile.package);
  const phone = clean(profile.phone || profile.whatsapp);

  let score = 0;

  if (!q) score += 1;

  if (name.includes(q)) score += 20;
  if (location.includes(q)) score += 18;
  if (bodyType.includes(q)) score += 14;
  if (plan.includes(q)) score += 12;
  if (bio.includes(q)) score += 10;
  if (phone.includes(q)) score += 8;

  const words = q.split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (name.includes(word)) score += 8;
    if (location.includes(word)) score += 8;
    if (bodyType.includes(word)) score += 6;
    if (plan.includes(word)) score += 6;
    if (bio.includes(word)) score += 5;
    if (phone.includes(word)) score += 4;

    if (word === "vip" && plan.includes("vip")) score += 12;
    if (word === "vvip" && (plan.includes("vvip") || plan.includes("signature"))) score += 16;
    if (word === "near" && location) score += 3;
    if (word === "whatsapp" && phone) score += 10;
    if (word === "online") score += 5;
  }

  score += Number(profile.likes_count || profile.likes || 0) * 0.05;
  score += Number(profile.views_count || profile.views || 0) * 0.01;

  if (profile.photo_url || profile.image_url || profile.profile_photo || profile.avatar_url || profile.photo) {
    score += 5;
  }

  return score;
}

function makeAnswer(query, results) {
  if (!results.length) {
    return `I could not find a strong match for "${query}". Try searching by location like Kilimani, Westlands, Kasarani, Ruiru, Kikuyu or Mombasa.`;
  }

  const locations = [...new Set(results.map(p => p.location).filter(Boolean))].slice(0, 4);
  const top = results[0];

  return `I found ${results.length} matching profile${results.length === 1 ? "" : "s"}. Best match: ${top.stage_name || top.name || "Verified Profile"}${top.location ? ` in ${top.location}` : ""}. ${locations.length ? `Popular matched areas: ${locations.join(", ")}.` : ""}`;
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

    const { data, error } = await supabase
      .from(process.env.PROFILES_TABLE || "profiles")
      .select("*")
      .eq("approved", true)
      .limit(200);

    if (error) {
      console.log("AI search Supabase error:", error);
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
      results: ranked.map(p => ({
        id: p.id,
        stage_name: p.stage_name || p.name || p.full_name || "Verified Profile",
        location: p.location || "Nairobi",
        bio: p.bio || "",
        phone: p.phone || p.whatsapp || null,
        plan: p.plan || p.plan_name || p.package || "featured",
        photo_url: p.photo_url || p.image_url || p.profile_photo || p.avatar_url || p.photo || null,
        likes_count: p.likes_count || p.likes || 0,
        views_count: p.views_count || p.views || 0,
        ai_score: Math.round(p.ai_score)
      }))
    });
  } catch (error) {
    console.log("AI search fatal error:", error);

    return json(500, {
      error: "AI search failed",
      details: error.message
    });
  }
};
