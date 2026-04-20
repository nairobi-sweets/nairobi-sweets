const DEFAULT_TABLE = process.env.MPESA_REQUESTS_TABLE || "stk_push_payments";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  },
  body: JSON.stringify(body),
});

function safeString(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeResult(row) {
  const resultCode =
    row.result_code ??
    row.ResultCode ??
    row.resultCode ??
    null;

  const resultDesc =
    row.result_desc ||
    row.ResultDesc ||
    row.resultDesc ||
    row.customer_message ||
    row.CustomerMessage ||
    row.status_message ||
    "";

  const explicitStatus = safeString(
    row.status ||
    row.payment_status ||
    row.state
  ).toLowerCase();

  if (
    explicitStatus === "success" ||
    explicitStatus === "paid" ||
    explicitStatus === "completed" ||
    resultCode === 0 ||
    resultCode === "0"
  ) {
    return {
      status: "success",
      ResultCode: resultCode ?? 0,
      ResultDesc: resultDesc || "Payment completed successfully.",
    };
  }

  if (
    explicitStatus === "failed" ||
    explicitStatus === "cancelled" ||
    explicitStatus === "declined" ||
    explicitStatus === "timeout" ||
    explicitStatus === "reversed" ||
    resultCode === 1032 ||
    resultCode === "1032" ||
    resultCode === 1037 ||
    resultCode === "1037" ||
    resultCode === 2001 ||
    resultCode === "2001" ||
    resultCode === 1 ||
    resultCode === "1"
  ) {
    return {
      status: "failed",
      ResultCode: resultCode ?? 1,
      ResultDesc: resultDesc || "Payment was not completed.",
    };
  }

  return {
    status: "pending",
    ResultCode: resultCode,
    ResultDesc: resultDesc || "Payment is still pending.",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = safeString(process.env.SUPABASE_URL);
    const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, {
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const checkoutRequestID = safeString(
      event.queryStringParameters?.checkoutRequestID
    );

    if (!checkoutRequestID) {
      return json(400, { error: "Missing checkoutRequestID" });
    }

    const url =
      `${supabaseUrl}/rest/v1/${DEFAULT_TABLE}` +
      `?checkout_request_id=eq.${encodeURIComponent(checkoutRequestID)}` +
      `&select=*` +
      `&order=created_at.desc` +
      `&limit=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    });

    const text = await response.text();
    let rows = [];

    try {
      rows = JSON.parse(text);
    } catch {
      return json(500, {
        error: "Invalid Supabase response",
        raw: text,
      });
    }

    if (!response.ok) {
      return json(response.status, {
        error: "Failed to fetch payment status from Supabase",
        details: rows,
      });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return json(404, {
        status: "pending",
        ResultCode: null,
        ResultDesc: "No payment record found yet. It may still be processing.",
        checkoutRequestID,
      });
    }

    const row = rows[0];
    const normalized = normalizeResult(row);

    return json(200, {
      ...normalized,
      checkoutRequestID:
        row.checkout_request_id ||
        row.checkoutRequestID ||
        checkoutRequestID,
      merchantRequestID:
        row.merchant_request_id ||
        row.merchantRequestID ||
        null,
      amount:
        row.amount ??
        row.Amount ??
        null,
      phone:
        row.phone ||
        row.msisdn ||
        row.phone_number ||
        null,
      receiptNumber:
        row.mpesa_receipt_number ||
        row.receipt_number ||
        row.MpesaReceiptNumber ||
        null,
      rawStatus:
        row.status ||
        row.payment_status ||
        row.state ||
        null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "Internal server error",
    });
  }
};
