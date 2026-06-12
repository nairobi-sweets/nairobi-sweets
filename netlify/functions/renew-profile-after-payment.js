const { createClient } = require('@supabase/supabase-js');

const PLAN_DAYS = new Set([3, 7, 15, 30]);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = JSON.parse(event.body || '{}');
    const profileId = body.profile_id;
    const durationDays = Number(body.duration_days || 30);
    const amountPaid = Number(body.amount_paid || body.amount || 0);
    const receipt = body.receipt || body.mpesa_receipt || null;

    if (!profileId) throw new Error('profile_id is required');
    if (!PLAN_DAYS.has(durationDays)) throw new Error('duration_days must be 3, 7, 15, or 30');

    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + durationDays);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        approved: true,
        online: true,
        is_expired: false,
        trial_active: false,
        payment_status: 'paid',
        plan_status: 'active',
        amount_paid: amountPaid,
        duration_days: durationDays,
        expiry_date: expiry.toISOString(),
        expires_at: expiry.toISOString(),
        last_payment_receipt: receipt,
        last_paid_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', profileId)
      .select('id,stage_name,expiry_date,expires_at,payment_status,plan_status')
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, profile: data })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
