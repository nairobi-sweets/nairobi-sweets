const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  },
  body: JSON.stringify(body)
});

function normalizePhone(phone) {
  let p = String(phone || "").trim().replace(/\s+/g, "");
  if (p.startsWith("+254")) return p.slice(1);
  if (p.startsWith("254")) return p;
  if (p.startsWith("0")) return "254" + p.slice(1);
  return p;
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

async function getMpesaAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error("Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET");
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const baseUrl =
    process.env.MPESA_ENVIRONMENT === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(`Failed to get M-Pesa token: ${JSON.stringify(data)}`);
  }

  return {
    accessToken: data.access_token,
    baseUrl
  };
}

async function insertPaymentRow(row) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/stk_push_payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify([row])
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to insert payment row: ${JSON.stringify(data)}`);
  }

  return data[0];
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

    const profileId = body.profile_id || null;
    const name = String(body.name || "").trim();
    const phone = normalizePhone(body.phone);
    const email = String(body.email || "").trim();
    const location = String(body.location || "").trim();
    const bio = String(body.bio || "").trim();
    const photoUrl = String(body.photo_url || "").trim();
    const amount = Number(body.amount || 1000);

    if (!profileId) {
      return json(400, { ok: false, error: "Missing profile_id" });
    }

    if (!name) {
      return json(400, { ok: false, error: "Missing name" });
    }

    if (!/^254\d{9}$/.test(phone)) {
      return json(400, { ok: false, error: "Invalid phone number format" });
    }

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!shortcode || !passkey || !callbackUrl) {
      return json(500, {
        ok: false,
        error: "Missing MPESA_SHORTCODE, MPESA_PASSKEY, or MPESA_CALLBACK_URL"
      });
    }

    const { accessToken, baseUrl } = await getMpesaAccessToken();
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
      AccountReference: "NairobiSweets",
      TransactionDesc: "Profile Activation"
    };

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(stkPayload)
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok || !stkData.CheckoutRequestID) {
      return json(400, {
        ok: false,
        error:
          stkData.errorMessage ||
          stkData.ResponseDescription ||
          "STK push request failed",
        raw: stkData
      });
    }

    await insertPaymentRow({
      profile_id: profileId,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID || "",
      phone,
      amount,
      status: "pending",
      result_code: null,
      result_desc: stkData.CustomerMessage || stkData.ResponseDescription || "",
      mpesa_receipt_number: null,
      raw_request: {
        frontend_payload: {
          profile_id: profileId,
          name,
          phone,
          email,
          location,
          bio,
          photo_url: photoUrl,
          amount
        },
        stk_payload: stkPayload
      }
    });

    return json(200, {
      ok: true,
      checkoutRequestID: stkData.CheckoutRequestID,
      merchantRequestID: stkData.MerchantRequestID || "",
      customerMessage: stkData.CustomerMessage || "STK request accepted for processing."
    });
  } catch (err) {
    console.error("mpesa-stk-push error:", err);
    return json(500, {
      ok: false,
      error: err.message || "Internal server error"
    });
  }
};
