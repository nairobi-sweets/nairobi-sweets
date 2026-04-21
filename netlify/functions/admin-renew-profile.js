const { createClient } = require("@supabase/supabase-js");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

function safeString(value) {
  return value == null ? "" : String(value).trim();
}

function safeNumber(value, fallback = 7) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getAdminToken(event) {
  const authHeader =
    event.headers.authorization ||
    event.headers.Authorization ||
    "";

  const xAdminToken =
    event.headers["x-admin-token"] ||
    event.headers["X-Admin-Token"] ||
    "";

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return safeString(xAdminToken);
}

function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
}

function resolveExpiryField(record) {
  const candidates = [
    "expires_at",
    "expiry_date",
    "expires_on",
    "plan_expires_at",
    "subscription_expires_at",
    "listing_expires_at",
  ];

  for (const key of candidates) {
    if (record && key in record) return key;
  }

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const adminVaultToken = safeString(process.env.ADMIN_VAULT_TOKEN);
    const suppliedToken = getAdminToken(event);

    if (!adminVaultToken || suppliedToken !== adminVaultToken) {
      return json(401, { ok: false, error: "Unauthorized" });
    }

    const supabaseUrl = safeString(process.env.SUPABASE_URL);
    const serviceRoleKey = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { ok: false, error: "Missing server environment variables" });
    }

    const body = JSON.parse(event.body || "{}");
    const profileId = safeString(body.profileId);
    const daysToAdd = safeNumber(body.daysToAdd, 7);
    const tableName = safeString(body.tableName) || "profiles";
    const idColumn = safeString(body.idColumn) || "id";

    if (!profileId) {
      return json(400, { ok: false, error: "profileId is required" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing, error: existingError } = await supabase
      .from(tableName)
      .select("*")
      .eq(idColumn, profileId)
      .maybeSingle();

    if (existingError) {
      return json(500, { ok: false, error: existingError.message });
    }

    if (!existing) {
      return json(404, { ok: false, error: "Profile not found" });
    }

    const expiryField = resolveExpiryField(existing);
    if (!expiryField) {
      return json(400, {
        ok: false,
        error:
          "No expiry column found. Add one of: expires_at, expiry_date, expires_on, plan_expires_at.",
      });
    }

    const now = new Date();
    const currentExpiry = existing[expiryField] ? new Date(existing[expiryField]) : now;
    const startDate = currentExpiry > now ? currentExpiry : now;
    const nextExpiry = addDays(startDate, daysToAdd).toISOString();

    const patch = {
      [expiryField]: nextExpiry,
    };

    if ("payment_status" in existing) patch.payment_status = "approved";
    else if ("status" in existing) patch.status = "approved";
    else patch.payment_status = "approved";

    if ("approval_status" in existing) patch.approval_status = "approved";
    if ("listing_status" in existing) patch.listing_status = "active";
    if ("is_approved" in existing) patch.is_approved = true;
    if ("updated_at" in existing) patch.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from(tableName)
      .update(patch)
      .eq(idColumn, profileId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      return json(500, { ok: false, error: updateError.message });
    }

    return json(200, {
      ok: true,
      message: "Profile renewed successfully",
      expires_at: updated[expiryField],
      expiry_field: expiryField,
      profile: updated,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error",
    });
  }
};
