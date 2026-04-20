// netlify/functions/renewal-reminder-worker.js

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

function safeString(v) {
  return v == null ? "" : String(v).trim();
}

function normalizePhone(phone) {
  let p = safeString(phone).replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = `254${p.slice(1)}`;
  if (p.startsWith("7") && p.length === 9) p = `254${p}`;
  if (/^2547\d{8}$/.test(p)) return p;
  return null;
}

function planLabel(category) {
  const c = safeString(category).toLowerCase();
  if (c === "signature" || c === "vvip") return "Signature";
  if (c === "vip") return "VIP";
  return "Featured";
}

function planPrice(category) {
  const c = safeString(category).toLowerCase();
  if (c === "signature" || c === "vvip") return 3000;
  if (c === "vip") return 1500;
  return 1000;
}

function formatDateTime(value) {
  if (!value) return "soon";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "soon";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

async function sbSelect(path) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRole = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "GET",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text();
  let data = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(`Failed to parse Supabase GET response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Supabase GET failed: ${text}`);
  }

  return data;
}

async function sbInsert(table, rows) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRole = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });

  const text = await res.text();
  let data = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(`Failed to parse Supabase INSERT response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Supabase INSERT failed: ${text}`);
  }

  return data;
}

async function sbPatch(table, filter, patch) {
  const supabaseUrl = safeString(process.env.SUPABASE_URL);
  const serviceRole = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  const text = await res.text();
  let data = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(`Failed to parse Supabase PATCH response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`Supabase PATCH failed: ${text}`);
  }

  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (!["GET", "POST"].includes(event.httpMethod)) {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = safeString(process.env.SUPABASE_URL);
    const serviceRole = safeString(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!supabaseUrl || !serviceRole) {
      return json(500, {
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const twoDaysAhead = new Date(now);
    twoDaysAhead.setDate(twoDaysAhead.getDate() + 2);
    const twoDaysAheadIso = twoDaysAhead.toISOString();

    // 1) find active paid profiles expiring within 48h
    const expiringProfiles = await sbSelect(
      [
        "profiles",
        "select=id,stage_name,phone,whatsapp,category,expires_at,is_active,payment_status",
        "is_active=eq.true",
        "payment_status=eq.paid",
        `expires_at=gte.${encodeURIComponent(nowIso)}`,
        `expires_at=lte.${encodeURIComponent(twoDaysAheadIso)}`,
        "order=expires_at.asc",
      ].join("?").replace("?select", "?select").replaceAll("?", "&").replace("&select", "?select")
    );

    // 2) find already queued reminders so we don't duplicate
    const queuedRecent = await sbSelect(
      [
        "whatsapp_queue",
        "select=id,profile_id,template,status,scheduled_for",
        "template=eq.renewal_reminder",
        `scheduled_for=gte.${encodeURIComponent(nowIso.slice(0, 10) + "T00:00:00.000Z")}`,
      ].join("?").replace("?select", "?select").replaceAll("?", "&").replace("&select", "?select")
    );

    const alreadyQueued = new Set(
      queuedRecent
        .filter((r) => r.profile_id != null)
        .map((r) => `${r.profile_id}:renewal_reminder`)
    );

    const rowsToInsert = [];

    for (const profile of expiringProfiles) {
      const phone = normalizePhone(profile.whatsapp || profile.phone);
      if (!phone) continue;

      const dedupeKey = `${profile.id}:renewal_reminder`;
      if (alreadyQueued.has(dedupeKey)) continue;

      const label = planLabel(profile.category);
      const price = planPrice(profile.category);
      const expiryText = formatDateTime(profile.expires_at);
      const name = safeString(profile.stage_name) || "there";

      const message =
        `Hi ${name}, your Nairobi Sweets ${label} listing expires on ${expiryText}. ` +
        `Renew now for KES ${price} to keep your profile live and visible.`;

      rowsToInsert.push({
        profile_id: profile.id,
        phone,
        template: "renewal_reminder",
        message,
        status: "pending",
        scheduled_for: nowIso,
        meta: {
          expires_at: profile.expires_at,
          plan: profile.category,
          price_per_week: price,
        },
      });
    }

    let inserted = [];
    if (rowsToInsert.length) {
      inserted = await sbInsert("whatsapp_queue", rowsToInsert);
    }

    // 3) optionally deactivate profiles already expired
    const expiredProfiles = await sbSelect(
      [
        "profiles",
        "select=id,expires_at,is_active",
        "is_active=eq.true",
        `expires_at=lt.${encodeURIComponent(nowIso)}`,
      ].join("?").replace("?select", "?select").replaceAll("?", "&").replace("&select", "?select")
    );

    let deactivatedCount = 0;
    for (const profile of expiredProfiles) {
      await sbPatch(
        "profiles",
        `id=eq.${encodeURIComponent(profile.id)}`,
        {
          is_active: false,
          updated_at: new Date().toISOString(),
        }
      );
      deactivatedCount += 1;
    }

    return json(200, {
      ok: true,
      expiring_found: expiringProfiles.length,
      reminders_created: inserted.length,
      expired_deactivated: deactivatedCount,
    });
  } catch (error) {
    console.error("renewal-reminder-worker error:", error);
    return json(500, {
      error: "Renewal reminder worker failed",
      details: error.message,
    });
  }
};
