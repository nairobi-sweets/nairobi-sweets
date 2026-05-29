const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ok: false,
          message: "Method not allowed"
        })
      };
    }

    const SUPABASE_URL =
      process.env.SUPABASE_URL;

    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          message:
            "Missing Supabase environment variables"
        })
      };
    }

    const sb = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    const body = JSON.parse(
      event.body || "{}"
    );

    const {
      action,
      admin_name,
      profile_id,
      profile_name,
      details
    } = body;

    const forwarded =
      event.headers["x-forwarded-for"] ||
      event.headers["client-ip"] ||
      "";

    const ip =
      String(forwarded)
        .split(",")[0]
        .trim();

    const userAgent =
      event.headers["user-agent"] || "";

    const { error } =
      await sb
        .from("admin_audit_logs")
        .insert({
          action: action || "unknown",
          admin_name:
            admin_name || "Vault Admin",
          profile_id:
            profile_id || null,
          profile_name:
            profile_name || null,
          details:
            details || null,
          ip_address: ip,
          user_agent: userAgent,
          created_at:
            new Date().toISOString()
        });

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          message: error.message
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        ok: true,
        message: "Audit log saved"
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        ok: false,
        message: error.message
      })
    };

  }
};
