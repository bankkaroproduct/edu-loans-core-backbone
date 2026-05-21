import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPermissionsProvider } from "@/hooks/useAdminPermissions";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Gate for /admin/* routes (excluding /admin/login).
 * - Unauthenticated → /admin/login
 * - Authenticated but not admin → / (with toast)
 * - Admin → renders inside the dedicated AdminLayout
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading } = useAuth();
  const location = useLocation();

  const role = appUser?.role;
  const isAdmin = role === "super_admin" || role === "admin";

  useEffect(() => {
    if (!loading && user && appUser && !isAdmin) {
      toast({
        title: "Admin access required",
        description: "You don't have permission to view the Admin Console.",
        variant: "destructive",
      });
    }
  }, [loading, user, appUser, isAdmin]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminPermissionsProvider>
      <AdminLayout>{children}</AdminLayout>
    </AdminPermissionsProvider>
  );
}
