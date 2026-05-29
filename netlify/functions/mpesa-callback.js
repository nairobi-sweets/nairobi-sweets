const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function addDaysISO(baseDate, days = 7) {
  const base = baseDate ? new Date(baseDate) : new Date();
  const d = Number.isNaN(base.getTime()) ? new Date() : base;

  if (d < new Date()) {
    d.setTime(Date.now());
  }

  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function getCallbackItem(items, name) {
  const found = (items || []).find((item) => item.Name === name);
  return found ? found.Value : null;
}

function planRank(plan) {
  const p = String(plan || "").toLowerCase();
  if (p.includes("signature") || p.includes("vvip")) return 4;
  if (p.includes("vip")) return 3;
  if (p.includes("featured")) return 2;
  return 1;
}

function planBoost(plan) {
  const p = String(plan || "").toLowerCase();
  if (p.includes("signature") || p.includes("vvip")) return 600;
  if (p.includes("vip")) return 300;
  if (p.includes("featured")) return 100;
  return 0;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({
          ResultCode: 1,
          ResultDesc: "Method not allowed"
        })
      };
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ResultCode: 1,
          ResultDesc: "Missing Supabase environment variables"
        })
      };
    }

    const payload = JSON.parse(event.body || "{}");

    const stk =
      payload.Body &&
      payload.Body.stkCallback
        ? payload.Body.stkCallback
        : {};

    const merchantRequestId = stk.MerchantRequestID || "";
    const checkoutRequestId = stk.CheckoutRequestID || "";
    const resultCode = Number(stk.ResultCode);
    const resultDesc = stk.ResultDesc || "";

    const metadata =
      stk.CallbackMetadata &&
      Array.isArray(stk.CallbackMetadata.Item)
        ? stk.CallbackMetadata.Item
        : [];

    const amount = Number(getCallbackItem(metadata, "Amount") || 0);
    const mpesaReceipt = getCallbackItem(metadata, "MpesaReceiptNumber") || "";
    const phone = String(getCallbackItem(metadata, "PhoneNumber") || "");
    const transactionDate = String(getCallbackItem(metadata, "TransactionDate") || "");

    const success = resultCode === 0;

    const { data: paymentRequest } = await sb
      .from("payment_requests")
      .select("*")
      .or(
        `checkout_request_id.eq.${checkoutRequestId},CheckoutRequestID.eq.${checkoutRequestId},merchant_request_id.eq.${merchantRequestId}`
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const profileId =
      paymentRequest?.profile_id ||
      paymentRequest?.profileId ||
      paymentRequest?.profile ||
      null;

    const plan =
      paymentRequest?.plan ||
      paymentRequest?.package ||
      "vip";

    let profileName = null;
    let currentExpiry = null;

    if (profileId) {
      const { data: profile } = await sb
        .from("profiles")
        .select("stage_name, plan_expires_at, expiry_date")
        .eq("id", profileId)
        .maybeSingle();

      profileName = profile?.stage_name || null;
      currentExpiry = profile?.plan_expires_at || profile?.expiry_date || null;
    }

    await sb.from("mpesa_callbacks").insert({
      merchant_request_id: merchantRequestId,
      checkout_request_id: checkoutRequestId,
      result_code: resultCode,
      result_desc: resultDesc,
      amount,
      mpesa_receipt: mpesaReceipt,
      phone,
      raw_payload: payload,
      created_at: new Date().toISOString()
    }).catch(() => null);

    if (!success) {
      if (paymentRequest?.id) {
        await sb
          .from("payment_requests")
          .update({
            status: "failed",
            result_code: resultCode,
            result_desc: resultDesc,
            updated_at: new Date().toISOString()
          })
          .eq("id", paymentRequest.id);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          ResultCode: 0,
          ResultDesc: "Callback received"
        })
      };
    }

    await sb.from("payments").insert({
      profile_id: profileId ? String(profileId) : null,
      profile_name: profileName,
      phone,
      amount,
      plan,
      mpesa_receipt: mpesaReceipt,
      status: "paid",
      created_at: new Date().toISOString()
    });

    if (paymentRequest?.id) {
      await sb
        .from("payment_requests")
        .update({
          status: "paid",
          amount,
          mpesa_receipt: mpesaReceipt,
          phone,
          result_code: resultCode,
          result_desc: resultDesc,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", paymentRequest.id);
    }

    if (profileId) {
      const expiresAt = addDaysISO(currentExpiry, 7);
      const rank = planRank(plan);
      const boost = planBoost(plan);

      await sb
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
          last_active: new Date().toISOString()
        })
        .eq("id", profileId);

      await sb.from("admin_audit_logs").insert({
        action: "mpesa_payment_received",
        admin_name: "M-Pesa Callback",
        profile_id: String(profileId),
        profile_name: profileName,
        details: `KES ${amount} paid. Receipt: ${mpesaReceipt}`,
        created_at: new Date().toISOString()
      }).catch(() => null);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Payment processed successfully"
      })
    };

  } catch (error) {
    console.error("M-Pesa callback error:", error);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Callback received with internal handling error"
      })
    };
  }
};
