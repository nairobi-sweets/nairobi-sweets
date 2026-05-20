const { createClient } = require("@supabase/supabase-js");

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
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

    console.log("M-Pesa Callback:", JSON.stringify(body));

    const callback = body.Body?.stkCallback;

    if (!callback) {
      return json(400, {
        error: "Invalid callback payload"
      });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const merchantRequestId = callback.MerchantRequestID;
    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;

    let mpesaReceipt = null;
    let amount = null;
    let phone = null;
    let transactionDate = null;

    const items = callback.CallbackMetadata?.Item || [];

    for (const item of items) {

      if (item.Name === "MpesaReceiptNumber") {
        mpesaReceipt = item.Value;
      }

      if (item.Name === "Amount") {
        amount = item.Value;
      }

      if (item.Name === "PhoneNumber") {
        phone = item.Value;
      }

      if (item.Name === "TransactionDate") {
        transactionDate = item.Value;
      }
    }

    const status = resultCode === 0
      ? "paid"
      : "failed";

    // UPDATE PAYMENT
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .update({
        merchant_request_id: merchantRequestId,
        result_code: resultCode,
        result_desc: resultDesc,
        mpesa_receipt: mpesaReceipt,
        amount,
        phone,
        status,
        raw_callback: body,
        paid_at: resultCode === 0
          ? new Date().toISOString()
          : null
      })
      .eq("checkout_request_id", checkoutRequestId)
      .select()
      .single();

    if (paymentError) {
      console.log("Payment update error:", paymentError);

      return json(500, {
        error: paymentError.message
      });
    }

    // AUTO APPROVE PROFILE
    if (resultCode === 0 && payment?.profile_id) {

      const expiry = new Date();

      expiry.setDate(expiry.getDate() + 7);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          approved: true,
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          expiry_date: expiry.toISOString()
        })
        .eq("id", payment.profile_id);

      if (profileError) {
        console.log("Profile update error:", profileError);
      }
    }

    return json(200, {
      ResultCode: 0,
      ResultDesc: "Callback processed successfully"
    });

  } catch (error) {

    console.log("Callback Fatal Error:", error);

    return json(500, {
      ResultCode: 1,
      ResultDesc: error.message || "Callback processing failed"
    });
  }
};
