// netlify/functions/mpesa-callback.js

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

function normalizePhone(phone) {
  if (!phone) return null;

  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = `254${p.slice(1)}`;
  if (p.startsWith("7") && p.length === 9) p = `254${p}`;
  if (/^2547\d{8}$/.test(p)) return p;

  return p || null;
}

function planFlags(plan) {
  const clean = safeString(plan).toLowerCase();

  if (clean === "signature" || clean === "vvip") {
    return {
      category: "signature",
      is_featured: true,
      is_vip: true,
      is_vvip: true,
      price_per_week: 3000,
    };
  }

  if (clean === "vip") {
    return {
      category: "vip",
      is_featured: true,
      is_vip: true,
      is_vvip: false,
      price_per_week: 1500,
    };
  }

  return {
    category: "featured",
    is_featured: true,
    is_vip: false,
    is_vvip: false,
    price_per_week: 1000,
  };
}

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function buildFilterValue(value) {
  if (value == null) return null;

  const stringy = String(value).trim();
  if (stringy === "") return null;

  // UUIDs, ints, strings all pass through here safely enough for eq filters
  return encodeURIComponent(stringy);
}

async function supabaseSelectOne(table, matchColumn, matchValue, select = "*") {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const encodedValue = buildFilterValue(matchValue);
  if (encodedValue == null) {
    throw new Error(`Missing filter value for ${table}.${matchColumn}`);
  }

  const url =
    `${supabaseUrl}/rest/v1/${table}` +
    `?select=${encodeURIComponent(select)}` +
    `&${encodeURIComponent(matchColumn)}=eq.${encodedValue}` +
    `&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Supabase SELECT failed for ${table}: ${text}`);
  }

  return Array.isArray(data) ? data[0] ?? null : null;
}

async function supabasePatch(table, matchColumn, matchValue, patch) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const encodedValue = buildFilterValue(matchValue);
  if (encodedValue == null) {
    throw new Error(`Missing filter value for ${table}.${matchColumn}`);
  }

  const url =
    `${supabaseUrl}/rest/v1/${table}` +
    `?${encodeURIComponent(matchColumn)}=eq.${encodedValue}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Supabase PATCH failed for ${table}: ${text}`);
  }

  return data;
}

async function supabaseInsert(table, row) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const url = `${supabaseUrl}/rest/v1/${table}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Supabase INSERT failed for ${table}: ${text}`);
  }

  return data;
}

async function insertWhatsAppQueue(row) {
  return supabaseInsert("whatsapp_queue", row);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const stkCallback = body?.Body?.stkCallback;

    if (!stkCallback) {
      return json(400, {
        error: "Invalid callback payload",
        received: body,
      });
    }

    const merchantRequestID = stkCallback.MerchantRequestID || null;
    const checkoutRequestID = stkCallback.CheckoutRequestID || null;
    const resultCode = Number(stkCallback.ResultCode ?? -1);
    const resultDesc = stkCallback.ResultDesc || "";
    const metadata = stkCallback.CallbackMetadata?.Item || [];

    const amount = findMetadataValue(metadata, "Amount");
    const mpesaReceiptNumber = findMetadataValue(metadata, "MpesaReceiptNumber");
    const transactionDate = findMetadataValue(metadata, "TransactionDate");
    const phoneNumberRaw = findMetadataValue(metadata, "PhoneNumber");
    const phoneNumber = normalizePhone(phoneNumberRaw);

    if (!checkoutRequestID) {
      return json(400, {
        error: "Missing CheckoutRequestID",
        stkCallback,
      });
    }

    const payment = await supabaseSelectOne(
      "stk_push_payments",
      "checkout_request_id",
      checkoutRequestID,
      "*"
    );

    if (!payment) {
      return json(404, {
        error: "Payment row not found for CheckoutRequestID",
        checkoutRequestID,
      });
    }

    const nowIso = new Date().toISOString();

    const paymentPatch = {
      merchant_request_id: merchantRequestID,
      checkout_request_id: checkoutRequestID,
      result_code: resultCode,
      result_desc: resultDesc,
      amount: amount != null ? Number(amount) : payment.amount ?? null,
      phone: phoneNumber || payment.phone || null,
      mpesa_receipt_number: mpesaReceiptNumber ?? null,
      transaction_date: transactionDate ? String(transactionDate) : null,
      paid_at: resultCode === 0 ? nowIso : null,
      callback_payload: body,
      response_payload: body,
      callback_received_at: nowIso,
      status: resultCode === 0 ? "paid" : "failed",
      updated_at: nowIso,
    };

    await supabasePatch(
      "stk_push_payments",
      "checkout_request_id",
      checkoutRequestID,
      paymentPatch
    );

    if (resultCode === 0 && payment.profile_id) {
      const flags = planFlags(payment.plan);
      const finalAmount = Number(amount ?? flags.price_per_week);

      const profilePatch = {
        is_active: true,
        payment_status: "paid",
        last_payment_at: nowIso,
        expires_at: addDaysIso(7),
        is_featured: flags.is_featured,
        is_vip: flags.is_vip,
        is_vvip: flags.is_vvip,
        category: flags.category,
        price_per_week: Number.isFinite(finalAmount) ? finalAmount : flags.price_per_week,
        updated_at: nowIso,
      };

      await supabasePatch("profiles", "id", payment.profile_id, profilePatch);

      try {
        const targetPhone = phoneNumber || payment.phone || null;

        if (targetPhone) {
          await insertWhatsAppQueue({
            profile_id: payment.profile_id,
            phone: targetPhone,
            template: "payment_success",
            message:
              `Payment received successfully. Your Nairobi Sweets ${flags.category} plan is now active. ` +
              `Amount: KES ${Number.isFinite(finalAmount) ? finalAmount : flags.price_per_week}. ` +
              `Your listing is live until ${profilePatch.expires_at}.`,
            status: "pending",
            scheduled_for: nowIso,
            meta: {
              checkout_request_id: checkoutRequestID,
              mpesa_receipt_number: mpesaReceiptNumber ?? null,
              plan: flags.category,
              amount: Number.isFinite(finalAmount) ? finalAmount : flags.price_per_week,
            },
          });
        }
      } catch (queueErr) {
        console.error("Failed to queue payment success WhatsApp:", queueErr);
      }
    }

    if (resultCode !== 0 && payment.profile_id) {
      await supabasePatch("profiles", "id", payment.profile_id, {
        payment_status: "failed",
        updated_at: nowIso,
      });

      try {
        const targetPhone = phoneNumber || payment.phone || null;

        if (targetPhone) {
          await insertWhatsAppQueue({
            profile_id: payment.profile_id,
            phone: targetPhone,
            template: "payment_failed",
            message:
              "Your Nairobi Sweets payment was not completed. Please try again to activate your listing.",
            status: "pending",
            scheduled_for: nowIso,
            meta: {
              checkout_request_id: checkoutRequestID,
              result_code: resultCode,
              result_desc: resultDesc,
            },
          });
        }
      } catch (queueErr) {
        console.error("Failed to queue payment failed WhatsApp:", queueErr);
      }
    }

    return json(200, {
      ok: true,
      checkoutRequestID,
      resultCode,
      resultDesc,
      autoActivated: resultCode === 0 && !!payment.profile_id,
    });
  } catch (error) {
    console.error("M-Pesa callback error:", error);

    return json(500, {
      error: "Callback processing failed",
      details: error.message,
    });
  }
};
