const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {

  try {

    const body = JSON.parse(event.body || "{}");

    const query =
      String(body.query || "")
      .toLowerCase()
      .trim();

    if (!query) {
      return response(400, {
        error: "Missing query"
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("approved", true)
      .limit(30);

    if (error) {
      return response(500, {
        error: error.message
      });
    }

    const results = (data || []).filter(profile => {

      const text = `
        ${profile.stage_name || ""}
        ${profile.name || ""}
        ${profile.location || ""}
        ${profile.bio || ""}
        ${profile.plan || ""}
      `
      .toLowerCase();

      return text.includes(query);

    });

    let answer = "";

    if (results.length > 0) {

      answer = `
        Sweet found ${results.length} match${results.length > 1 ? "es" : ""} 💋
      `;

    } else {

      answer = `
        No exact match found 😢<br><br>
        Try:
        • VIP in Kilimani
        • Westlands
        • Online now
      `;
    }

    return response(200, {
      answer,
      results
    });

  } catch (err) {

    console.log(err);

    return response(500, {
      error: err.message
    });
  }
};

function response(statusCode, data) {

  return {
    statusCode,

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify(data)
  };
}
