const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

function findMetadataValue(items, name) {
  if (!Array.isArray(items)) return null;
  const match = items.find((item) => item && item.Name === name);
  return match ? match.Value ?? null : null;
}

async function updatePaymentRow(checkoutRequestID, patch) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/stk_push_payments?checkout_request_id=eq.${encodeURIComponent(checkoutRequestID)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString()
      })
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to update payment row: ${JSON.stringify(data)}`);
  }

  return data[0];
}

async function updateProfileRow(profileId, patch) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update profile row: ${text}`);
  }
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const stkCallback = body?.Body?.stkCallback;
    const checkoutRequestID = stkCallback?.CheckoutRequestID || null;
    const resultCode = String(stkCallback?.ResultCode ?? "");
    const resultDesc = String(stkCallback?.ResultDesc || "");
    const metadataItems = stkCallback?.CallbackMetadata?.Item || [];

    if (!checkoutRequestID) {
      return json(200, { ok: true, message: "No CheckoutRequestID found in callback." });
    }

    const amount = findMetadataValue(metadataItems, "Amount");
    const mpesaReceiptNumber = findMetadataValue(metadataItems, "MpesaReceiptNumber");
    const phoneNumber = findMetadataValue(metadataItems, "PhoneNumber");

    const paymentPatch = {
      status: resultCode === "0" ? "success" : "failed",
      result_code: resultCode,
      result_desc: resultDesc,
      mpesa_receipt_number: mpesaReceiptNumber || null,
      phone: phoneNumber ? String(phoneNumber) : null,
      amount: amount ?? null,
      raw_callback: body
    };

    const updatedPayment = await updatePaymentRow(checkoutRequestID, paymentPatch);

    if (updatedPayment?.profile_id) {
      if (resultCode === "0") {
        await updateProfileRow(updatedPayment.profile_id, {
          status: "active",
          payment_status: "success"
        });
      } else {
        await updateProfileRow(updatedPayment.profile_id, {
          status: "pending",
          payment_status: "failed"
        });
      }
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error("mpesa-callback error:", err);

    return json(200, {
      ok: false,
      error: err.message || "Callback processing failed"
    });
  }
};
