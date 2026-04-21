export async function handler() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stk_push_payments?status=eq.pending&select=*`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );

  const rows = await res.json();

  const now = new Date();

  for (const row of rows) {
    const created = new Date(row.created_at);
    const minutes = (now - created) / 60000;

    // after 5 mins → send reminder
    if (minutes > 5 && !row.last_reminder_at) {
      await sendWhatsApp(row.phone, "⚠️ You didn’t complete your payment. Tap to finish and go live.");

      await fetch(`${SUPABASE_URL}/rest/v1/stk_push_payments?id=eq.${row.id}`, {
        method: "PATCH",
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ last_reminder_at: new Date().toISOString() })
      });
    }
  }

  return { statusCode: 200, body: "Recovery check done" };
}

async function sendWhatsApp(phone, text) {
  // plug your WhatsApp API here
  console.log("Send WA to", phone, text);
}
