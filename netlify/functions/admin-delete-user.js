const {
  supabase,
  json,
  getAdminFromRequest,
  auditAdminAction
} = require("./_adminAuth");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST" && event.httpMethod !== "DELETE") {
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

    const body = JSON.parse(event.body || "{}");

    const userId = String(body.id || body.user_id || "").trim();

    if (!userId) {
      return json(400, {
        ok: false,
        message: "User ID is required"
      });
    }

    const { data: targetUser, error: targetError } = await supabase
      .from("admin_users")
      .select("id,name,email,role,is_active")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      return json(500, {
        ok: false,
        message: targetError.message
      });
    }

    if (!targetUser) {
      return json(404, {
        ok: false,
        message: "Admin user not found"
      });
    }

    if (targetUser.id === auth.admin.id) {
      return json(400, {
        ok: false,
        message: "You cannot delete your own account"
      });
    }

    if (
      targetUser.role === "owner" &&
      auth.admin.role !== "owner"
    ) {
      return json(403, {
        ok: false,
        message: "Only owner can delete owner accounts"
      });
    }

    const { error: sessionError } = await supabase
      .from("admin_sessions")
      .delete()
      .eq("admin_id", userId);

    if (sessionError) {
      return json(500, {
        ok: false,
        message: sessionError.message
      });
    }

    const { error: deleteError } = await supabase
      .from("admin_users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      return json(500, {
        ok: false,
        message: deleteError.message
      });
    }

    await auditAdminAction({
      action: "admin_user_deleted",
      admin: auth.admin,
      details: `Deleted admin user ${targetUser.email}`
    });

    return json(200, {
      ok: true,
      message: "Admin user deleted"
    });

  } catch (error) {
    return json(500, {
      ok: false,
      message: error.message
    });
  }
};
