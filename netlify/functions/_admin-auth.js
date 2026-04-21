const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

async function getUserFromJwt(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  if (!auth.startsWith("Bearer ")) {
    throw Object.assign(new Error("Missing bearer token"), { statusCode: 401 });
  }

  const token = auth.slice("Bearer ".length).trim();

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw Object.assign(new Error("Invalid session"), { statusCode: 401 });
  }

  return await res.json();
}

async function assertAdmin(userId) {
  const url =
    `${SUPABASE_URL}/rest/v1/admin_users` +
    `?select=user_id,role,is_active` +
    `&user_id=eq.${encodeURIComponent(userId)}` +
    `&is_active=eq.true&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw Object.assign(new Error(`Admin lookup failed: ${text}`), { statusCode: 500 });
  }

  const rows = JSON.parse(text || "[]");
  if (!rows.length) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  return rows[0];
}

async function requireAdmin(event) {
  const user = await getUserFromJwt(event);
  const admin = await assertAdmin(user.id);
  return { user, admin };
}

module.exports = { json, requireAdmin };
