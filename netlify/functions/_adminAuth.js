const { data: adminRow, error: adminError } = await adminClient
  .from("admin_users")
  .select("*")
  .eq("user_id", authUser.id)
  .eq("is_active", true)
  .maybeSingle();

if (adminError) {
  return {
    ok: false,
    response: json(500, { ok: false, error: adminError.message }),
  };
}

if (!adminRow) {
  return {
    ok: false,
    response: json(403, { ok: false, error: "Admin access required" }),
  };
}
