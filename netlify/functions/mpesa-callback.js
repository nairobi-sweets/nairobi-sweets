const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

function callbackItem(items, name) {
  const found = (items || []).find((item) => item.Name === name);
  return found ? found.Value : null;
}

function addDaysISO(baseDate, days = 7) {
  const now = new Date();
  const base = baseDate ? new Date(baseDate) : now;

  const start =
    Number.isNaN(base.getTime()) || base < now
      ? now
      : base;

  start.setDate(start.getDate() + days);
  return start.toISOString();
}

function rankFromPlan(plan) {
  const p = String(plan || "").toLowerCase();

  if (p.includes("signature") || p.includes("vvip")) return 4;
  if (p.includes("vip")) return 3;
  if (p.includes("featured")) return 2;

  return 1;
}

function boostFromPlan(plan) {
  const p = String(plan || "").toLowerCase();

  if (p.includes("signature") || p.includes("vvip")) return 600;
  if (p.includes("vip")) return 300;
  if (p.includes("featured")) return 100;

  return 0;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, {
        ResultCode: 1,
        ResultDesc: "Method not allowed",
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, {
        ResultCode: 1,
        ResultDesc: "Missing Supabase environment variables",
      });
    }

    const payload = JSON.parse(event.body || "{}");

    const stk = payload?.Body?.stkCallback || {};

    const merchantRequestId = stk.MerchantRequestID || "";
    const checkoutRequestId = stk.CheckoutRequestID || "";
    const resultCode = Number(stk.ResultCode);
    const resultDesc = stk.ResultDesc || "";

    const metadata =
      stk.CallbackMetadata &&
      Array.isArray(stk.CallbackMetadata.Item)
        ? stk.CallbackMetadata.Item
        : [];

    const amount = Number(callbackItem(metadata, "Amount") || 0);
    const mpesaReceipt =
      callbackItem(metadata, "MpesaReceiptNumber") || "";
    const phone =
      String(callbackItem(metadata, "PhoneNumber") || "");
    const transactionDate =
      String(callbackItem(metadata, "TransactionDate") || "");

    const success = resultCode === 0;

    await supabase
      .from("mpesa_callbacks")
      .insert({
        merchant_request_id: merchantRequestId,
        checkout_request_id: checkoutRequestId,
        result_code: resultCode,
        result_desc: resultDesc,
        amount,
        mpesa_receipt: mpesaReceipt,
        phone,
        transaction_date: transactionDate,
        raw_payload: payload,
        created_at: new Date().toISOString(),
      })
      .then(() => null)
      .catch(() => null);

    const { data: paymentRequest } = await supabase
      .from("payment_requests")
      .select("*")
      .or(
        [
          `checkout_request_id.eq.${checkoutRequestId}`,
          `CheckoutRequestID.eq.${checkoutRequestId}`,
          `merchant_request_id.eq.${merchantRequestId}`,
          `MerchantRequestID.eq.${merchantRequestId}`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const profileId =
      paymentRequest?.profile_id ||
      paymentRequest?.profileId ||
      null;

    const plan =
      paymentRequest?.plan ||
      paymentRequest?.package ||
      "vip";

    let profileName = null;
    let currentExpiry = null;

    if (profileId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stage_name, plan_expires_at, expiry_date")
        .eq("id", profileId)
        .maybeSingle();

      profileName = profile?.stage_name || null;
      currentExpiry =
        profile?.plan_expires_at ||
        profile?.expiry_date ||
        null;
    }

    if (!success) {
      if (paymentRequest?.id) {
        await supabase
          .from("payment_requests")
          .update({
            status: "failed",
            result_code: String(resultCode),
            result_desc: resultDesc,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentRequest.id);
      }

      return json(200, {
        ResultCode: 0,
        ResultDesc: "Callback received",
      });
    }

    await supabase.from("payments").insert({
      profile_id: profileId ? String(profileId) : null,
      profile_name: profileName,
      phone,
      payer_phone: phone,
      amount,
      plan,
      package: plan,
      mpesa_receipt: mpesaReceipt,
      merchant_request_id: merchantRequestId,
      checkout_request_id: checkoutRequestId,
      status: "paid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (paymentRequest?.id) {
      await supabase
        .from("payment_requests")
        .update({
          status: "paid",
          amount,
          phone,
          mpesa_receipt: mpesaReceipt,
          result_code: String(resultCode),
          result_desc: resultDesc,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRequest.id);
    }

    if (profileId) {
      const expiresAt = addDaysISO(currentExpiry, 7);
      const rank = rankFromPlan(plan);
      const boost = boostFromPlan(plan);

      await supabase
        .from("profiles")
        .update({
          approved: true,
          is_expired: false,
          payment_status: "paid",
          plan,
          plan_rank: rank,
          boost_score: boost,
          plan_started_at: new Date().toISOString(),
          plan_expires_at: expiresAt,
          expiry_date: expiresAt,
          last_active: new Date().toISOString(),
        })
        .eq("id", profileId);

      await supabase
        .from("admin_audit_logs")
        .insert({
          action: "mpesa_payment_received",
          admin_name: "M-Pesa Callback",
          profile_id: String(profileId),
          profile_name: profileName,
          details: `KES ${amount} paid. Receipt: ${mpesaReceipt}`,
          created_at: new Date().toISOString(),
        })
        .then(() => null)
        .catch(() => null);
    }

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Payment processed successfully",
    });

  } catch (error) {
    console.log("M-Pesa callback error:", error.message);

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Callback received with internal handling error",
      error: error.message,
    });
  }
};
