const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

function makeTimestamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds())
  );
}

function normalizePhone(phone) {
  let p = String(phone || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  return p;
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");

    const profileId = body.profile_id;
    const profileName = body.profile_name || body.stage_name || "";
    const phone = normalizePhone(body.phone);
    const amount = Math.round(Number(body.amount || 0));
    const plan = body.plan || "VIP";

    if (!profileId || !phone || !amount) {
      return json(400, {
        error: "Missing profile_id, phone, or amount",
        received: { profileId, phone, amount, plan }
      });
    }

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    if (!shortcode || !passkey || !callbackUrl || !consumerKey || !consumerSecret) {
      return json(500, { error: "Missing M-Pesa environment variables" });
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const tokenRes = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` }
      }
    );

    const tokenText = await tokenRes.text();
    const tokenData = JSON.parse(tokenText || "{}");

    if (!tokenRes.ok || !tokenData.access_token) {
      return json(401, {
        error: "Wrong credentials",
        details: tokenData
      });
    }

    const timestamp = makeTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

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

    const stkRes = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
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
    const stkData = JSON.parse(stkText || "{}");

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      return json(400, {
        error: stkData.errorMessage || stkData.ResponseDescription || "STK Push failed",
        details: stkData
      });
    }

    const { error: payError } = await supabase.from("payments").insert([{
      profile_id: profileId,
      profile_name: profileName,
      phone,
      amount,
      plan,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending"
    }]);

    if (payError) {
      return json(500, {
        error: "Payment row save failed",
        details: payError.message
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
    return json(500, {
      error: error.message || "Server error"
    });
  }
};
