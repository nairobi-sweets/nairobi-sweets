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
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("renewal_due", true)
      .eq("approved", true)
      .eq("is_expired", false);

    if (error) throw error;

    const profiles = data || [];
    const reminders = [];

    for (const p of profiles) {
      const phone = cleanPhone(p.phone || p.whatsapp);
      if (!phone) continue;

      const amount = planAmount(p.plan);
      const expiry = p.plan_expires_at
        ? new Date(p.plan_expires_at).toLocaleDateString("en-KE")
        : "soon";

      const message =
`Hi ${p.stage_name || "there"},

Your Nairobi Sweets profile expires on ${expiry}.

Plan: ${(p.plan || "VIP").toUpperCase()}
Renewal Amount: KES ${amount}

Reply here when ready to renew.`;

      const whatsapp_url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

      await sb.from("renewal_reminders").insert({
        profile_id: p.id,
        phone,
        plan: p.plan,
        amount,
        whatsapp_url,
        message,
        status: "pending"
      });

      await sb.from("profiles").update({
        last_renewal_reminder_at: new Date().toISOString()
      }).eq("id", p.id);

      reminders.push({
        profile: p.stage_name,
        phone,
        whatsapp_url
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        sent: reminders.length,
        reminders
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: err.message
      })
    };
  }
};
