import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function findMetadataValue(items, name) {
  if (!Array.isArray(items)) return null;
  const match = items.find((item) => item && item.Name === name);
  return match ? match.Value ?? null : null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = `254${p.slice(1)}`;
  if (p.startsWith('7') && p.length === 9) p = `254${p}`;
  if (p.startsWith('254') && p.length === 12) return p;
  return p || null;
}

function flagsForPlan(plan) {
  const clean = String(plan || '').toLowerCase();

  return {
    plan: clean,
    is_featured: clean === 'featured' || clean === 'vip' || clean === 'signature' || clean === 'vvip',
    is_vip: clean === 'vip',
    is_vvip: clean === 'signature' || clean === 'vvip'
  };
}

async function markProfilePaid(paymentRow) {
  if (!paymentRow?.profile_id) return;

  const flags = flagsForPlan(paymentRow.plan);

  const patch = {
    payment_status: 'paid',
    status: 'active',
    plan: flags.plan || paymentRow.plan || 'featured',
    category: flags.plan || paymentRow.plan || 'featured',
    is_featured: flags.is_featured,
    is_vip: flags.is_vip,
    is_vvip: flags.is_vvip,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', paymentRow.profile_id);

  if (error) {
    throw new Error(`Failed to update profile after payment: ${error.message}`);
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const callback = payload?.Body?.stkCallback;

    if (!callback) {
      return json(400, { error: 'Invalid callback payload' });
    }

    const checkoutRequestId = callback.CheckoutRequestID || null;
    const merchantRequestId = callback.MerchantRequestID || null;
    const resultCode = Number(callback.ResultCode ?? -1);
    const resultDesc = callback.ResultDesc || null;
    const metadata = callback.CallbackMetadata?.Item || [];

    const amount = findMetadataValue(metadata, 'Amount');
    const mpesaReceiptNumber = findMetadataValue(metadata, 'MpesaReceiptNumber');
    const transactionDate = findMetadataValue(metadata, 'TransactionDate');
    const phoneNumberRaw = findMetadataValue(metadata, 'PhoneNumber');
    const phoneNumber = normalizePhone(phoneNumberRaw);

    if (!checkoutRequestId) {
      return json(400, { error: 'CheckoutRequestID missing in callback' });
    }

    const { data: paymentRow, error: lookupError } = await supabase
      .from('stk_push_payments')
      .select('*')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (lookupError || !paymentRow) {
      return json(404, {
        error: 'Matching STK payment row not found',
        checkout_request_id: checkoutRequestId
      });
    }

    const paymentPatch = {
      merchant_request_id: merchantRequestId,
      checkout_request_id: checkoutRequestId,
      result_code: resultCode,
      result_desc: resultDesc,
      mpesa_receipt_number: mpesaReceiptNumber,
      transaction_date: transactionDate ? String(transactionDate) : null,
      phone: phoneNumber || paymentRow.phone || null,
      amount: amount != null ? Number(amount) : paymentRow.amount,
      callback_payload: payload,
      callback_received_at: new Date().toISOString(),
      response_payload: payload,
      status: resultCode === 0 ? 'paid' : 'failed',
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('stk_push_payments')
      .update(paymentPatch)
      .eq('id', paymentRow.id);

    if (updateError) {
      throw new Error(`Failed to update STK payment row: ${updateError.message}`);
    }

    if (resultCode === 0) {
      await markProfilePaid(paymentRow);
    }

    return json(200, {
      ok: true,
      result_code: resultCode,
      checkout_request_id: checkoutRequestId
    });
  } catch (error) {
    return json(500, {
      error: error.message || 'Callback handler failed'
    });
  }
}
