import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  canAccessBre,
  isReadOnlyBre,
  normalizeBrePermission,
} from "@/lib/bre/permissions";

/**
 * Route-level access control for /admin/bre/*.
 *
 * Enforces three layers:
 *   1. Authenticated  → otherwise → /admin/login
 *   2. Admin role     → otherwise → / (with toast)
 *   3. bre_permission ≠ 'none' → otherwise → /admin (with toast)
 *
 * The sidebar BRE group is hidden for users without access, but this gate
 * is the *real* enforcement — typing the URL directly must be blocked.
 */
export function BreAccessGate({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading } = useAuth();
  const location = useLocation();
  const toastedRef = useRef(false);

  const role = appUser?.role;
  const perm = normalizeBrePermission(appUser?.bre_permission);
  const allowed = canAccessBre(role, perm);
  const readOnly = isReadOnlyBre(role, perm);

  useEffect(() => {
    if (loading || !user || !appUser || allowed || toastedRef.current) return;
    toastedRef.current = true;
    if (role !== "admin" && role !== "super_admin") {
      toast({
        title: "Admin access required",
        description: "BRE Engine is restricted to admin users.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "BRE access required",
        description: "Your account does not have BRE permission. Contact a super admin.",
        variant: "destructive",
      });
    }
  }, [loading, user, appUser, allowed, role]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (!appUser) {
    // Authenticated but no app user row — kick to partner home (existing behaviour).
    return <Navigate to="/" replace />;
  }

  if (role !== "admin" && role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  if (!allowed) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="space-y-4" data-bre-readonly={readOnly ? "true" : "false"}>
      {readOnly && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Read-only mode — your BRE permission is <strong>read</strong>. Editing actions are disabled.
        </div>
      )}
      {children}
    </div>
  );
}
