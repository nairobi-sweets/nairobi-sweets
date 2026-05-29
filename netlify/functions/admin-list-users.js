const {
  supabase,
  json,
  getAdminFromRequest
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return json(405, {
        ok: false,
        message: "Method not allowed"
      });
    }

    const auth = await getAdminFromRequest(
      event,
      "staff.manage"
    );

    if (!auth.ok) {
      return auth.response;
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return json(500, {
        ok: false,
        message: error.message
      });
    }

    return json(200, {
      ok: true,
      admin: auth.admin,
      users: data || []
    });

  } catch (error) {
    return json(500, {
      ok: false,
      message: error.message
    });
  }
};
