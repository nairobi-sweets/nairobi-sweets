const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function planDays(plan) {
  return 7;
}

function planRank(plan) {
  const p = String(plan || "").toLowerCase();
  if (p.includes("signature") || p.includes("vvip")) return 4;
  if (p.includes("vip")) return 3;
  if (p.includes("featured")) return 2;
  return 1;
}

function boostScore(plan) {
  const p = String(plan || "").toLowerCase();
  if (p.includes("signature") || p.includes("vvip")) return 600;
  if (p.includes("vip")) return 300;
  if (p.includes("featured")) return 100;
  return 0;
}

exports.handler = async function (event) {
  try {
    const body = JSON.parse(event.body || "{}");
    console.log("M-Pesa Callback:", JSON.stringify(body));

    const stkCallback = body.Body?.stkCallback;

    if (!stkCallback) {
      return json(200, {
        ResultCode: 0,
        ResultDesc: "Ignored empty callback"
      });
    }

    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const merchantRequestID = stkCallback.MerchantRequestID;
    const resultCode = Number(stkCallback.ResultCode);
    const resultDesc = stkCallback.ResultDesc || "";

    const items = stkCallback.CallbackMetadata?.Item || [];

    const amount = items.find((i) => i.Name === "Amount")?.Value || 0;
    const mpesaReceipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value || null;
    const phone = items.find((i) => i.Name === "PhoneNumber")?.Value || null;
    const transactionDate = items.find((i) => i.Name === "TransactionDate")?.Value || null;

    const status = resultCode === 0 ? "paid" : "failed";
    const now = new Date().toISOString();

    const { data: payments, error: paymentError } = await supabase
      .from("payments")
      .update({
        status,
        amount,
        phone: phone ? String(phone) : null,
        payer_phone: phone ? String(phone) : null,
        merchant_request_id: merchantRequestID,
        checkout_request_id: checkoutRequestID,
        mpesa_receipt: mpesaReceipt,
        mpesa_receipt_number: mpesaReceipt,
        transaction_code: mpesaReceipt,
        transaction_date: transactionDate ? String(transactionDate) : null,
        result_code: resultCode,
        result_desc: resultDesc,
        raw_callback: body,
        paid_at: resultCode === 0 ? now : null,
        updated_at: now
      })
      .eq("checkout_request_id", checkoutRequestID)
      .select();

    if (paymentError) {
      console.log("Payment update error:", paymentError);
      return json(200, {
        ResultCode: 0,
        ResultDesc: "Callback received but payment update failed"
      });
    }

    const payment = payments?.[0];

    if (!payment) {
      console.log("No matching payment row for:", checkoutRequestID);
      return json(200, {
        ResultCode: 0,
        ResultDesc: "Callback received but no matching payment row"
      });
    }

    if (resultCode === 0 && payment.profile_id) {
      const { data: profile, error: profileFetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", payment.profile_id)
        .single();

      if (profileFetchError) {
        console.log("Profile fetch error:", profileFetchError);
      } else {
        const plan =
          payment.plan ||
          payment.package ||
          profile.plan ||
          profile.package ||
          "featured";

        const baseDate =
          profile.plan_expires_at && new Date(profile.plan_expires_at) > new Date()
            ? profile.plan_expires_at
            : now;

        const expiresAt = addDays(baseDate, planDays(plan));
        const rank = planRank(plan);
        const boost = boostScore(plan);

        const views = Number(profile.views_count || profile.views || 0);
        const likes = Number(profile.likes_count || profile.likes || 0);

        const trending =
          boost +
          views * 2 +
          likes * 5 +
          rank * 50 +
          (profile.verified ? 80 : 0) +
          (profile.featured ? 60 : 0);

        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            approved: true,
            is_expired: false,
            payment_status: "paid",

            plan,
            plan_rank: rank,
            boost_score: boost,
            trending_score: trending,

            paid_at: now,
            plan_started_at: profile.plan_started_at || now,
            plan_expires_at: expiresAt,
            expiry_date: expiresAt,
            last_active: now
          })
          .eq("id", payment.profile_id);

        if (profileError) {
          console.log("Profile update error:", profileError);
        }
      }
    }

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Callback processed successfully"
    });
  } catch (error) {
    console.log("Callback fatal error:", error);

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Callback received with internal handling error"
    });
  }
};
