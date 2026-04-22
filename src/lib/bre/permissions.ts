/**
 * BRE permission helpers.
 *
 * `bre_permission` is a column on `public.users` with values:
 *   - 'full'  → can view + edit + manage versions
 *   - 'edit'  → can view + edit (no destructive admin actions)
 *   - 'read'  → view-only; edit/action controls must be disabled or hidden
 *   - 'none'  → no access; cannot enter any /admin/bre route, sidebar group is hidden
 *
 * Role gating is layered on top: only `admin` and `super_admin` can ever access BRE,
 * regardless of bre_permission.
 */
export type BrePermission = "full" | "edit" | "read" | "none";

export type AppRoleLike = string | null | undefined;

export function isAdminRole(role: AppRoleLike): boolean {
  return role === "admin" || role === "super_admin";
}

export function normalizeBrePermission(value: unknown): BrePermission {
  if (value === "full" || value === "edit" || value === "read" || value === "none") {
    return value;
  }
  return "none";
}

/** Can the user enter any /admin/bre route? Requires admin role AND non-none permission. */
export function canAccessBre(role: AppRoleLike, perm: BrePermission): boolean {
  return isAdminRole(role) && perm !== "none";
}

/** Can the user perform edit / mutating actions inside BRE screens? */
export function canEditBre(role: AppRoleLike, perm: BrePermission): boolean {
  return isAdminRole(role) && (perm === "edit" || perm === "full");
}

/** Read-only mode means: page renders, but edit/action controls must be disabled or hidden. */
export function isReadOnlyBre(role: AppRoleLike, perm: BrePermission): boolean {
  return isAdminRole(role) && perm === "read";
}
