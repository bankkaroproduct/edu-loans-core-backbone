import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { FlaskConical, Plus, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

function SimulationBanner() {
  const { isSimulating, effectivePartnerName } = usePartnerContext();
  if (!isSimulating) return null;
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 flex items-center gap-2 text-xs text-amber-700">
      <FlaskConical className="h-3.5 w-3.5" />
      <span className="font-medium">Admin Test Mode</span>
      <span>— simulating partner: <strong>{effectivePartnerName}</strong>. All partner-scoped actions use this context.</span>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Dashboard-only header content. Rendered INSIDE the existing top white header
 * strip (no extra band added). Activated on the partner dashboard route only.
 */
function DashboardHeaderContent({ fullName }: { fullName: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 items-center justify-between gap-4 min-w-0">
      <div className="min-w-0 truncate">
        <span className="text-sm sm:text-base font-semibold text-foreground">
          {getGreeting()}, {fullName}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={() => navigate("/leads/quick")}>
          <Zap className="mr-1.5 h-4 w-4" /> Add Quick Lead
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/leads/new")}>
          <Plus className="mr-1.5 h-4 w-4" /> Add New Lead
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/bulk-upload")}>
          <Upload className="mr-1.5 h-4 w-4" /> Bulk Upload
        </Button>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, appUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Block admins from rendering inside the partner shell — they belong in /admin/*.
  if (appUser && (appUser.role === "super_admin" || appUser.role === "admin")) {
    return <Navigate to="/admin" replace />;
  }

  // Partner dashboard route only — render greeting + CTA buttons inside the
  // existing white top header strip (no new band inserted).
  const isDashboard = location.pathname === "/";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <SimulationBanner />
          <header className="h-14 flex items-center gap-3 border-b px-4">
            <SidebarTrigger />
            {isDashboard ? (
              <DashboardHeaderContent fullName={appUser?.full_name ?? "User"} />
            ) : (
              <div className="flex-1" />
            )}
            <NotificationBell />
          </header>
          <main className="flex-1 px-4 lg:px-6 py-5">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
