const MPESA_ENV = process.env.MPESA_ENV || "sandbox";

const BASE_URL =
  MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  };
}

function timestamp() {
  const d = new Date();

  const pad = n => String(n).padStart(2, "0");

  return (
    d.getFullYear().toString() +
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

async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error("Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET");
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const response = await fetch(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`
      }
    }
  );

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid token response: " + text);
  }

  if (!response.ok || !data.access_token) {
    throw new Error(data.errorMessage || data.error || "Failed to get M-Pesa token");
  }

  return data.access_token;
}

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const phone = normalizePhone(body.phone);
    const amount = Math.round(Number(body.amount || 0));
    const profileId = body.profile_id;
    const plan = body.plan || "profile";

    if (!phone || !amount || !profileId) {
      return json(400, {
        error: "Missing phone, amount, or profile_id"
      });
    }

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const transactionType =
      process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline";

    if (!shortcode || !passkey || !callbackUrl) {
      return json(500, {
        error: "Missing MPESA_SHORTCODE, MPESA_PASSKEY, or MPESA_CALLBACK_URL"
      });
    }

    const time = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${time}`).toString("base64");
    const token = await getAccessToken();

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: time,
      TransactionType: transactionType,
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: `NS-${profileId}`,
      TransactionDesc: `Nairobi Sweets ${plan}`
    };

    const response = await fetch(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return json(502, {
        error: "Invalid STK response",
        raw: text
      });
    }

    if (!response.ok) {
      return json(response.status, {
        error: result.errorMessage || result.error || "STK Push failed",
        details: result
      });
    }

    return json(200, {
      success: true,
      message: "M-Pesa prompt sent. Check your phone.",
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      response: result
    });

  } catch (error) {
    return json(500, {
      error: error.message || "Server error"
    });
  }
};
