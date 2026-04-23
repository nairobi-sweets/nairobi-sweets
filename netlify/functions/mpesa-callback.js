const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAYMENTS_TABLE = process.env.MPESA_REQUESTS_TABLE || "stk_push_payments";
const PROFILES_TABLE = process.env.PROFILES_TABLE || "profiles";

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

function normalizePhone(value) {
  let v = safeString(value).replace(/\D/g, "");
  if (!v) return "";
  if (v.startsWith("0")) v = "254" + v.slice(1);
  if (v.startsWith("7")) v = "254" + v;
  return v;
}

async function updatePaymentRow(supabase, checkoutRequestID, patch) {
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .update(patch)
    .eq("checkout_request_id", checkoutRequestID)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Failed to update payment row:", error.message);
    return null;
  }

  return data || null;
}

async function getPaymentRow(supabase, checkoutRequestID) {
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select("*")
    .eq("checkout_request_id", checkoutRequestID)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch payment row:", error.message);
    return null;
  }

  return data || null;
}

async function activateProfileByEmail(supabase, email, activationPatch) {
  if (!email) return { updated: false, reason: "missing email" };

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .update(activationPatch)
    .eq("email", email)
    .select("id,email,stage_name,payment_status,approval_status,status")
    .maybeSingle();

  if (error) {
    console.error("Failed to activate profile by email:", error.message);
    return { updated: false, reason: error.message };
  }

  return { updated: !!data, row: data || null };
}

async function activateProfileByPhone(supabase, phone, activationPatch) {
  if (!phone) return { updated: false, reason: "missing phone" };

  const normalized = normalizePhone(phone);

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .update(activationPatch)
    .or(`phone.eq.${normalized},whatsapp.eq.${normalized}`)
    .select("id,email,stage_name,payment_status,approval_status,status")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to activate profile by phone:", error.message);
    return { updated: false, reason: error.message };
  }

  return { updated: !!data, row: data || null };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return json(200, { ok: true });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = JSON.parse(event.body || "{}");
    const stk = payload?.Body?.stkCallback;

    if (!stk) {
      console.log("No stkCallback in payload");
      return json(200, { ok: true, message: "No stkCallback payload found" });
    }

    const checkoutRequestID = safeString(stk.CheckoutRequestID);
    const merchantRequestID = safeString(stk.MerchantRequestID);
    const resultCode = Number(stk.ResultCode);
    const resultDesc = safeString(stk.ResultDesc);

    const metadataItems = stk?.CallbackMetadata?.Item || [];
    const amount = findMetadataValue(metadataItems, "Amount");
    const mpesaReceiptNumber = findMetadataValue(metadataItems, "MpesaReceiptNumber");
    const phoneNumber = normalizePhone(findMetadataValue(metadataItems, "PhoneNumber"));
    const transactionDate = findMetadataValue(metadataItems, "TransactionDate");

    console.log("M-Pesa callback received:", {
      checkoutRequestID,
      merchantRequestID,
      resultCode,
      resultDesc,
      amount,
      mpesaReceiptNumber,
      phoneNumber,
      transactionDate,
    });

    const existingPaymentRow = await getPaymentRow(supabase, checkoutRequestID);

    const paymentPatch = {
      merchant_request_id: merchantRequestID || existingPaymentRow?.merchant_request_id || null,
      result_code: resultCode,
      result_desc: resultDesc || null,
      amount: amount ?? existingPaymentRow?.amount ?? null,
      mpesa_receipt_number: mpesaReceiptNumber ?? null,
      phone: phoneNumber || existingPaymentRow?.phone || null,
      transaction_date: transactionDate ? String(transactionDate) : null,
      payment_status: resultCode === 0 ? "paid" : "failed",
      status: resultCode === 0 ? "paid" : "failed",
      paid_at: resultCode === 0 ? new Date().toISOString() : null,
      callback_payload: payload,
      updated_at: new Date().toISOString(),
    };

    const updatedPaymentRow =
      (checkoutRequestID && await updatePaymentRow(supabase, checkoutRequestID, paymentPatch)) ||
      existingPaymentRow;

    let profileResult = { updated: false, reason: "not attempted" };

    if (resultCode === 0) {
      const activationPatch = {
        payment_status: "paid",
        payment_verified: true,
        approval_status: "approved",
        status: "active",
        verified: true,
        amount: amount ?? updatedPaymentRow?.amount ?? null,
        mpesa_receipt_number: mpesaReceiptNumber ?? null,
        updated_at: new Date().toISOString(),
      };

      const profileEmail =
        safeString(updatedPaymentRow?.email) ||
        safeString(updatedPaymentRow?.profile_email) ||
        safeString(updatedPaymentRow?.customer_email);

      profileResult = await activateProfileByEmail(supabase, profileEmail, activationPatch);

      if (!profileResult.updated) {
        profileResult = await activateProfileByPhone(
          supabase,
          phoneNumber || updatedPaymentRow?.phone,
          activationPatch
        );
      }

      console.log("Profile activation result:", profileResult);
    }

    return json(200, {
      ok: true,
      checkoutRequestID,
      resultCode,
      paymentUpdated: !!updatedPaymentRow,
      profileUpdated: !!profileResult.updated,
      profileReason: profileResult.reason || null,
    });
  } catch (err) {
    console.error("mpesa-callback error:", err);
    return json(500, {
      error: err.message || "Callback failed",
    });
  }
};
