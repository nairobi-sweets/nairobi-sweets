import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  body: JSON.stringify(body)
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: "Method not allowed" });

  try {
    const { ids } = JSON.parse(event.body || '{}');

    if (!Array.isArray(ids) || !ids.length) {
      return json(400, { error: "No IDs provided" });
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .in('id', ids);

    if (error) throw error;

    return json(200, { success: true, deleted: ids.length });

  } catch (err) {
    return json(500, { error: err.message });
  }
}
