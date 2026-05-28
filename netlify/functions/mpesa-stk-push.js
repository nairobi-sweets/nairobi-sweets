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

  if (p.startsWith("0")) {
    p = "254" + p.slice(1);
  }

  if (p.startsWith("7") || p.startsWith("1")) {
    p = "254" + p;
  }

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
      return json(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");

    const phone = cleanPhone(body.phone);
    const profileId = body.profile_id || body.profileId || null;
    const plan = body.plan || body.package || "vip";
    const amount = Number(body.amount || planAmount(plan));

    if (!phone) {
      return json(400, { error: "Phone number is required" });
    }

    if (!profileId) {
      return json(400, { error: "profile_id is required" });
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    const shortcode = process.env.MPESA_SHORTCODE || "174379";

    const passkey =
      process.env.MPESA_PASSKEY ||
      "bfb279f9aa9bdbcf158e97ddf0f0d5e0f5f1d7f0d1b0c0";

    const baseUrl =
      process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const auth = Buffer.from(
      `${consumerKey}:${consumerSecret}`
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

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL:
        "https://nairobi-sweets.com/.netlify/functions/mpesa-callback",
      AccountReference: `NairobiSweets-${profileId}`,
      TransactionDesc: `${plan} Profile Payment`,
    };

    console.log("Sending STK push:", stkPayload);

    const stkResponse = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("STK response:", stkResponse.data);

    const checkoutRequestID = stkResponse.data.CheckoutRequestID;
    const merchantRequestID = stkResponse.data.MerchantRequestID;

    const { error: paymentError } = await supabase
      .from("payments")
      .insert({
        profile_id: profileId,
        plan,
        package: plan,
        amount,
        phone,
        payer_phone: phone,
        status: "pending",

        merchant_request_id: merchantRequestID,
        checkout_request_id: checkoutRequestID,

        response_code: stkResponse.data.ResponseCode || null,
        response_description: stkResponse.data.ResponseDescription || null,
        customer_message: stkResponse.data.CustomerMessage || null,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.log("Payment insert error:", paymentError);

      return json(200, {
        ...stkResponse.data,
        warning: "STK sent but payment row was not saved",
        payment_error: paymentError.message,
      });
    }

    return json(200, {
      success: true,
      profile_id: profileId,
      plan,
      amount,
      phone,
      checkout_request_id: checkoutRequestID,
      merchant_request_id: merchantRequestID,
      mpesa: stkResponse.data,
    });
  } catch (error) {
    console.log(
      "STK push error:",
      error.response?.data || error.message
    );

    return json(500, {
      error: error.response?.data || error.message,
    });
  }
};
