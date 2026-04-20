exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  });

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

    if (
      !MPESA_CONSUMER_KEY ||
      !MPESA_CONSUMER_SECRET ||
      !MPESA_SHORTCODE ||
      !MPESA_PASSKEY ||
      !MPESA_CALLBACK_URL ||
      !MPESA_ENVIRONMENT ||
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(500, { error: "Missing required environment variables" });
    }

    const body = JSON.parse(event.body || "{}");
    const { phone, amount, name, plan, location, slug } = body;

    if (!phone || !amount) {
      return json(400, { error: "Phone and amount are required" });
    }

    const normalizedPhone = String(phone).replace(/\D/g, "");
    if (!/^2547\d{8}$/.test(normalizedPhone)) {
      return json(400, { error: "Phone must be in format 2547XXXXXXXX" });
    }

    const baseURL =
      MPESA_ENVIRONMENT === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const auth = Buffer.from(
      `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch(
      `${baseURL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const tokenText = await tokenRes.text();
    let tokenData = {};
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

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const stkPayload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Number(amount),
      PartyA: normalizedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: name || "NairobiSweets",
      TransactionDesc: `${plan || "Plan"} payment`,
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
    let stkData = {};
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

    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/stk_push_payments`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        amount: Number(amount),
        name: name || null,
        plan: plan || null,
        location: location || null,
        slug: slug || null,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        status: "pending",
      }),
    });

    const saveText = await saveRes.text();

    if (!saveRes.ok) {
      return json(500, {
        error: "STK sent but DB save failed",
        details: saveText,
      });
    }

    return json(200, {
      success: true,
      message: "STK push sent",
      checkoutRequestID: stkData.CheckoutRequestID,
      merchantRequestID: stkData.MerchantRequestID,
    });
  } catch (error) {
    return json(500, {
      error: "Server error",
      details: error.message,
      stack: error.stack,
    });
  }
};
