const fetch = require("node-fetch");
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
          error: "Method not allowed"
        })
      };
    }

    const body = JSON.parse(event.body || "{}");

    const message = body.message?.trim();

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing message"
        })
      };
    }

    /* -----------------------------
       SEARCH MATCHES FROM SUPABASE
    ----------------------------- */

    const lower = message.toLowerCase();

    let query = supabase
      .from("profiles")
      .select("*")
      .eq("approved", true)
      .limit(8);

    if (lower.includes("vip")) {
      query = query.eq("plan", "VIP");
    }

    if (lower.includes("online")) {
      query = query.eq("online_now", true);
    }

    if (lower.includes("westlands")) {
      query = query.ilike("location", "%westlands%");
    }

    if (lower.includes("kilimani")) {
      query = query.ilike("location", "%kilimani%");
    }

    if (lower.includes("kasarani")) {
      query = query.ilike("location", "%kasarani%");
    }

    if (lower.includes("ruiru")) {
      query = query.ilike("location", "%ruiru%");
    }

    const { data: profiles } = await query;

    /* -----------------------------
       BUILD PROFILE CONTEXT
    ----------------------------- */

    const profileContext = (profiles || [])
      .map(p => `
Name: ${p.stage_name}
Location: ${p.location}
Bio: ${p.bio}
Plan: ${p.plan}
Likes: ${p.likes_count || 0}
Views: ${p.views_count || 0}
`)
      .join("\n");

    /* -----------------------------
       SWEET AI SYSTEM PROMPT
    ----------------------------- */

    const systemPrompt = `
You are Sweet AI.

You are the seductive luxury concierge
for Nairobi Sweets.

You help users discover profiles.

You speak:
- confidently
- smoothly
- flirtatiously
- short and elegant
- mobile-friendly

You NEVER:
- sound robotic
- mention policies
- mention being an AI model

You guide users toward:
- VIP profiles
- trending profiles
- WhatsApp engagement
- premium discovery

If profiles are available,
recommend them naturally.

Available profiles:

${profileContext}
`;

    /* -----------------------------
       OPENROUTER API
    ----------------------------- */

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${process.env.OPENROUTER_API_KEY}`,

          "Content-Type": "application/json",

          "HTTP-Referer":
            "https://nairobi-sweets.com",

          "X-Title":
            "Nairobi Sweets"
        },

        body: JSON.stringify({

          model:
            "mistralai/mistral-7b-instruct",

          messages: [

            {
              role: "system",
              content: systemPrompt
            },

            {
              role: "user",
              content: message
            }

          ],

          temperature: 0.85,
          max_tokens: 220

        })
      }
    );

    const data = await response.json();

    console.log("OPENROUTER:", JSON.stringify(data));

    const reply =
      data.choices?.[0]?.message?.content ||
      "Sweet got distracted 💔";

    return {

      statusCode: 200,

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        success: true,

        reply,

        profiles: profiles || []

      })

    };

  } catch (error) {

    console.log(error);

    return {

      statusCode: 500,

      body: JSON.stringify({

        error: error.message

      })

    };

  }

};
