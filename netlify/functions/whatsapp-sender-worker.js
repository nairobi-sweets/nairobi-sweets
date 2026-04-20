// netlify/functions/whatsapp-sender-worker.js

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

function safeString(v) {
  return v == null ? "" : String(v).trim();
}

function normalizePhone(phone) {
  let p = safeString(phone).replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = `254${p.slice(1)}`;
  if (p.startsWith("7") && p.length === 9) p = `254${p}`;
  if (/^2547\d{8}$/.test(p)) return p;
  return null;
}

async function sbSelect(path) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRole = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "GET",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let data = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(`Failed to parse Supabase GET response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Supabase GET failed: ${text}`);
  }

  return data;
}

async function sbPatch(table, filter, patch) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRole = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  const text = await res.text();
  let data = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(`Failed to parse Supabase PATCH response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Supabase PATCH failed: ${text}`);
  }

  return data;
}

async function sendWhatsAppText({ to, message }) {
  const token = safeString(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = safeString(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const apiVersion = safeString(process.env.WHATSAPP_API_VERSION) || "v20.0";

  if (!token || !phoneNumberId) {
    throw new Error(
      "Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID"
    );
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: message,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `WhatsApp API error: ${typeof data === "object" ? JSON.stringify(data) : text}`
    );
  }

  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (!["GET", "POST"].includes(event.httpMethod)) {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = safeString(process.env.SUPABASE_URL);
    const serviceRole = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !serviceRole) {
      return json(500, {
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const nowIso = new Date().toISOString();

    // Fetch pending messages that are due now
    const pendingRows = await sbSelect(
      [
        "whatsapp_queue",
        "select=id,profile_id,phone,template,message,status,scheduled_for,meta",
        "status=eq.pending",
        `scheduled_for=lte.${encodeURIComponent(nowIso)}`,
        "order=scheduled_for.asc",
        "limit=20",
      ]
        .join("?")
        .replace("?select", "?select")
        .replaceAll("?", "&")
        .replace("&select", "?select")
    );

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (const row of pendingRows) {
      try {
        const phone = normalizePhone(row.phone);

        if (!phone) {
          await sbPatch(
            "whatsapp_queue",
            `id=eq.${encodeURIComponent(row.id)}`,
            {
              status: "failed",
              error_message: "Invalid phone number",
            }
          );

          failedCount += 1;
          results.push({
            id: row.id,
            status: "failed",
            reason: "Invalid phone number",
          });
          continue;
        }

        const apiResponse = await sendWhatsAppText({
          to: phone,
          message: safeString(row.message),
        });

        await sbPatch(
          "whatsapp_queue",
          `id=eq.${encodeURIComponent(row.id)}`,
          {
            status: "sent",
            sent_at: new Date().toISOString(),
            error_message: null,
            meta: {
              ...(row.meta || {}),
              whatsapp_response: apiResponse,
            },
          }
        );

        sentCount += 1;
        results.push({
          id: row.id,
          status: "sent",
        });
      } catch (err) {
        await sbPatch(
          "whatsapp_queue",
          `id=eq.${encodeURIComponent(row.id)}`,
          {
            status: "failed",
            error_message: safeString(err.message).slice(0, 1000),
          }
        );

        failedCount += 1;
        results.push({
          id: row.id,
          status: "failed",
          reason: err.message,
        });
      }
    }

    return json(200, {
      ok: true,
      queued_found: pendingRows.length,
      sent: sentCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error("whatsapp-sender-worker error:", error);
    return json(500, {
      error: "WhatsApp sender worker failed",
      details: error.message,
    });
  }
};
