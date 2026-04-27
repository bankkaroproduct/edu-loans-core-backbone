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
    <SidebarProvider style={{ "--sidebar-width": "220px" } as CSSProperties}>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center gap-3 border-b border-primary/10 bg-primary/5 px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Admin Console
              </span>
            </div>
          </header>
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
