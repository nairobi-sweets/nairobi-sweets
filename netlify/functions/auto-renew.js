const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.URL || "https://nairobi-sweets.com";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cleanPhone(phone) {
  let p = String(phone || "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  return p;
}

function planAmount(plan) {
  const p = String(plan || "").toLowerCase();
  if (p.includes("signature") || p.includes("vvip")) return 3000;
  if (p.includes("vip")) return 1500;
  if (p.includes("featured")) return 1000;
  return 1500;
}

exports.handler = async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          message: "Missing Supabase environment variables"
        })
      };
    }

    const now = new Date();
    const soon = new Date();
    soon.setDate(now.getDate() + 3);

    const { data: profiles, error } = await sb
      .from("profiles")
      .select("*")
      .eq("approved", true)
      .eq("is_expired", false)
      .lte("plan_expires_at", soon.toISOString());

    if (error) throw error;

    const results = [];

    for (const profile of profiles || []) {
      const phone = cleanPhone(profile.phone || profile.whatsapp);

      if (!phone) {
        results.push({
          profile_id: profile.id,
          name: profile.stage_name,
          ok: false,
          message: "No phone found"
        });
        continue;
      }

      const amount = planAmount(profile.plan);

      const { data: recentRenewal } = await sb
        .from("auto_renew_logs")
        .select("*")
        .eq("profile_id", String(profile.id))
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentRenewal) {
        results.push({
          profile_id: profile.id,
          name: profile.stage_name,
          ok: false,
          message: "Skipped, renewal already attempted in last 24 hours"
        });
        continue;
      }

      const response = await fetch(`${SITE_URL}/.netlify/functions/mpesa-stk-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profile_id: profile.id,
          phone,
          plan: profile.plan || "vip",
          amount,
          reason: "auto_renewal"
        })
      });

      const json = await response.json().catch(() => ({}));

      await sb.from("auto_renew_logs").insert({
        profile_id: String(profile.id),
        profile_name: profile.stage_name || null,
        phone,
        plan: profile.plan || "vip",
        amount,
        status: response.ok ? "stk_sent" : "failed",
        response: json,
        created_at: new Date().toISOString()
      });

      await sb.from("admin_audit_logs").insert({
        action: response.ok ? "auto_renew_stk_sent" : "auto_renew_failed",
        admin_name: "Auto-Renew Engine",
        profile_id: String(profile.id),
        profile_name: profile.stage_name || null,
        details: response.ok
          ? `Auto-renew STK sent for KES ${amount}`
          : `Auto-renew failed: ${JSON.stringify(json)}`,
        created_at: new Date().toISOString()
      });

      results.push({
        profile_id: profile.id,
        name: profile.stage_name,
        phone,
        amount,
        ok: response.ok,
        response: json
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        checked: profiles.length,
        attempted: results.length,
        results
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: error.message
      })
    };
  }
};
