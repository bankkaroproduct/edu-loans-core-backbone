import {
  Shield, Inbox, Banknote, Users, LogOut,
  Database, FilePlus, Upload, FileSpreadsheet,
  SlidersHorizontal, History, ScrollText, Calculator, FlaskConical,
  MessageSquare, FileText, Star, UserCog, BarChart3,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { canAccessBre, normalizeBrePermission } from "@/lib/bre/permissions";
import type { AdminSectionKey } from "@/lib/admin/sections";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { AdminPartnerSwitcher } from "@/components/AdminPartnerSwitcher";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Shield;
  end?: boolean;
  section: AdminSectionKey;
};

const adminItems: NavItem[] = [
  { title: "Admin Dashboard", url: "/admin", icon: Shield, end: true, section: "dashboard" },
  { title: "Lead Queue", url: "/admin/leads", icon: Inbox, section: "lead_queue" },
  { title: "Reports", url: "/admin/reports", icon: FileSpreadsheet, section: "reports" },
];

const leadOpsItems: NavItem[] = [
  { title: "Add Lead", url: "/admin/leads/new", icon: FilePlus, section: "add_lead" },
  { title: "Bulk Upload", url: "/admin/leads/bulk", icon: Upload, section: "bulk_upload" },
];

const adminMasterItems: NavItem[] = [
  { title: "Master Data", url: "/admin/master-data", icon: Database, section: "master_data" },
  { title: "Partners", url: "/admin/partners", icon: Users, section: "partners" },
  { title: "Lenders", url: "/admin/lenders", icon: Banknote, section: "lenders" },
  { title: "Premiere Lists", url: "/admin/premiere-lists", icon: Star, section: "premiere_lists" },
];

const breItems: NavItem[] = [
  { title: "BRE Dashboard", url: "/admin/bre", icon: SlidersHorizontal, end: true, section: "bre" },
];

const commsItems: NavItem[] = [
  { title: "Test Panel", url: "/admin/communications", icon: MessageSquare, end: true, section: "communications" },
  { title: "Templates", url: "/admin/communications/templates", icon: FileText, section: "communications" },
  { title: "Logs", url: "/admin/communications/logs", icon: History, section: "communications" },
];

const userMgmtItems: NavItem[] = [
  { title: "User Management", url: "/admin/users", icon: UserCog, section: "admin_users" },
];

const navBaseClass =
  "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm border-l-2 border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors";
const navActiveClass =
  "bg-primary/10 text-primary font-medium border-l-2 border-primary hover:bg-primary/15";
const sectionLabelClass =
  "text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/55 mt-3 mb-1.5 font-semibold";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();
  const { canView, isSuperAdmin } = useAdminPermissions();

  const breAccess = canAccessBre(appUser?.role, normalizeBrePermission(appUser?.bre_permission));

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const filterItems = (items: NavItem[]) =>
    items.filter((i) => (i.section === "admin_users" ? isSuperAdmin : canView(i.section)));

  const visibleAdminItems = filterItems(adminItems);
  const visibleLeadOpsItems = filterItems(leadOpsItems);
  const visibleMasterItems = filterItems(adminMasterItems);
  const visibleBreItems = breAccess ? filterItems(breItems) : [];
  const visibleCommsItems = filterItems(commsItems);
  const visibleUserMgmt = filterItems(userMgmtItems);

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end={item.end}
          className={navBaseClass}
          activeClassName={navActiveClass}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {visibleAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>{visibleAdminItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleLeadOpsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {!collapsed && <span className={sectionLabelClass}>Lead Operations</span>}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{visibleLeadOpsItems.map(renderItem)}</SidebarMenu>
              <AdminPartnerSwitcher collapsed={collapsed} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleMasterItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {!collapsed && <span className={sectionLabelClass}>Master Data</span>}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{visibleMasterItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleBreItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {!collapsed && (
                <span className={`flex items-center gap-1.5 ${sectionLabelClass}`}>
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                  BRE Engine
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{visibleBreItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleCommsItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {!collapsed && (
                <span className={`flex items-center gap-1.5 ${sectionLabelClass}`}>
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  Communications
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{visibleCommsItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleUserMgmt.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {!collapsed && (
                <span className={`flex items-center gap-1.5 ${sectionLabelClass}`}>
                  <UserCog className="h-3.5 w-3.5 text-primary" />
                  Administration
                </span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{visibleUserMgmt.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className="p-2 space-y-2">
          {!collapsed && appUser && (
            <div className="px-2 py-2 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/50 space-y-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate flex-1 min-w-0">
                  {appUser.full_name}
                </p>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30 shrink-0 rounded-full"
                >
                  {appUser.role.replace(/_/g, " ").toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{appUser.email}</p>
            </div>
          )}

          {collapsed ? (
            <div className="flex justify-center pt-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-sidebar-border/60 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                    onClick={handleSignOut}
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-9 border-sidebar-border/60 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
