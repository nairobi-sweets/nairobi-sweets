const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date().toISOString();

    const { data: expired, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("approved", true)
      .lte("expires_at", now);

    if (error) throw error;

    let hidden = 0;
    let renewalRequests = 0;

    for (const profile of expired || []) {
      if (profile.auto_renew) {
        const phone = profile.phone || profile.phone_number || profile.whatsapp;
        const amount = profile.renewal_price || getPrice(profile.package || profile.plan);

        await supabase.from("renewals").insert({
          profile_id: profile.id,
          phone,
          amount,
          package: profile.package || profile.plan || "Featured",
          status: "renewal_due"
        });

        renewalRequests++;
      } else {
        await supabase
          .from("profiles")
          .update({
            approved: false,
            status: "expired",
            payment_status: "expired"
          })
          .eq("id", profile.id);

        hidden++;
      }
    }

    return response(200, {
      success: true,
      checked: expired?.length || 0,
      hidden,
      renewalRequests
    });

  } catch (error) {
    return response(500, { error: error.message });
  }
};

function getPrice(pkg) {
  const p = String(pkg || "").toLowerCase();
  if (p.includes("signature") || p.includes("vvip")) return 3000;
  if (p.includes("vip")) return 1500;
  return 1000;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
