/* netlify/functions/mpesa-callback.js */

const DEFAULT_TABLE = process.env.MPESA_REQUESTS_TABLE || "stk_push_payments";

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

async function updateSupabaseByCheckoutRequestID(checkoutRequestID, patch) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    return { skipped: true, reason: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" };
  }

  const endpoint =
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${DEFAULT_TABLE}` +
    `?checkout_request_id=eq.${encodeURIComponent(checkoutRequestID)}`;

  const res = await fetch(endpoint, {
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

  if (!res.ok) {
    throw new Error(`Supabase callback update failed: ${res.status} ${text}`);
  }

  return { ok: true, data: text ? JSON.parse(text) : null };
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

    const stkCallback = body?.Body?.stkCallback || {};
    const merchantRequestID = safeString(stkCallback.MerchantRequestID);
    const checkoutRequestID = safeString(stkCallback.CheckoutRequestID);
    const resultCode = Number(stkCallback.ResultCode ?? -1);
    const resultDesc = safeString(stkCallback.ResultDesc);
    const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];

    const amount = findMetadataValue(callbackMetadata, "Amount");
    const mpesaReceiptNumber = findMetadataValue(callbackMetadata, "MpesaReceiptNumber");
    const transactionDate = findMetadataValue(callbackMetadata, "TransactionDate");
    const phoneNumber = findMetadataValue(callbackMetadata, "PhoneNumber");

    const status = resultCode === 0 ? "paid" : "failed";

    const patch = {
      merchant_request_id: merchantRequestID || null,
      checkout_request_id: checkoutRequestID || null,
      result_code: resultCode,
      result_desc: resultDesc || null,
      mpesa_receipt_number: mpesaReceiptNumber ? String(mpesaReceiptNumber) : null,
      transaction_date: transactionDate ? String(transactionDate) : null,
      callback_phone: phoneNumber ? String(phoneNumber) : null,
      callback_amount: amount != null ? Number(amount) : null,
      status,
      paid_at: resultCode === 0 ? new Date().toISOString() : null,
      raw_callback: body,
      updated_at: new Date().toISOString(),
    };

    if (checkoutRequestID) {
      try {
        await updateSupabaseByCheckoutRequestID(checkoutRequestID, patch);
      } catch (dbErr) {
        console.error("Supabase callback update warning:", dbErr.message);
      }
    } else {
      console.error("Missing CheckoutRequestID in callback payload");
    }

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  } catch (error) {
    console.error("mpesa-callback error:", error);

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  }
};
