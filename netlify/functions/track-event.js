const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

function safeString(v) {
  return v == null ? "" : String(v).trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const SUPABASE_URL = safeString(process.env.SUPABASE_URL);
    const SUPABASE_SERVICE_ROLE_KEY = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase env vars" });
    }

    const body = JSON.parse(event.body || "{}");

    const row = {
      event_name: safeString(body.event_name),
      profile_id: body.profile_id ?? null,
      slug: safeString(body.slug) || null,
      page_url: safeString(body.page_url) || null,
      referrer: safeString(body.referrer) || null,
      session_id: safeString(body.session_id) || null,
      user_agent: safeString(event.headers["user-agent"]) || null,
      meta: body.meta || {},
    };

    if (!row.event_name) {
      return json(400, { error: "event_name is required" });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const text = await res.text();
      return json(500, { error: "Failed to save event", details: text });
    }

    return json(200, { ok: true });
  } catch (error) {
    return json(500, {
      error: "track-event failed",
      details: error.message,
    });
  }
};
