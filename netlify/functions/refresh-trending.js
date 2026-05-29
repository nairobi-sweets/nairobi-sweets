const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await sb.rpc("refresh_trending_scores");

  if (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error)
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      refreshed: true
    })
  };
};
