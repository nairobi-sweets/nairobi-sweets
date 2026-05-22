const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(data)
  };
}

function cleanEnv(value) {
  return String(value || "").trim();
}

function makeTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");

  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function normalizePhone(phone) {
  let p = String(phone || "").replace(/\D/g, "");

  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;

  return p;
}

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return json(200, { ok: true });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");

    const profileId = body.profile_id;
    const profileName = body.profile_name || body.stage_name || "Unknown";
    const phone = normalizePhone(body.phone);
    const amount = Math.round(Number(body.amount || 0));
    const plan = body.plan || body.package || "VIP";

    if (!profileId) {
      return json(400, { error: "Missing profile_id" });
    }

    if (!phone || !phone.startsWith("254")) {
      return json(400, { error: "Invalid phone number" });
    }

    if (!amount || amount <= 0) {
      return json(400, { error: "Invalid amount" });
    }

    const env = cleanEnv(process.env.MPESA_ENVIRONMENT || "sandbox").toLowerCase();
    const shortcode = cleanEnv(process.env.MPESA_SHORTCODE);
    const passkey = cleanEnv(process.env.MPESA_PASSKEY);
    const callbackUrl = cleanEnv(process.env.MPESA_CALLBACK_URL);
    const consumerKey = cleanEnv(process.env.MPESA_CONSUMER_KEY);
    const consumerSecret = cleanEnv(process.env.MPESA_CONSUMER_SECRET);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing Supabase environment variables" });
    }

    if (!shortcode || !passkey || !callbackUrl || !consumerKey || !consumerSecret) {
      return json(500, {
        error: "Missing M-Pesa environment variables",
        required: [
          "MPESA_SHORTCODE",
          "MPESA_PASSKEY",
          "MPESA_CALLBACK_URL",
          "MPESA_CONSUMER_KEY",
          "MPESA_CONSUMER_SECRET"
        ]
      });
    }

    const baseUrl =
      env === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const auth = Buffer
      .from(`${consumerKey}:${consumerSecret}`)
      .toString("base64");

    const tokenRes = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const tokenText = await tokenRes.text();

    let tokenData = {};
    try {
      tokenData = tokenText ? JSON.parse(tokenText) : {};
    } catch {
      tokenData = { raw: tokenText };
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      console.log("M-Pesa token error:", tokenData);

      return json(401, {
        error: "Wrong credentials",
        status: tokenRes.status,
        details: tokenData
      });
    }

    const timestamp = makeTimestamp();

    const password = Buffer
      .from(`${shortcode}${passkey}${timestamp}`)
      .toString("base64");

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: `NS-${profileId}`,
      TransactionDesc: `Nairobi Sweets ${plan}`
    };

    console.log("STK payload:", {
      BusinessShortCode: stkPayload.BusinessShortCode,
      Timestamp: stkPayload.Timestamp,
      Amount: stkPayload.Amount,
      PartyA: stkPayload.PartyA,
      PartyB: stkPayload.PartyB,
      PhoneNumber: stkPayload.PhoneNumber,
      CallBackURL: stkPayload.CallBackURL,
      AccountReference: stkPayload.AccountReference,
      Environment: env
    });

    const stkRes = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(stkPayload)
      }
    );

    const stkText = await stkRes.text();

    let stkData = {};
    try {
      stkData = stkText ? JSON.parse(stkText) : {};
    } catch {
      stkData = { raw: stkText };
    }

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      console.log("STK push error:", stkData);

      return json(400, {
        error: stkData.errorMessage || stkData.ResponseDescription || "STK Push failed",
        details: stkData
      });
    }

    const { error: paymentError } = await supabase
      .from("payments")
      .insert([{
        profile_id: profileId,
        profile_name: profileName,
        phone,
        payer_phone: phone,
        amount,
        plan,
        status: "pending",
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        result_desc: stkData.ResponseDescription || null,
        raw_callback: null,
        updated_at: new Date().toISOString()
      }]);

    if (paymentError) {
      console.log("Payment row save failed:", paymentError);

      return json(500, {
        error: "Payment row save failed",
        details: paymentError.message
      });
    }

    return json(200, {
      success: true,
      message: "M-Pesa prompt sent. Check your phone.",
      checkoutRequestId: stkData.CheckoutRequestID,
      merchantRequestId: stkData.MerchantRequestID,
      response: stkData
    });

  } catch (error) {
    console.log("STK fatal error:", error);

    return json(500, {
      error: error.message || "Server error"
    });
  }
};
