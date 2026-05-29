const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    for (const p of profiles || []) {
      const phone = cleanPhone(p.phone || p.whatsapp);
      if (!phone) continue;

      const amount = planAmount(p.plan);

      const res = await fetch(`${process.env.URL}/.netlify/functions/mpesa-stk-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: p.id,
          phone,
          plan: p.plan || "vip",
          amount,
          reason: "auto_renewal"
        })
      });

      const json = await res.json().catch(() => ({}));

      results.push({
        profile_id: p.id,
        name: p.stage_name,
        phone,
        amount,
        ok: res.ok,
        response: json
      });

      await sb.from("admin_audit_logs").insert({
        action: "auto_renew_stk_sent",
        admin_name: "Auto-Renew Engine",
        profile_id: String(p.id),
        profile_name: p.stage_name || null,
        details: `Auto-renew STK sent for KES ${amount}`,
        created_at: new Date().toISOString()
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        checked: profiles?.length || 0,
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
