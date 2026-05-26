import { ReactNode, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { HeaderSlotProvider, useHeaderSlot } from "@/components/layout/HeaderSlotContext";
import { cn } from "@/lib/utils";

/**
 * Shell for /admin/* routes. Visually distinct from the Partner portal so admins
 * always know which context they are operating in.
 *
 * Auth/role gating is enforced upstream in <AdminRoute>.
 */
function AdminShell({ children }: { children: ReactNode }) {
  const { headerContent, hideSidebarTrigger, backTo } = useHeaderSlot();
  const navigate = useNavigate();
  const slotActive = !!headerContent || hideSidebarTrigger;

  return (
    <div className="min-h-screen flex w-full bg-muted/30 font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {slotActive && (
          <header
            className={cn(
              "flex items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sticky top-0 z-20",
              "min-h-14 py-2 h-auto"
            )}
          >
            {hideSidebarTrigger && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={() => navigate(backTo ?? "/admin/leads")}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {headerContent}
          </header>
        )}
        <main className="flex-1 px-6 py-7">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "240px" } as CSSProperties}>
      <HeaderSlotProvider>
        <AdminShell>{children}</AdminShell>
      </HeaderSlotProvider>
    </SidebarProvider>
  );
}
