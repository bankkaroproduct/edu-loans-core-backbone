import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { Navigate } from "react-router-dom";
import { FlaskConical } from "lucide-react";

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

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <SimulationBanner />
          <header className="h-12 flex items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
