import { Navigate } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { ReadOnlyProvider } from "@/components/admin/ReadOnlyContext";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminSectionKey } from "@/lib/admin/sections";

/**
 * Wraps an admin route. Blocks rendering when the current admin user doesn't
 * have at least `view` access to `section`. When access is `view`, the wrapped
 * children render inside a ReadOnlyProvider so action buttons can self-disable.
 */
export function SectionGate({
  section,
  children,
}: {
  section: AdminSectionKey;
  children: React.ReactNode;
}) {
  const { loading, getAccess } = useAdminPermissions();
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const access = getAccess(section);
  if (access === "hidden") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <ShieldOff className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">No access to this section</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Your administrator hasn't granted you access to this part of the console.
          Contact a super admin if you believe this is a mistake.
        </p>
      </div>
    );
  }
  return <ReadOnlyProvider readOnly={access === "view"}>{children}</ReadOnlyProvider>;
}

/** Fallback route component for users with no permissions at all. */
export function SectionGateRedirectHome() {
  return <Navigate to="/admin" replace />;
}

/**
 * Restricts a route to super admins only. Non-super-admins are redirected
 * to /admin. Used for User Management which must never be visible to regular
 * admins regardless of their section permissions.
 */
export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const { loading, isSuperAdmin } = useAdminPermissions();
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
