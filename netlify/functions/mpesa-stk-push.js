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

function safeString(v) {
  return v == null ? "" : String(v).trim();
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") && p.length === 9) p = "254" + p;
  if (/^2547\d{8}$/.test(p)) return p;
  return null;
}

function toNumber(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // ENV
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
      ["SUPABASE_URL", SUPABASE_URL],
      ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length) {
      return json(500, { error: "Missing env vars", missing });
    }

    // INPUT
    const body = JSON.parse(event.body || "{}");

    const phone = normalizePhone(body.phone);
    const amount = toNumber(body.amount);
    const name = safeString(body.name) || "NairobiSweets";
    const plan = safeString(body.plan) || "vip";
    const location = safeString(body.location) || null;
    const slug = safeString(body.slug) || null;
    const profile_id = toNumber(body.profile_id);

    if (!phone) {
      return json(400, { error: "Invalid phone format. Use 2547XXXXXXXX" });
    }

    if (!amount || amount <= 0) {
      return json(400, { error: "Invalid amount" });
    }

    // BASE URL
    const baseURL =
      MPESA_ENVIRONMENT === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    // 🔑 1. ACCESS TOKEN
    const auth = Buffer.from(
      `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch(
      `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return json(500, {
        error: "Failed to get access token",
        tokenData,
      });
    }

    // 🔐 2. STK PASSWORD
    const timestamp = timestampNow();

    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    // 📲 3. STK PUSH
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
      AccountReference: slug || name,
      TransactionDesc: `${plan} plan payment`,
    };

    const stkRes = await fetch(
      `${baseURL}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkPayload),
      }
    );

    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      return json(500, {
        error: "STK push failed",
        stkData,
      });
    }

    // 💾 4. SAVE PAYMENT (IMPORTANT FOR AUTO-ACTIVATION)
    const paymentRow = {
      profile_id: profile_id,
      phone,
      amount: Math.round(amount),
      name,
      plan,
      location,
      slug,
      status: "pending",
      merchant_request_id: stkData.MerchantRequestID,
      checkout_request_id: stkData.CheckoutRequestID,
      response_code: stkData.ResponseCode,
      response_description: stkData.ResponseDescription,
      customer_message: stkData.CustomerMessage,
      response_payload: stkData,
      created_at: new Date().toISOString(),
    };

    const saveRes = await fetch(
      `${SUPABASE_URL}/rest/v1/stk_push_payments`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(paymentRow),
      }
    );

    const saved = await saveRes.json();

    if (!saveRes.ok) {
      return json(500, {
        error: "STK sent but DB save failed",
        details: saved,
        stkData,
      });
    }

    // ✅ SUCCESS
    return json(200, {
      success: true,
      message: "STK push sent",
      checkoutRequestID: stkData.CheckoutRequestID,
      customerMessage: stkData.CustomerMessage,
      payment: saved,
    });

  } catch (err) {
    console.error("STK ERROR:", err);
    return json(500, {
      error: "Server error",
      details: err.message,
    });
  }
};
