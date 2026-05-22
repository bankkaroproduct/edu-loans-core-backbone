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
  const { status, user, appUser } = useAuth();
  const location = useLocation();

  const profileMatchesSession = !!user && !!appUser && appUser.auth_user_id === user.id;
  const role = profileMatchesSession ? appUser?.role : undefined;
  const isAdmin = role === "super_admin" || role === "admin";

  useEffect(() => {
    if (status === "authenticated" && profileMatchesSession && !isAdmin) {
      toast({
        title: "Partner account detected",
        description: "Use the Partner Portal for this account.",
        variant: "destructive",
      });
    }
  }, [status, profileMatchesSession, isAdmin]);

  if (status === "initializing" || (status === "authenticated" && !profileMatchesSession)) {
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

  // status === "authenticated" && profileMatchesSession
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminPermissionsProvider>
      <AdminLayout>{children}</AdminLayout>
    </AdminPermissionsProvider>
  );
}
