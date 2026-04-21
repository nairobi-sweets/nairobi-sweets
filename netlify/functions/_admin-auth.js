function assertValidRole(role) {
  const normalized = normalizeRole(role);
  if (!normalized) {
    throw new Error("Invalid role. Allowed roles: viewer, admin, super_admin");
  }
  return normalized;
}

function canAssignRole(actorRole, targetRole) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);

  if (!actor || !target) return false;

  if (actor !== "super_admin") return false;

  return ["viewer", "admin", "super_admin"].includes(target);
}
