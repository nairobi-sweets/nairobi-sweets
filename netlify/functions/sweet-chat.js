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

function getName(profile) {
  return profile.stage_name || profile.name || profile.full_name || "Verified Profile";
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

function scoreProfile(profile, message) {
  const q = clean(message);

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
    online now available vip vvip featured trending popular whatsapp
  `);

  const words = q.split(/\s+/).filter(Boolean);
  let score = 0;

  for (const word of words) {
    if (text.includes(word)) score += 10;

    if (word === "online" || word === "now" || word === "available") score += 6;
    if (word === "vip" && text.includes("vip")) score += 20;
    if (word === "vvip" && (text.includes("vvip") || text.includes("signature"))) score += 25;
    if (word === "whatsapp" && (profile.phone || profile.whatsapp)) score += 18;
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

function compactProfiles(profiles) {
  return profiles.map(profile => ({
    id: profile.id,
    stage_name: getName(profile),
    location: profile.location || "Nairobi",
    bio: profile.bio || "",
    phone: profile.phone || profile.whatsapp || null,
    plan: profile.plan || profile.plan_name || profile.package || "featured",
    photo_url: getPhoto(profile),
    likes_count: profile.likes_count || profile.likes || 0,
    views_count: profile.views_count || profile.views || 0,
    ai_score: Math.round(profile.ai_score || 0)
  }));
}

function fallbackReply(message, profiles) {
  if (!profiles.length) {
    return `
      Sweet could not find a perfect match yet 💔<br><br>
      Try: VIP in Kilimani, WhatsApp Westlands, Online now, or Most liked.
    `;
  }

  const top = profiles[0];
  const locations = [...new Set(profiles.map(p => p.location).filter(Boolean))].slice(0, 4);

  return `
    Sweet found ${profiles.length} match${profiles.length === 1 ? "" : "es"} 💋<br><br>
    Best match: <b>${getName(top)}</b>${top.location ? ` in ${top.location}` : ""}.<br>
    ${locations.length ? `Hot areas: ${locations.join(", ")}.` : ""}
  `;
}

async function askOpenRouter(message, profiles) {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackReply(message, profiles);
  }

  const profileContext = profiles.map((p, index) => `
${index + 1}. ${getName(p)}
Location: ${p.location || "Nairobi"}
Plan: ${p.plan || p.plan_name || p.package || "featured"}
Likes: ${p.likes_count || p.likes || 0}
Views: ${p.views_count || p.views || 0}
Bio: ${p.bio || ""}
  `).join("\n");

  const systemPrompt = `
You are Sweet AI, the luxury concierge for Nairobi Sweets.

Your job is to help users discover matching profiles from the provided profile list.

Style:
- warm, playful, confident
- short mobile-friendly answers
- elegant and direct
- never robotic
- use light emoji only when useful

Safety:
- Do not mention explicit sexual services.
- Do not encourage illegal activity.
- Do not claim anyone is available unless the profile data says so.
- If unsure, suggest browsing the profile or using WhatsApp/call button.

Available profile data:
${profileContext || "No matching profiles found."}
`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://nairobi-sweets.com",
      "X-Title": "Nairobi Sweets"
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.75,
      max_tokens: 220
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("OpenRouter error:", JSON.stringify(data));
    return fallbackReply(message, profiles);
  }

  return data.choices?.[0]?.message?.content || fallbackReply(message, profiles);
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
    const message = String(body.message || body.query || "").trim();

    if (!message) {
      return json(400, { error: "Missing message" });
    }

    const { data, error } = await supabase
      .from(process.env.PROFILES_TABLE || "profiles")
      .select("*")
      .eq("approved", true)
      .limit(200);

    if (error) {
      console.log("Sweet chat Supabase error:", error);
      return json(500, {
        error: "Could not search profiles",
        details: error.message
      });
    }

    const ranked = (data || [])
      .map(profile => ({
        ...profile,
        ai_score: scoreProfile(profile, message)
      }))
      .filter(profile => profile.ai_score > 0)
      .sort((a, b) => b.ai_score - a.ai_score)
      .slice(0, 8);

    const reply = await askOpenRouter(message, ranked);

    return json(200, {
      ok: true,
      reply,
      answer: reply,
      results: compactProfiles(ranked),
      profiles: compactProfiles(ranked)
    });

  } catch (error) {
    console.log("Sweet chat fatal error:", error);

    return json(500, {
      error: "Sweet chat failed",
      details: error.message
    });
  }
};
