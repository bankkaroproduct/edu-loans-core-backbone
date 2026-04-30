import { ReactNode, CSSProperties } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Shield } from "lucide-react";

/**
 * Shell for /admin/* routes. Visually distinct from the Partner portal so admins
 * always know which context they are operating in.
 *
 * Auth/role gating is enforced upstream in <AdminRoute>.
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "224px" } as CSSProperties}>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sticky top-0 z-20">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <Shield className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/80">
                Admin Console
              </span>
            </div>
          </header>
          <main className="flex-1 px-6 py-7">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
