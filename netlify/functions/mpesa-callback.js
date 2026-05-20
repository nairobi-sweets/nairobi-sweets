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

exports.handler = async function(event) {
  try {
    const body = JSON.parse(event.body || "{}");
    const callback = body.Body?.stkCallback;

    if (!callback) {
      return json(400, { error: "Invalid M-Pesa callback" });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const merchantRequestId = callback.MerchantRequestID;
    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;

    let receipt = null;
    let amount = null;
    let phone = null;

    const items = callback.CallbackMetadata?.Item || [];

    for (const item of items) {
      if (item.Name === "MpesaReceiptNumber") receipt = item.Value;
      if (item.Name === "Amount") amount = item.Value;
      if (item.Name === "PhoneNumber") phone = item.Value;
    }

    const status = resultCode === 0 ? "paid" : "failed";

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .update({
        status,
        result_code: resultCode,
        result_desc: resultDesc,
        merchant_request_id: merchantRequestId,
        mpesa_receipt: receipt,
        amount,
        phone,
        raw_callback: body,
        paid_at: resultCode === 0 ? new Date().toISOString() : null
      })
      .eq("checkout_request_id", checkoutRequestId)
      .select()
      .single();

    if (paymentError) throw paymentError;

    if (resultCode === 0 && payment?.profile_id) {
      await supabase
        .from("profiles")
        .update({
          approved: true,
          payment_status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("id", payment.profile_id);
    }

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Callback processed successfully"
    });

  } catch (error) {
    return json(500, {
      ResultCode: 1,
      ResultDesc: error.message
    });
  }
};
