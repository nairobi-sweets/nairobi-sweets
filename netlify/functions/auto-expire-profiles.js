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
    const now = new Date().toISOString();

    const { data: expiredProfiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id, stage_name, expiry_date, payment_status, trial_active")
      .eq("is_expired", false)
      .not("expiry_date", "is", null)
      .lt("expiry_date", now);

    if (fetchError) {
      console.log("Fetch expired profiles error:", fetchError);

      return json(500, {
        success: false,
        error: fetchError.message,
      });
    }

    if (!expiredProfiles || expiredProfiles.length === 0) {
      return json(200, {
        success: true,
        message: "No expired profiles found.",
        expired_count: 0,
      });
    }

    const ids = expiredProfiles.map((profile) => profile.id);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_expired: true,
        approved: false,
        online: false,

        trial_active: false,
        payment_status: "expired",
        plan_status: "expired",

        boost_score: 0,
        trending_score: 0,

        updated_at: now,
      })
      .in("id", ids);

    if (updateError) {
      console.log("Expire update error:", updateError);

      return json(500, {
        success: false,
        error: updateError.message,
      });
    }

    return json(200, {
      success: true,
      message: "Expired profiles hidden successfully.",
      expired_count: expiredProfiles.length,
      expired_profiles: expiredProfiles,
    });

  } catch (error) {
    console.log("Auto-expire fatal error:", error);

    return json(500, {
      success: false,
      error: error.message || "Internal server error",
    });
  }
};
