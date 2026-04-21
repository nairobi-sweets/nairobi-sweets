export async function handler() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const now = new Date().toISOString();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?expiry_date=lt.${now}&auto_renew=eq.true`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );

  const users = await res.json();

  for (const u of users) {
    await triggerSTK(u.phone, u.plan_price);
  }

  return { statusCode: 200, body: "Renewal triggered" };
}

async function triggerSTK(phone, amount) {
  await fetch(`${process.env.SITE_URL}/.netlify/functions/mpesa-stk-push`, {
    method: "POST",
    body: JSON.stringify({ phone, amount })
  });
}
