const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || "{}");
    const callback = payload.Body?.stkCallback;

    if (!callback) {
      return response(200, { received: true, message: "No stkCallback found" });
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
      if (item.Name === "PhoneNumber") phone = String(item.Value);
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await supabase.from("payments").insert({
      phone,
      amount: amount || 0,
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      receipt_number: receipt,
      result_code: resultCode,
      result_desc: resultDesc,
      status: resultCode === 0 ? "paid" : "failed",
      raw_response: payload
    });

    if (resultCode === 0 && phone) {
      await supabase
        .from("profiles")
        .update({
          payment_status: "paid",
          approved: true,
          status: "approved",
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .or(`phone.eq.${phone},phone_number.eq.${phone},whatsapp.eq.${phone}`);
    }

    return response(200, { received: true });

  } catch (error) {
    return response(500, { error: error.message });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
