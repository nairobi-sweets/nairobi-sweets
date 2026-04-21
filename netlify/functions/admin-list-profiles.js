const { safeString, json, requirePermission } = require("./_adminAuth");

function safeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requirePermission(event, "profiles.read");
    if (!auth.ok) return auth.response;

    const { adminClient, adminRow } = auth;

    const body = JSON.parse(event.body || "{}");

    const tableName = safeString(body.tableName) || "profiles";
    const limit = Math.min(safeNumber(body.limit, 200), 1000);
    const page = Math.max(safeNumber(body.page, 1), 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const search = safeString(body.search);
    const planFilter = safeString(body.planFilter).toLowerCase();
    const statusFilter = safeString(body.statusFilter).toLowerCase();
    const sortBy = safeString(body.sortBy) || "created_at";
    const sortDirection = safeString(body.sortDirection).toLowerCase() === "asc";

    let query = adminClient
      .from(tableName)
      .select("*", { count: "exact" });

    if (search) {
      const q = `%${search}%`;
      query = query.or(
        [
          `stage_name.ilike.${q}`,
          `full_name.ilike.${q}`,
          `name.ilike.${q}`,
          `email.ilike.${q}`,
          `contact_email.ilike.${q}`,
          `user_email.ilike.${q}`,
          `phone.ilike.${q}`,
          `phone_number.ilike.${q}`,
          `whatsapp.ilike.${q}`,
          `mobile.ilike.${q}`,
          `location.ilike.${q}`,
          `city.ilike.${q}`,
          `area.ilike.${q}`,
          `town.ilike.${q}`,
          `payment_status.ilike.${q}`,
          `status.ilike.${q}`,
          `plan.ilike.${q}`,
          `pricing_plan.ilike.${q}`,
          `package.ilike.${q}`,
          `package_name.ilike.${q}`,
          `tier.ilike.${q}`,
          `membership_plan.ilike.${q}`
        ].join(",")
      );
    }

    if (planFilter) {
      if (planFilter === "signature") {
        query = query.or("plan.ilike.%signature%,pricing_plan.ilike.%signature%,package.ilike.%signature%,package_name.ilike.%signature%,tier.ilike.%signature%,membership_plan.ilike.%signature%,plan.ilike.%vvip%,pricing_plan.ilike.%vvip%,package.ilike.%vvip%,package_name.ilike.%vvip%,tier.ilike.%vvip%,membership_plan.ilike.%vvip%,plan.ilike.%premium%,pricing_plan.ilike.%premium%,package.ilike.%premium%,package_name.ilike.%premium%,tier.ilike.%premium%,membership_plan.ilike.%premium%");
      } else if (planFilter === "vip") {
        query = query.or("plan.ilike.%vip%,pricing_plan.ilike.%vip%,package.ilike.%vip%,package_name.ilike.%vip%,tier.ilike.%vip%,membership_plan.ilike.%vip%");
      } else if (planFilter === "featured") {
        query = query.or("plan.ilike.%featured%,pricing_plan.ilike.%featured%,package.ilike.%featured%,package_name.ilike.%featured%,tier.ilike.%featured%,membership_plan.ilike.%featured%");
      }
    }

    if (statusFilter) {
      if (statusFilter === "approved") {
        query = query.or("payment_status.in.(approved,paid,success,successful,completed,active,confirmed),status.in.(approved,paid,success,successful,completed,active,confirmed),approval_status.in.(approved,paid,success,successful,completed,active,confirmed)");
      } else if (statusFilter === "pending") {
        query = query.or("payment_status.in.(pending,processing,awaiting,initiated,queued),status.in.(pending,processing,awaiting,initiated,queued),approval_status.in.(pending,processing,awaiting,initiated,queued)");
      } else if (statusFilter === "failed") {
        query = query.or("payment_status.in.(failed,cancelled,canceled,declined,unpaid,expired),status.in.(failed,cancelled,canceled,declined,unpaid,expired),approval_status.in.(failed,cancelled,canceled,declined,unpaid,expired)");
      }
    }

    const { data, count, error } = await query
      .order(sortBy, { ascending: sortDirection, nullsFirst: false })
      .range(from, to);

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, {
      ok: true,
      profiles: Array.isArray(data) ? data : [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.max(Math.ceil((count || 0) / limit), 1),
      },
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
