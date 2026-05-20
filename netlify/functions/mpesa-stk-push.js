function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

function getTimestamp() {
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

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");

    const phone = normalizePhone(body.phone);
    const amount = Math.round(Number(body.amount || 0));
    const profileId = body.profile_id || "profile";
    const plan = body.plan || "VIP";

    if (!phone || !amount) {
      return json(400, { error: "Missing phone or amount" });
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE || "174379";
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
      return json(500, {
        error: "Missing M-Pesa environment variables"
      });
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const tokenRes = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const tokenText = await tokenRes.text();

    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return json(500, {
        error: "Invalid token response",
        raw: tokenText
      });
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      return json(401, {
        error: tokenData.errorMessage || tokenData.error || "Wrong credentials",
        details: tokenData
      });
    }

    const timestamp = getTimestamp();
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

    let stkData;
    try {
      stkData = JSON.parse(stkText);
    } catch {
      return json(500, {
        error: "Invalid STK response",
        raw: stkText
      });
    }

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      return json(400, {
        error: stkData.errorMessage || stkData.ResponseDescription || "STK Push failed",
        details: stkData
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
