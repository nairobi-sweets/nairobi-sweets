import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const { profile_id } = JSON.parse(event.body);

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        approval_status: 'approved',
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', profile_id);

    if (error) throw error;

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
