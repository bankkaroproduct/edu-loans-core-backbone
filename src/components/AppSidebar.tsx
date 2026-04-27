import {
  LayoutDashboard,
  FileText,
  Upload,
  CreditCard,
  Settings,
  LogOut,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { AdminPartnerSwitcher } from "@/components/AdminPartnerSwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: FileText },
  { title: "Bulk Upload", url: "/bulk-upload", icon: Upload },
  { title: "Payouts", url: "/payouts", icon: CreditCard },
  { title: "Master Data", url: "/master-data", icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { appUser, signOut } = useAuth();
  const { isSimulating, effectivePartnerName, isPartnerInactive } = usePartnerContext();

  const isPartnerRole = appUser?.role === "partner_admin" || appUser?.role === "partner_agent";
  const isUnlinkedPartner = isPartnerRole && !appUser?.partner_id;
  const showInactiveNotice = isPartnerRole && !!appUser?.partner_id && isPartnerInactive === true;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && "EduLoans Portal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isUnlinkedPartner && !collapsed && (
          <div className="mx-2 mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div>
              Your account is not linked to a partner organization yet. Lead creation is disabled — please contact your admin.
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <AdminPartnerSwitcher collapsed={collapsed} />
        <div className="p-2">
          {!collapsed && appUser && (
            <div className="mb-2 px-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{appUser.full_name}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground truncate">{appUser.role.replace(/_/g, " ")}</p>
                {isSimulating && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                    SIM
                  </Badge>
                )}
              </div>
              {isSimulating && effectivePartnerName && (
                <p className="text-[10px] text-amber-600 truncate mt-0.5">{effectivePartnerName}</p>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className="w-full justify-start"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {!collapsed && "Sign Out"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
