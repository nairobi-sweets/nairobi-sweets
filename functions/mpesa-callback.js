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
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function findCallbackValue(items = [], key) {
  const hit = items.find(item => item.Name === key);
  return hit ? hit.Value ?? null : null;
}

function normalizePhone(phone) {
  if (!phone) return null;

  let p = String(phone).replace(/\D/g, '');

  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('7') && p.length === 9) p = '254' + p;
  if (p.startsWith('254') && p.length === 12) return p;

  return null;
}

async function activateProfileFromPayment(payment) {
  if (!payment?.profile_id) {
    return { ok: false, reason: 'No profile_id on payment row' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, expires_at')
    .eq('id', payment.profile_id)
    .single();

  if (profileError) {
    return { ok: false, reason: profileError.message };
  }

  const now = new Date();
  const base =
    profile?.expires_at && new Date(profile.expires_at) > now
      ? new Date(profile.expires_at)
      : now;

  base.setDate(base.getDate() + 7);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      payment_status: 'paid',
      status: 'active',
      online: true,
      expires_at: base.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.profile_id);

  if (updateError) {
    return { ok: false, reason: updateError.message };
  }

  return { ok: true };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod === 'GET') {
    return json(200, { message: 'Callback received' });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const raw = JSON.parse(event.body || '{}');

    const stkCallback = raw?.Body?.stkCallback;
    if (!stkCallback) {
      return json(400, { error: 'Invalid M-Pesa callback payload' });
    }

    const merchantRequestID = stkCallback.MerchantRequestID || null;
    const checkoutRequestID = stkCallback.CheckoutRequestID || null;
    const resultCode = Number(stkCallback.ResultCode ?? -1);
    const resultDesc = stkCallback.ResultDesc || '';
    const items = stkCallback.CallbackMetadata?.Item || [];

    const amount = findCallbackValue(items, 'Amount');
    const receipt = findCallbackValue(items, 'MpesaReceiptNumber');
    const transactionDate = findCallbackValue(items, 'TransactionDate');
    const phone = normalizePhone(findCallbackValue(items, 'PhoneNumber'));

    console.log('MPESA CALLBACK:', {
      merchantRequestID,
      checkoutRequestID,
      resultCode,
      receipt,
      phone
    });

    let payment = null;
    let paymentError = null;

    if (checkoutRequestID) {
      const lookup = await supabase
        .from('stk_push_payments')
        .select('*')
        .eq('checkout_request_id', checkoutRequestID)
        .maybeSingle();

      payment = lookup.data;
      paymentError = lookup.error;
    }

    if (!payment && merchantRequestID) {
      const lookup = await supabase
        .from('stk_push_payments')
        .select('*')
        .eq('merchant_request_id', merchantRequestID)
        .maybeSingle();

      payment = lookup.data;
      paymentError = lookup.error;
    }

    if (!payment && phone) {
      const lookup = await supabase
        .from('stk_push_payments')
        .select('*')
        .eq('phone', phone)
        .in('status', ['pending', 'queued'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      payment = lookup.data;
      paymentError = lookup.error;
    }

    if (paymentError) {
      return json(500, { error: paymentError.message });
    }

    if (!payment) {
      const { error: insertError } = await supabase
        .from('stk_push_payments')
        .insert({
          phone,
          amount: amount ?? 0,
          status: resultCode === 0 ? 'paid' : 'failed',
          mpesa_receipt_number: receipt,
          merchant_request_id: merchantRequestID,
          checkout_request_id: checkoutRequestID,
          result_code: resultCode,
          result_desc: resultDesc,
          transaction_date: transactionDate ? String(transactionDate) : null,
          callback_payload: raw,
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        return json(500, { error: insertError.message });
      }

      return json(200, {
        ok: true,
        orphan: true,
        message: 'Callback saved, but no matching pending payment row was found.'
      });
    }

    if (payment.status === 'paid') {
      return json(200, {
        ok: true,
        payment_id: payment.id,
        payment_status: 'paid',
        activation: {
          ok: true,
          skipped: true,
          reason: 'already_paid'
        }
      });
    }

    const nextStatus = resultCode === 0 ? 'paid' : 'failed';

    const { error: updatePaymentError } = await supabase
      .from('stk_push_payments')
      .update({
        status: nextStatus,
        mpesa_receipt_number: receipt,
        amount: amount ?? payment.amount ?? 0,
        phone: phone || payment.phone,
        merchant_request_id: merchantRequestID || payment.merchant_request_id,
        checkout_request_id: checkoutRequestID || payment.checkout_request_id,
        result_code: resultCode,
        result_desc: resultDesc,
        transaction_date: transactionDate ? String(transactionDate) : payment.transaction_date,
        callback_payload: raw,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updatePaymentError) {
      return json(500, { error: updatePaymentError.message });
    }

    let activation = { ok: true, skipped: true };

    if (resultCode === 0) {
      activation = await activateProfileFromPayment(payment);
    }

    return json(200, {
      ok: true,
      payment_id: payment.id,
      payment_status: nextStatus,
      activation
    });
  } catch (error) {
    console.error('Callback handler failed:', error);
    return json(500, {
      error: error.message || 'Callback handler failed'
    });
  }
}
