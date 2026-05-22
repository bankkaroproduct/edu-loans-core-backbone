import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPermissionsProvider } from "@/hooks/useAdminPermissions";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Gate for /admin/* routes (excluding /admin/login).
 * Pure function of `status` + `appUser.role` — never reads `user` alone,
 * never redirects while `initializing`.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { status, appUser } = useAuth();
  const location = useLocation();

  const role = appUser?.role;
  const isAdmin = role === "super_admin" || role === "admin";

  useEffect(() => {
    if (status === "authenticated" && !isAdmin) {
      toast({
        title: "Partner account detected",
        description: "Use the Partner Portal for this account.",
        variant: "destructive",
      });
    }
  }, [status, isAdmin]);

  if (status === "initializing") {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === "anonymous" || status === "unauthorized") {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  // status === "authenticated"
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminPermissionsProvider>
      <AdminLayout>{children}</AdminLayout>
    </AdminPermissionsProvider>
  );
}
