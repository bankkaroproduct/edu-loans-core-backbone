import {
  Shield, Inbox, Banknote, Users, LogOut,
  Database, FilePlus, Upload, FileSpreadsheet,
  SlidersHorizontal, History, ScrollText, Calculator, FlaskConical,
  MessageSquare, FileText, Star,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { canAccessBre, normalizeBrePermission } from "@/lib/bre/permissions";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAdminPendingRequests } from "@/hooks/useAdminPendingRequests";
import { AdminPartnerSwitcher } from "@/components/AdminPartnerSwitcher";

const adminItems = [
  { title: "Admin Dashboard", url: "/admin", icon: Shield, end: true },
  { title: "Lead Queue", url: "/admin/leads", icon: Inbox },
  { title: "Reports", url: "/admin/reports", icon: FileSpreadsheet },
];

const leadOpsItems = [
  { title: "Add Lead", url: "/admin/leads/new", icon: FilePlus },
  { title: "Bulk Upload", url: "/admin/leads/bulk", icon: Upload },
];

const adminMasterItems = [
  { title: "Master Data", url: "/admin/master-data", icon: Database },
  { title: "Partners", url: "/admin/partners", icon: Users },
  { title: "Lenders", url: "/admin/lenders", icon: Banknote },
  { title: "Premiere Lists", url: "/admin/premiere-lists", icon: Star },
];

const breItems = [
  { title: "BRE Dashboard", url: "/admin/bre", icon: SlidersHorizontal, end: true },
  { title: "Scoring Config", url: "/admin/bre/scoring", icon: Calculator },
  { title: "Lender Rules", url: "/admin/bre/lenders", icon: Banknote },
  { title: "Simulator", url: "/admin/bre/simulate", icon: FlaskConical },
  { title: "Version History", url: "/admin/bre/versions", icon: History },
  { title: "Audit Log", url: "/admin/bre/audit", icon: ScrollText },
];

const commsItems = [
  { title: "Test Panel", url: "/admin/communications", icon: MessageSquare, end: true },
  { title: "Templates", url: "/admin/communications/templates", icon: FileText },
  { title: "Logs", url: "/admin/communications/logs", icon: History },
];

// Shared className builders for nav items.
// Active state: stronger bg + primary left border + medium font.
// `border-l-2 border-transparent` on the base keeps row width identical so
// active/inactive items don't shift horizontally.
const navBaseClass =
  "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm border-l-2 border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors";
const navActiveClass =
  "bg-primary/10 text-primary font-medium border-l-2 border-primary hover:bg-primary/15";

// Section labels: text-xs uppercase tracking-wider, muted, with vertical rhythm.
const sectionLabelClass =
  "text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/55 mt-3 mb-1.5 font-semibold";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();
  const { count: pendingRequests } = useAdminPendingRequests();

  const breAccess = canAccessBre(appUser?.role, normalizeBrePermission(appUser?.bre_permission));

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <span className={`flex items-center gap-1.5 ${sectionLabelClass}`}>
                <Shield className="h-3.5 w-3.5 text-primary" />
                Admin Console
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && <span className={sectionLabelClass}>Lead Operations</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {leadOpsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={navBaseClass}
                      activeClassName={navActiveClass}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <AdminPartnerSwitcher collapsed={collapsed} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && <span className={sectionLabelClass}>Master Data</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMasterItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={navBaseClass}
                      activeClassName={navActiveClass}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {breAccess && (
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
              <SidebarMenu>
                {breItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.end}
                        className={navBaseClass}
                        activeClassName={navActiveClass}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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
            <SidebarMenu>
              {commsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className={navBaseClass}
                      activeClassName={navActiveClass}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className="p-2 space-y-2">
          {!collapsed && appUser && (
            <div className="px-2 py-2 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/50 space-y-0.5">
              {/* Line 1: name + role pill on one line */}
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
              {/* Line 2: email muted */}
              <p className="text-xs text-muted-foreground truncate">{appUser.email}</p>
            </div>
          )}

          {/* Sign out: icon button (not full-width) */}
          <div className={collapsed ? "flex justify-center" : "flex justify-end px-2"}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleSignOut}
                  aria-label="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
