const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    },
    body: JSON.stringify(body)
  };
}

function findCallbackValue(items = [], key) {
  const hit = items.find((item) => item.Name === key);
  return hit ? hit.Value ?? null : null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = `254${p.slice(1)}`;
  if (p.startsWith("7") && p.length === 9) p = `254${p}`;
  if (p.startsWith("254") && p.length === 12) return p;
  return null;
}

async function activateProfileFromPayment(payment) {
  if (!payment?.profile_id) {
    return { ok: false, reason: "No profile_id on payment row" };
  }

  const updates = {
    payment_status: "paid",
    is_active: true,
    is_vip: payment.plan === "vip" || payment.plan === "VIP",
    is_featured: payment.plan === "featured" || payment.plan === "FEATURED",
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", payment.profile_id);

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
        },
        body: ""
      };
    }

    if (event.httpMethod === "GET") {
      return json(200, { message: "Callback received" });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return json(500, { error: "Missing Supabase environment variables." });
    }

    const rawBody = JSON.parse(event.body || "{}");

    const stk =
      rawBody?.Body?.stkCallback ||
      rawBody?.stkCallback ||
      rawBody?.body?.stkCallback ||
      null;

    if (!stk) {
      console.warn("Invalid callback payload:", rawBody);
      return json(200, { message: "Ignored: invalid callback payload" });
    }

    const merchantRequestID = stk.MerchantRequestID || null;
    const checkoutRequestID = stk.CheckoutRequestID || null;
    const resultCode = Number(stk.ResultCode ?? -1);
    const resultDesc = stk.ResultDesc || null;
    const metadata = stk.CallbackMetadata?.Item || [];

    const amount = Number(findCallbackValue(metadata, "Amount") || 0);
    const mpesaReceiptNumber = findCallbackValue(metadata, "MpesaReceiptNumber");
    const transactionDate = findCallbackValue(metadata, "TransactionDate");
    const phone = normalizePhone(findCallbackValue(metadata, "PhoneNumber"));

    let requestRow = null;

    if (checkoutRequestID) {
      const { data, error } = await supabase
        .from("stk_push_requests")
        .select("*")
        .eq("checkout_request_id", checkoutRequestID)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error reading stk_push_requests:", error);
      } else {
        requestRow = data;
      }
    }

    const paymentRow = {
      phone: phone || requestRow?.phone || null,
      amount: amount || requestRow?.amount || null,
      mpesa_receipt_number: mpesaReceiptNumber || null,
      transaction_date: transactionDate ? String(transactionDate) : null,
      merchant_request_id: merchantRequestID,
      checkout_request_id: checkoutRequestID,
      result_code: resultCode,
      result_desc: resultDesc,
      status: resultCode === 0 ? "success" : "failed",
      profile_id: requestRow?.profile_id || null,
      plan: requestRow?.plan || null,
      raw_callback: rawBody
    };

    const { data: insertedPayment, error: paymentError } = await supabase
      .from("payments")
      .insert([paymentRow])
      .select()
      .single();

    if (paymentError) {
      console.error("Error inserting payment:", paymentError);
    }

    if (checkoutRequestID) {
      const { error: updateReqError } = await supabase
        .from("stk_push_requests")
        .update({
          status: resultCode === 0 ? "success" : "failed",
          result_code: resultCode,
          result_desc: resultDesc,
          mpesa_receipt_number: mpesaReceiptNumber || null,
          transaction_date: transactionDate ? String(transactionDate) : null,
          raw_callback: rawBody,
          updated_at: new Date().toISOString()
        })
        .eq("checkout_request_id", checkoutRequestID);

      if (updateReqError) {
        console.error("Error updating stk_push_requests:", updateReqError);
      }
    }

    if (resultCode === 0 && insertedPayment) {
      const activation = await activateProfileFromPayment(insertedPayment);
      if (!activation.ok) {
        console.warn("Profile activation skipped/failed:", activation.reason);
      }
    }

    return json(200, {
      message: "Callback received",
      checkout_request_id: checkoutRequestID,
      result_code: resultCode,
      result_desc: resultDesc
    });
  } catch (error) {
    console.error("mpesa-callback error:", error);
    return json(500, {
      error: "Internal server error",
      details: error.message
    });
  }
};
