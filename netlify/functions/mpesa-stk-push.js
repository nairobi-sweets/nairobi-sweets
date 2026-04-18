/* netlify/functions/mpesa-stk-push.js */

const DEFAULT_TABLE = process.env.MPESA_REQUESTS_TABLE || "stk_push_payments";

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

function safeString(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeKenyanPhone(input) {
  let phone = safeString(input).replace(/\D/g, "");

  if (!phone) return "";

  if (phone.startsWith("0") && phone.length === 10) {
    phone = `254${phone.slice(1)}`;
  } else if (phone.startsWith("7") && phone.length === 9) {
    phone = `254${phone}`;
  } else if (phone.startsWith("254") && phone.length === 12) {
    phone = phone;
  } else if (phone.startsWith("+254")) {
    phone = phone.replace("+", "");
  }

  return /^2547\d{8}$/.test(phone) || /^2541\d{8}$/.test(phone) ? phone : "";
}

function amountToInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
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

function buildPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

function getMpesaBaseUrl() {
  const env = safeString(process.env.MPESA_ENVIRONMENT).toLowerCase();
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

async function getMpesaAccessToken() {
  const key = safeString(process.env.MPESA_CONSUMER_KEY);
  const secret = safeString(process.env.MPESA_CONSUMER_SECRET);

  if (!key || !secret) {
    throw new Error("Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET");
  }

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const url = `${getMpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Failed to get M-Pesa access token: ${res.status} ${JSON.stringify(data)}`
    );
  }

  return data.access_token;
}

async function upsertSupabaseRow(payload) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    return { skipped: true, reason: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" };
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${DEFAULT_TABLE}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Supabase write failed: ${res.status} ${text}`);
  }

  return { ok: true, data: text ? JSON.parse(text) : null };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const phone =
      normalizeKenyanPhone(
        body.phone ||
        body.phoneNumber ||
        body.mpesaPhone ||
        body.msisdn
      );

    const amount = amountToInt(body.amount);
    const accountReference = safeString(
      body.accountReference ||
      body.reference ||
      body.username ||
      body.plan ||
      "Nairobi Sweets"
    ).slice(0, 12);

    const transactionDesc = safeString(
      body.transactionDesc ||
      body.description ||
      body.planName ||
      "Profile Payment"
    ).slice(0, 182);

    const customerName = safeString(body.name || body.fullName);
    const email = safeString(body.email);
    const username = safeString(body.username);
    const plan = safeString(body.plan);
    const till = safeString(process.env.MPESA_SHORTCODE);
    const passkey = safeString(process.env.MPESA_PASSKEY);
    const callbackUrl = safeString(process.env.MPESA_CALLBACK_URL);

    if (!phone) {
      return json(400, {
        ok: false,
        error: "Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX.",
      });
    }

    if (!amount) {
      return json(400, {
        ok: false,
        error: "Invalid amount.",
      });
    }

    if (!till || !passkey || !callbackUrl) {
      return json(500, {
        ok: false,
        error:
          "Missing MPESA_SHORTCODE, MPESA_PASSKEY, or MPESA_CALLBACK_URL in environment variables.",
      });
    }

    const timestamp = timestampNow();
    const password = buildPassword(till, passkey, timestamp);
    const token = await getMpesaAccessToken();

    const stkPayload = {
      BusinessShortCode: till,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: till,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference || "NairobiSweets",
      TransactionDesc: transactionDesc || "Payment",
    };

    const stkUrl = `${getMpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`;

    const mpesaRes = await fetch(stkUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });

    const mpesaData = await mpesaRes.json().catch(() => ({}));

    const checkoutRequestID = safeString(mpesaData.CheckoutRequestID);
    const merchantRequestID = safeString(mpesaData.MerchantRequestID);
    const responseCode = safeString(mpesaData.ResponseCode);
    const responseDescription = safeString(mpesaData.ResponseDescription);
    const customerMessage = safeString(mpesaData.CustomerMessage);

    const dbRow = {
      phone,
      amount,
      account_reference: accountReference || null,
      transaction_desc: transactionDesc || null,
      customer_name: customerName || null,
      email: email || null,
      username: username || null,
      plan: plan || null,
      merchant_request_id: merchantRequestID || null,
      checkout_request_id: checkoutRequestID || null,
      response_code: responseCode || null,
      response_description: responseDescription || null,
      customer_message: customerMessage || null,
      status:
        responseCode === "0"
          ? "pending"
          : "failed",
      raw_request: stkPayload,
      raw_response: mpesaData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await upsertSupabaseRow(dbRow);
    } catch (dbErr) {
      console.error("Supabase save warning:", dbErr.message);
    }

    if (!mpesaRes.ok) {
      return json(502, {
        ok: false,
        error: "M-Pesa request failed.",
        details: mpesaData,
      });
    }

    if (responseCode !== "0") {
      return json(400, {
        ok: false,
        error: responseDescription || "STK push failed.",
        details: mpesaData,
      });
    }

    return json(200, {
      ok: true,
      message: customerMessage || "STK push sent successfully.",
      merchantRequestID,
      checkoutRequestID,
      responseCode,
      responseDescription,
      phone,
      amount,
    });
  } catch (error) {
    console.error("mpesa-stk-push error:", error);

    return json(500, {
      ok: false,
      error: error.message || "Internal server error",
    });
  }
};
