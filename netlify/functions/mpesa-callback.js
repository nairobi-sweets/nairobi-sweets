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

    console.log("M-Pesa Callback:", JSON.stringify(body));

    const stkCallback = body.Body?.stkCallback;

    if (!stkCallback) {
      return json(400, { error: "Invalid callback payload" });
    }

    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const merchantRequestID = stkCallback.MerchantRequestID;
    const resultCode = Number(stkCallback.ResultCode);
    const resultDesc = stkCallback.ResultDesc || "";

    const items = stkCallback.CallbackMetadata?.Item || [];

    const amount =
      items.find(i => i.Name === "Amount")?.Value || 0;

    const mpesaReceipt =
      items.find(i => i.Name === "MpesaReceiptNumber")?.Value || null;

    const phone =
      items.find(i => i.Name === "PhoneNumber")?.Value || null;

    const transactionDate =
      items.find(i => i.Name === "TransactionDate")?.Value || null;

    const status = resultCode === 0 ? "paid" : "failed";

    const { data: payment, error: paymentError } = await supabase
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
        paid_at: resultCode === 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("checkout_request_id", checkoutRequestID)
      .select()
      .single();

    if (paymentError) {
      console.log("Payment update error:", paymentError);
      return json(500, {
        ResultCode: 1,
        ResultDesc: paymentError.message
      });
    }

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
    console.log("Callback fatal error:", error);

    return json(500, {
      ResultCode: 1,
      ResultDesc: error.message || "Callback processing failed"
    });
  }
};
