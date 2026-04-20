// netlify/functions/mpesa-callback.js

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

function findMetadataValue(items, name) {
  if (!Array.isArray(items)) return null;
  const found = items.find((item) => item && item.Name === name);
  return found ? found.Value ?? null : null;
}

async function supabasePatch(table, matchColumn, matchValue, patch) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const url =
    `${supabaseUrl}/rest/v1/${table}` +
    `?${encodeURIComponent(matchColumn)}=eq.${encodeURIComponent(matchValue)}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Supabase PATCH failed for ${table}: ${text}`);
  }

  return data;
}

async function supabaseSelectOne(table, matchColumn, matchValue, select = "*") {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const url =
    `${supabaseUrl}/rest/v1/${table}` +
    `?select=${encodeURIComponent(select)}` +
    `&${encodeURIComponent(matchColumn)}=eq.${encodeURIComponent(matchValue)}` +
    `&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Supabase SELECT failed for ${table}: ${text}`);
  }

  return Array.isArray(data) ? data[0] ?? null : null;
}

function planFlags(plan) {
  const clean = safeString(plan).toLowerCase();

  if (clean === "signature" || clean === "vvip") {
    return {
      is_featured: true,
      is_vip: true,
      is_vvip: true,
      category: "signature",
      price_per_week: 3000,
    };
  }

  if (clean === "vip") {
    return {
      is_featured: true,
      is_vip: true,
      is_vvip: false,
      category: "vip",
      price_per_week: 1500,
    };
  }

  return {
    is_featured: true,
    is_vip: false,
    is_vvip: false,
    category: "featured",
    price_per_week: 1000,
  };
}

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return json(400, { error: "Invalid callback payload", received: body });
    }

    const merchantRequestID = stkCallback.MerchantRequestID || null;
    const checkoutRequestID = stkCallback.CheckoutRequestID || null;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc || "";
    const metadata = stkCallback.CallbackMetadata?.Item || [];

    const amount = findMetadataValue(metadata, "Amount");
    const mpesaReceiptNumber = findMetadataValue(metadata, "MpesaReceiptNumber");
    const transactionDate = findMetadataValue(metadata, "TransactionDate");
    const phoneNumber = findMetadataValue(metadata, "PhoneNumber");

    if (!checkoutRequestID) {
      return json(400, { error: "Missing CheckoutRequestID", stkCallback });
    }

    const payment = await supabaseSelectOne(
      "stk_push_payments",
      "checkout_request_id",
      checkoutRequestID,
      "*"
    );

    if (!payment) {
      return json(404, {
        error: "Payment row not found for CheckoutRequestID",
        checkoutRequestID,
      });
    }

    const paidAt = new Date().toISOString();
    const paymentPatch = {
      merchant_request_id: merchantRequestID,
      checkout_request_id: checkoutRequestID,
      result_code: resultCode,
      result_desc: resultDesc,
      amount: amount ?? payment.amount ?? null,
      phone: phoneNumber ? String(phoneNumber) : payment.phone ?? null,
      mpesa_receipt_number: mpesaReceiptNumber ?? null,
      paid_at: resultCode === 0 ? paidAt : null,
      callback_payload: body,
      status: resultCode === 0 ? "paid" : "failed",
      updated_at: new Date().toISOString(),
    };

    await supabasePatch(
      "stk_push_payments",
      "checkout_request_id",
      checkoutRequestID,
      paymentPatch
    );

    if (resultCode === 0 && payment.profile_id) {
      const flags = planFlags(payment.plan);
      const profilePatch = {
        is_active: true,
        payment_status: "paid",
        last_payment_at: paidAt,
        expires_at: addDaysIso(7),
        is_featured: flags.is_featured,
        is_vip: flags.is_vip,
        is_vvip: flags.is_vvip,
        category: flags.category,
        price_per_week: Number(amount ?? flags.price_per_week),
        updated_at: new Date().toISOString(),
      };

      await supabasePatch(
        "profiles",
        "id",
        payment.profile_id,
        profilePatch
      );
    }

    if (resultCode !== 0 && payment.profile_id) {
      await supabasePatch("profiles", "id", payment.profile_id, {
        payment_status: "failed",
        updated_at: new Date().toISOString(),
      });
    }

    return json(200, {
      ok: true,
      checkoutRequestID,
      resultCode,
      resultDesc,
      autoActivated: resultCode === 0 && !!payment.profile_id,
    });
  } catch (error) {
    console.error("M-Pesa callback error:", error);
    return json(500, {
      error: "Callback processing failed",
      details: error.message,
    });
  }
};
