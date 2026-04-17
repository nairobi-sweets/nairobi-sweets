const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const mpesaConsumerKey = process.env.MPESA_CONSUMER_KEY;
const mpesaConsumerSecret = process.env.MPESA_CONSUMER_SECRET;
const mpesaShortcode = process.env.MPESA_SHORTCODE;
const mpesaPasskey = process.env.MPESA_PASSKEY;
const mpesaCallbackUrl = process.env.MPESA_CALLBACK_URL;
const mpesaEnvironment = (process.env.MPESA_ENVIRONMENT || "sandbox").toLowerCase();
const mpesaInitiatorName = process.env.MPESA_INITIATOR_NAME || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    },
    body: JSON.stringify(body)
  };
}

function normalizePhone(phone) {
  if (!phone) return null;

  let p = String(phone).replace(/\D/g, "");

  if (p.startsWith("0")) p = `254${p.slice(1)}`;
  if (p.startsWith("7") && p.length === 9) p = `254${p}`;
  if (p.startsWith("254") && p.length === 12) return p;

  return null;
}

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function getMpesaBaseUrl() {
  return mpesaEnvironment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

async function getMpesaAccessToken() {
  const auth = Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString("base64");

  const res = await fetch(`${getMpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    throw new Error(`Failed to get MPESA access token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function activateProfileFromPayment(payment) {
  if (!payment?.profile_id) {
    return { ok: false, reason: "No profile_id on payment row" };
  }

  const updates = {
    payment_status: "paid",
    is_active: true,
    is_vip: payment.plan === "vip" || payment.plan === "VIP",
    is_featured: payment.plan === "featured" || payment.plan === "FEATURED",
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", payment.profile_id);

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        },
        body: ""
      };
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed. Use POST." });
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return json(500, { error: "Missing Supabase environment variables." });
    }

    if (
      !mpesaConsumerKey ||
      !mpesaConsumerSecret ||
      !mpesaShortcode ||
      !mpesaPasskey ||
      !mpesaCallbackUrl
    ) {
      return json(500, { error: "Missing MPESA environment variables." });
    }

    const body = JSON.parse(event.body || "{}");

    const rawPhone = body.phone || body.msisdn;
    const amountRaw = body.amount;
    const accountReference =
      body.accountReference ||
      body.account_reference ||
      body.stage_name ||
      body.name ||
      "NairobiSweets";
    const transactionDesc =
      body.transactionDesc ||
      body.transaction_desc ||
      body.plan ||
      "Profile payment";

    const profileId = body.profile_id || body.profileId || null;
    const plan = body.plan || null;
    const fullName = body.name || body.full_name || null;

    const phone = normalizePhone(rawPhone);
    const amount = Number(amountRaw);

    if (!phone) {
      return json(400, { error: "Invalid phone number. Use 2547XXXXXXXX." });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return json(400, { error: "Invalid amount." });
    }

    const timestamp = getTimestamp();
    const password = Buffer.from(`${mpesaShortcode}${mpesaPasskey}${timestamp}`).toString("base64");
    const token = await getMpesaAccessToken();

    const payload = {
      BusinessShortCode: mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: mpesaShortcode,
      PhoneNumber: phone,
      CallBackURL: mpesaCallbackUrl,
      AccountReference: String(accountReference).slice(0, 12),
      TransactionDesc: String(transactionDesc).slice(0, 13)
    };

    const mpesaRes = await fetch(`${getMpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const mpesaData = await mpesaRes.json().catch(() => ({}));

    const requestRow = {
      phone,
      amount,
      account_reference: payload.AccountReference,
      transaction_desc: payload.TransactionDesc,
      merchant_request_id: mpesaData.MerchantRequestID || null,
      checkout_request_id: mpesaData.CheckoutRequestID || null,
      response_code: mpesaData.ResponseCode || null,
      response_description: mpesaData.ResponseDescription || null,
      customer_message: mpesaData.CustomerMessage || null,
      status: mpesaRes.ok ? "pending" : "failed",
      profile_id: profileId,
      plan,
      full_name: fullName,
      raw_response: mpesaData
    };

    const { error: insertError } = await supabase
      .from("stk_push_requests")
      .insert([requestRow]);

    if (insertError) {
      console.error("Failed to insert stk_push_requests:", insertError);
    }

    if (!mpesaRes.ok) {
      return json(400, {
        error: "MPESA STK request failed",
        mpesa: mpesaData
      });
    }

    return json(200, {
      ok: true,
      message: mpesaData.CustomerMessage || "STK push sent",
      merchant_request_id: mpesaData.MerchantRequestID || null,
      checkout_request_id: mpesaData.CheckoutRequestID || null,
      phone,
      amount
    });
  } catch (error) {
    console.error("mpesa-stk-push error:", error);
    return json(500, {
      error: "Internal server error",
      details: error.message
    });
  }
};
