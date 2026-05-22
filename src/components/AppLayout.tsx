import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, FlaskConical, Plus, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderSlotProvider, useHeaderSlot } from "@/components/layout/HeaderSlotContext";
import { cn } from "@/lib/utils";

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

function AppShell({ children, isDashboard, fullName }: { children: ReactNode; isDashboard: boolean; fullName: string }) {
  const { headerContent, hideSidebarTrigger, backTo } = useHeaderSlot();
  const navigate = useNavigate();
  const slotActive = !!headerContent || hideSidebarTrigger;

  return (
    <div className="min-h-screen flex w-full font-sans">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <SimulationBanner />
        <header
          className={cn(
            "flex items-center gap-3 border-b px-4",
            slotActive ? "min-h-14 py-2 h-auto" : "h-14"
          )}
        >
          {hideSidebarTrigger && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              onClick={() => navigate(backTo ?? "/leads")}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {headerContent ? (
            headerContent
          ) : isDashboard ? (
            <DashboardHeaderContent fullName={fullName} />
          ) : (
            <div className="flex-1" />
          )}
          <NotificationBell />
        </header>
        <main className="flex-1 px-4 lg:px-6 py-5">{children}</main>
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

  if (appUser && (appUser.role === "super_admin" || appUser.role === "admin")) {
    return <Navigate to="/admin" replace state={{ roleRedirectToast: "Use the Admin Portal for this account." }} />;
  }

  const isDashboard = location.pathname === "/";

  return (
    <SidebarProvider>
      <HeaderSlotProvider>
        <AppShell isDashboard={isDashboard} fullName={appUser?.full_name ?? "User"}>
          {children}
        </AppShell>
      </HeaderSlotProvider>
    </SidebarProvider>
  );
}
