const { safeString, json, requirePermission } = require("./_adminAuth");

function safeNumber(value, fallback = 7) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
    const auth = await requirePermission(event, "profiles.renew");
    if (!auth.ok) return auth.response;

    const { adminClient, authUser, adminRow } = auth;

    const body = JSON.parse(event.body || "{}");
    const profileId = safeString(body.profileId);
    const daysToAdd = safeNumber(body.daysToAdd, 7);
    const tableName = safeString(body.tableName) || "profiles";
    const idColumn = safeString(body.idColumn) || "id";

    if (!profileId) {
      return json(400, { ok: false, error: "profileId is required" });
    }

    const { data: existing, error: existingError } = await adminClient
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
        error: "No expiry column found. Add expires_at or similar.",
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
    if ("renewed_at" in existing) patch.renewed_at = new Date().toISOString();
    if ("renewed_by" in existing) patch.renewed_by = authUser.id;
    if ("last_admin_action_by" in existing) patch.last_admin_action_by = authUser.id;
    if ("last_admin_action_role" in existing) patch.last_admin_action_role = adminRow.role;

    const { data: updated, error: updateError } = await adminClient
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
      expiry_field: expiryField,
      expires_at: updated[expiryField],
      profile: updated,
      currentAdmin: {
        role: adminRow.role,
        permissions: adminRow.permissions
      }
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error",
    });
  }
};
