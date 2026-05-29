const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, {
        ok: false,
        error: "Method not allowed",
      });
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.MPESA_CONSUMER_KEY ||
      !process.env.MPESA_CONSUMER_SECRET ||
      !process.env.MPESA_PASSKEY
    ) {
      return json(500, {
        ok: false,
        error: "Missing required environment variables",
      });
    }

    const body = JSON.parse(event.body || "{}");

    const phone = cleanPhone(body.phone);
    const profileId = body.profile_id || body.profileId || null;
    const plan = body.plan || body.package || "vip";
    const amount = Number(body.amount || planAmount(plan));
    const reason = body.reason || "manual_payment";

    if (!phone) {
      return json(400, {
        ok: false,
        error: "Phone number is required",
      });
    }

    if (!profileId) {
      return json(400, {
        ok: false,
        error: "profile_id is required",
      });
    }

    if (!amount || amount < 1) {
      return json(400, {
        ok: false,
        error: "Valid amount is required",
      });
    }

    const shortcode = process.env.MPESA_SHORTCODE || "174379";
    const passkey = process.env.MPESA_PASSKEY;

    const baseUrl =
      process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const callbackUrl =
      process.env.MPESA_CALLBACK_URL ||
      "https://nairobi-sweets.com/.netlify/functions/mpesa-callback";

    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenResponse = await axios.get(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      shortcode + passkey + timestamp
    ).toString("base64");

    const accountReference = `NairobiSweets-${profileId}`;

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
      AccountReference: accountReference,
      TransactionDesc: `${plan} Profile Payment`,
    };

    const stkResponse = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const checkoutRequestID = stkResponse.data.CheckoutRequestID || null;
    const merchantRequestID = stkResponse.data.MerchantRequestID || null;

    const paymentPayload = {
      profile_id: String(profileId),
      plan,
      package: plan,
      amount,
      phone,
      payer_phone: phone,
      status: "pending",
      reason,

      merchant_request_id: merchantRequestID,
      checkout_request_id: checkoutRequestID,

      response_code: stkResponse.data.ResponseCode || null,
      response_description: stkResponse.data.ResponseDescription || null,
      customer_message: stkResponse.data.CustomerMessage || null,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: paymentError } = await supabase
      .from("payments")
      .insert(paymentPayload);

    const { error: requestError } = await supabase
      .from("payment_requests")
      .insert({
        profile_id: String(profileId),
        plan,
        package: plan,
        amount,
        phone,
        status: "pending",
        reason,

        merchant_request_id: merchantRequestID,
        checkout_request_id: checkoutRequestID,

        MerchantRequestID: merchantRequestID,
        CheckoutRequestID: checkoutRequestID,

        response_code: stkResponse.data.ResponseCode || null,
        response_description: stkResponse.data.ResponseDescription || null,
        customer_message: stkResponse.data.CustomerMessage || null,

        raw_response: stkResponse.data,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (paymentError || requestError) {
      return json(200, {
        ok: true,
        warning: "STK sent, but one or more database rows failed to save",
        payment_error: paymentError ? paymentError.message : null,
        payment_request_error: requestError ? requestError.message : null,
        profile_id: profileId,
        plan,
        amount,
        phone,
        checkout_request_id: checkoutRequestID,
        merchant_request_id: merchantRequestID,
        mpesa: stkResponse.data,
      });
    }

    return json(200, {
      ok: true,
      success: true,
      message: "STK push sent successfully",
      profile_id: profileId,
      plan,
      amount,
      phone,
      checkout_request_id: checkoutRequestID,
      merchant_request_id: merchantRequestID,
      mpesa: stkResponse.data,
    });

  } catch (error) {
    console.log("STK push error:", error.response?.data || error.message);

    return json(500, {
      ok: false,
      error: error.response?.data || error.message,
    });
  }
};
