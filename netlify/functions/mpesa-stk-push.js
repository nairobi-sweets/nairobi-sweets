// netlify/functions/mpesa-stk-push.js

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

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = `254${p.slice(1)}`;
  if (p.startsWith("7") && p.length === 9) p = `254${p}`;
  if (/^2547\d{8}$/.test(p)) return p;
  return null;
}

function timestampNow() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function nullableInt(value) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const {
      MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET,
      MPESA_SHORTCODE,
      MPESA_PASSKEY,
      MPESA_CALLBACK_URL,
      MPESA_ENVIRONMENT,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    const missing = [
      ["MPESA_CONSUMER_KEY", MPESA_CONSUMER_KEY],
      ["MPESA_CONSUMER_SECRET", MPESA_CONSUMER_SECRET],
      ["MPESA_SHORTCODE", MPESA_SHORTCODE],
      ["MPESA_PASSKEY", MPESA_PASSKEY],
      ["MPESA_CALLBACK_URL", MPESA_CALLBACK_URL],
      ["MPESA_ENVIRONMENT", MPESA_ENVIRONMENT],
      ["SUPABASE_URL", SUPABASE_URL],
      ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length) {
      return json(500, {
        error: "Missing required environment variables",
        missing,
      });
    }

    const body = JSON.parse(event.body || "{}");

    const phone = normalizePhone(body.phone || body.whatsapp || body.phone_number);
    const amount = Number(body.amount);
    const name = body.name || body.display_name || "NairobiSweets";
    const plan = body.plan || "vip";
    const location = body.location || null;
    const slug = body.slug || null;
    const profile_id = nullableInt(body.profile_id);

    if (!phone) {
      return json(400, { error: "Phone must be in format 2547XXXXXXXX" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return json(400, { error: "Amount must be a positive number" });
    }

    const baseURL =
      MPESA_ENVIRONMENT === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const basicAuth = Buffer.from(
      `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch(
      `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      }
    );

    const tokenText = await tokenRes.text();
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return json(500, {
        error: "Failed to parse token response",
        raw: tokenText,
      });
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      return json(500, {
        error: "Failed to get M-Pesa token",
        tokenData,
      });
    }

    const timestamp = timestampNow();
    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const stkPayload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: slug || name || "NairobiSweets",
      TransactionDesc: `${plan} payment`,
    };

    const stkRes = await fetch(`${baseURL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });

    const stkText = await stkRes.text();
    let stkData;
    try {
      stkData = JSON.parse(stkText);
    } catch {
      return json(500, {
        error: "Failed to parse STK response",
        raw: stkText,
      });
    }

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      return json(500, {
        error: "STK push failed",
        stkData,
      });
    }

    const paymentRow = {
      profile_id,
      phone,
      amount: Math.round(amount),
      name,
      plan,
      location,
      slug,
      status: "pending",
      merchant_request_id: stkData.MerchantRequestID || null,
      checkout_request_id: stkData.CheckoutRequestID || null,
      response_code: stkData.ResponseCode || null,
      response_description: stkData.ResponseDescription || null,
      customer_message: stkData.CustomerMessage || null,
      response_payload: stkData,
      updated_at: new Date().toISOString(),
    };

    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/stk_push_payments`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(paymentRow),
    });

    const saveText = await saveRes.text();
    if (!saveRes.ok) {
      return json(500, {
        error: "STK sent but DB save failed",
        details: saveText,
        stkData,
      });
    }

    let saved = null;
    try {
      saved = JSON.parse(saveText);
    } catch {
      saved = saveText;
    }

    return json(200, {
      success: true,
      message: "STK push sent",
      checkoutRequestID: stkData.CheckoutRequestID,
      merchantRequestID: stkData.MerchantRequestID,
      customerMessage: stkData.CustomerMessage,
      saved,
    });
  } catch (error) {
    return json(500, {
      error: "Server error",
      details: error.message,
      stack: error.stack,
    });
  }
};
