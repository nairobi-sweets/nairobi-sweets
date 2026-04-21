import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const { queue_id, profile_id } = JSON.parse(event.body);

  try {
    await supabase
      .from('stk_push_payments')
      .update({ status: 'paid' })
      .eq('id', queue_id);

    await supabase
      .from('profiles')
      .update({
        payment_status: 'paid',
        status: 'active',
        expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString()
      })
      .eq('id', profile_id);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
