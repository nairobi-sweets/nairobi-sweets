const { safeString, json, requireAdmin } = require("./_adminAuth");

const PLAN_PRICES = {
  featured: 1000,
  vip: 1500,
  signature: 3000,
};

function normalizePlan(profile) {
  const raw = safeString(
    profile.plan ||
    profile.pricing_plan ||
    profile.package ||
    profile.package_name ||
    profile.tier ||
    profile.membership_plan
  ).toLowerCase();

  if (!raw) return "featured";
  if (raw.includes("signature") || raw.includes("vvip") || raw.includes("premium")) return "signature";
  if (raw.includes("vip")) return "vip";
  if (raw.includes("featured")) return "featured";
  return "featured";
}

function normalizeStatus(profile) {
  const raw = safeString(
    profile.payment_status ||
    profile.status ||
    profile.payment ||
    profile.paymentState ||
    profile.approval_status
  ).toLowerCase();

  if (["paid", "success", "successful", "approved", "completed", "active", "confirmed"].includes(raw)) {
    return "approved";
  }

  if (["pending", "processing", "awaiting", "initiated", "queued"].includes(raw)) {
    return "pending";
  }

  if (["failed", "cancelled", "canceled", "declined", "unpaid", "expired"].includes(raw)) {
    return "failed";
  }

  return raw || "pending";
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requireAdmin(event);
    if (!auth.ok) return auth.response;

    const { adminClient } = auth;
    const body = JSON.parse(event.body || "{}");
    const tableName = safeString(body.tableName) || "profiles";

    const { data, error } = await adminClient
      .from(tableName)
      .select("*");

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    const rows = Array.isArray(data) ? data : [];

    const totalProfiles = rows.length;
    const approvedProfiles = rows.filter((p) => normalizeStatus(p) === "approved");
    const pendingProfiles = rows.filter((p) => normalizeStatus(p) === "pending");
    const failedProfiles = rows.filter((p) => normalizeStatus(p) === "failed");

    const featuredProfiles = rows.filter((p) => normalizePlan(p) === "featured");
    const vipProfiles = rows.filter((p) => normalizePlan(p) === "vip");
    const signatureProfiles = rows.filter((p) => normalizePlan(p) === "signature");

    const approvedFeatured = approvedProfiles.filter((p) => normalizePlan(p) === "featured");
    const approvedVip = approvedProfiles.filter((p) => normalizePlan(p) === "vip");
    const approvedSignature = approvedProfiles.filter((p) => normalizePlan(p) === "signature");

    const weeklyRevenue =
      approvedFeatured.length * PLAN_PRICES.featured +
      approvedVip.length * PLAN_PRICES.vip +
      approvedSignature.length * PLAN_PRICES.signature;

    const monthlyRevenue = weeklyRevenue * 4;

    return json(200, {
      ok: true,
      stats: {
        totalProfiles,
        approvedCount: approvedProfiles.length,
        pendingCount: pendingProfiles.length,
        failedCount: failedProfiles.length,
        featuredCount: featuredProfiles.length,
        vipCount: vipProfiles.length,
        signatureCount: signatureProfiles.length,
        weeklyRevenue,
        monthlyRevenue,
        revenueByPlan: {
          featured: {
            count: approvedFeatured.length,
            weeklyRevenue: approvedFeatured.length * PLAN_PRICES.featured,
          },
          vip: {
            count: approvedVip.length,
            weeklyRevenue: approvedVip.length * PLAN_PRICES.vip,
          },
          signature: {
            count: approvedSignature.length,
            weeklyRevenue: approvedSignature.length * PLAN_PRICES.signature,
          },
        },
      },
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Unexpected server error",
    });
  }
};
