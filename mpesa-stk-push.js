import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const mpesaConsumerKey = process.env.MPESA_CONSUMER_KEY;
const mpesaConsumerSecret = process.env.MPESA_CONSUMER_SECRET;
const mpesaShortcode = process.env.MPESA_SHORTCODE;
const mpesaPasskey = process.env.MPESA_PASSKEY;
const mpesaCallbackUrl = process.env.MPESA_CALLBACK_URL;
const mpesaEnvironment = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
const mpesaInitiatorName = process.env.MPESA_INITIATOR_NAME || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false }
});

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(body)
  };
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = `254${p.slice(1)}`;
  if (p.startsWith('7') && p.length === 9) p = `254${p}`;
  if (p.startsWith('254') && p.length === 12) return p;
  return null;
}

function getMpesaBaseUrl() {
  return mpesaEnvironment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function buildPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

function priceForPlan(plan) {
  switch ((plan || '').toLowerCase()) {
    case 'featured': return 1000;
    case 'vip': return 1500;
    case 'signature':
    case 'vvip': return 3000;
    default: return null;
  }
}

async function getAccessToken() {
  const auth = Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString('base64');
  const res = await fetch(`${getMpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.errorMessage || data.error_description || 'Failed to get M-Pesa access token');
  }

  if (!data.access_token) {
    throw new Error('M-Pesa access token missing');
  }

  return data.access_token;
}

async function getProfile(profileId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error) throw new Error(`Profile lookup failed: ${error.message}`);
  return data;
}

async function insertPendingPayment({ profileId, phone, amount, accountReference, description, plan }) {
  const referenceCode = crypto.randomUUID();

  const { data, error } = await supabase
    .from('stk_push_payments')
    .insert({
      profile_id: profileId,
      phone,
      amount,
      status: 'pending',
      account_reference: accountReference,
      description,
      external_reference: referenceCode,
      plan,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create pending payment row: ${error.message}`);
  return data;
}

async function updatePendingPayment(paymentId, payload) {
  const { error } = await supabase
    .from('stk_push_payments')
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', paymentId);

  if (error) throw new Error(`Failed to update payment row: ${error.message}`);
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

  if (!mpesaConsumerKey || !mpesaConsumerSecret || !mpesaShortcode || !mpesaPasskey || !mpesaCallbackUrl) {
    return json(500, { error: 'Missing required M-Pesa environment variables' });
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const profileId = body.profile_id;
    const rawPhone = body.phone;
    const requestedPlan = String(body.plan || '').trim().toLowerCase();

    if (!profileId) return json(400, { error: 'profile_id is required' });
    if (!rawPhone) return json(400, { error: 'phone is required' });

    const phone = normalizePhone(rawPhone);
    if (!phone) return json(400, { error: 'Invalid Kenyan phone number' });

    const profile = await getProfile(profileId);
    const plan = requestedPlan || String(profile.category || profile.plan || '').toLowerCase();
    const amount = priceForPlan(plan);
    if (!amount) return json(400, { error: 'Invalid or unsupported plan' });

    const accountReference = String(body.account_reference || profile.slug || profile.name || 'NairobiSweets').slice(0, 12);
    const description = String(body.description || `Payment for ${profile.name || 'profile'}`).slice(0, 182);

    const pendingPayment = await insertPendingPayment({
      profileId,
      phone,
      amount,
      accountReference,
      description,
      plan
    });

    const accessToken = await getAccessToken();
    const timestamp = getTimestamp();
    const password = buildPassword(mpesaShortcode, mpesaPasskey, timestamp);

    const stkPayload = {
      BusinessShortCode: mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: mpesaShortcode,
      PhoneNumber: phone,
      CallBackURL: mpesaCallbackUrl,
      AccountReference: accountReference,
      TransactionDesc: description
    };

    const stkRes = await fetch(`${getMpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(stkPayload)
    });

    const stkData = await stkRes.json().catch(() => ({}));

    if (!stkRes.ok || stkData.errorCode) {
      await updatePendingPayment(pendingPayment.id, {
        status: 'failed',
        result_desc: stkData.errorMessage || stkData.errorCode || 'STK push request failed',
        request_payload: stkPayload,
        response_payload: stkData
      });

      return json(502, {
        error: stkData.errorMessage || 'STK push failed',
        details: stkData,
        payment_id: pendingPayment.id
      });
    }

    await updatePendingPayment(pendingPayment.id, {
      merchant_request_id: stkData.MerchantRequestID || null,
      checkout_request_id: stkData.CheckoutRequestID || null,
      result_code: stkData.ResponseCode ? Number(stkData.ResponseCode) : null,
      result_desc: stkData.ResponseDescription || stkData.CustomerMessage || null,
      request_payload: stkPayload,
      response_payload: stkData,
      initiator_name: mpesaInitiatorName || null,
      status: 'pending'
    });

    return json(200, {
      ok: true,
      message: 'STK push sent successfully',
      payment_id: pendingPayment.id,
      merchant_request_id: stkData.MerchantRequestID || null,
      checkout_request_id: stkData.CheckoutRequestID || null,
      customer_message: stkData.CustomerMessage || 'Check your phone and enter M-Pesa PIN.',
      amount,
      plan
    });
  } catch (error) {
    return json(500, {
      error: error.message || 'STK push handler failed'
    });
  }
}
