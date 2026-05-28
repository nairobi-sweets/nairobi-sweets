const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function () {
  try {
    const { error } = await supabase.rpc("refresh_profile_trending_scores");

    if (error) {
      return json(500, {
        success: false,
        error: error.message,
      });
    }

    return json(200, {
      success: true,
      message: "Trending scores refreshed.",
      refreshed_at: new Date().toISOString(),
    });
  } catch (error) {
    return json(500, {
      success: false,
      error: error.message,
    });
  }
};
