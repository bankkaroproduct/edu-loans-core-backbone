import {
  Shield, Inbox, Banknote, Users, LogOut,
  Database, FilePlus, Upload, FileSpreadsheet,
  SlidersHorizontal, History, ScrollText,
  MessageSquare, FileText, Star, UserCog, BarChart3,
  ChevronDown,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { canAccessBre, normalizeBrePermission } from "@/lib/bre/permissions";
import type { AdminSectionKey } from "@/lib/admin/sections";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials, avatarColor } from "@/components/admin/dashboard/visualHelpers";

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
  { title: "Team Performance", url: "/admin/team-performance", icon: BarChart3, section: "admin_users" },
  { title: "Audit Logs", url: "/admin/audit-logs", icon: ScrollText, section: "admin_users" },
];

const navBaseClass =
  "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[7px] text-[13.5px] font-medium text-[#45505C] hover:bg-[#F5F7FA] hover:text-[#1C1B1F] transition-colors";
const navActiveClass =
  "bg-[#EEF2FF] text-[#0036DA] font-semibold shadow-[inset_2px_0_0_#0036DA]";
const sectionLabelClass =
  "text-[10px] uppercase tracking-[0.10em] text-[#9AA3AE] font-bold pl-2.5 pt-3.5 pb-1.5";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
          <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          {!collapsed && <span className="truncate">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const groupContainsActive = (items: NavItem[]) =>
    items.some((i) =>
      i.end ? location.pathname === i.url : location.pathname === i.url || location.pathname.startsWith(i.url + "/"),
    );

  const renderCollapsibleGroup = (
    label: string,
    items: NavItem[],
    extra?: React.ReactNode,
  ) => {
    if (items.length === 0) return null;

    // In icon-only collapsed mode: render flat (no accordion), preserve today's behavior.
    if (collapsed) {
      return (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{items.map(renderItem)}</SidebarMenu>
            {extra}
          </SidebarGroupContent>
        </SidebarGroup>
      );
    }

    const defaultOpen = groupContainsActive(items);
    return (
      <SidebarGroup>
        <Collapsible defaultOpen={defaultOpen} key={`${label}-${defaultOpen ? "o" : "c"}`}>
          <SidebarGroupLabel asChild className="p-0">
            <CollapsibleTrigger className="group/collapsible flex w-full items-center justify-between pr-2 rounded-[7px] hover:bg-[#F5F7FA] transition-colors">
              <span className={sectionLabelClass}>{label}</span>
              <ChevronDown
                className="h-3.5 w-3.5 text-[#9AA3AE] mr-1 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180"
                strokeWidth={2}
              />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <SidebarGroupContent>
              <SidebarMenu>{items.map(renderItem)}</SidebarMenu>
              {extra}
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    );
  };



  const userName = appUser?.full_name ?? "";
  const userInitials = initials(userName) || "?";

  return (
    <Sidebar collapsible="icon" className="bg-white border-r border-[#ECEEF1]">
      <SidebarContent className="bg-white">
        {/* Brand block */}
        {!collapsed && (
          <div className="flex items-center gap-2.5 border-b border-[#ECEEF1] px-3 py-3.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-[7px] text-white text-[13px] font-bold"
              style={{ background: "linear-gradient(135deg, #0036DA, #2C40AA)" }}
              aria-hidden
            >
              E
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[13px] font-bold text-[#1C1B1F] truncate">Eduloans</p>
              <p className="text-[9.5px] uppercase tracking-[0.10em] font-bold text-[#9AA3AE]">
                Admin Portal
              </p>
            </div>
          </div>
        )}

        {visibleAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>{visibleAdminItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {renderCollapsibleGroup(
          "Lead Operations",
          visibleLeadOpsItems,
          <AdminPartnerSwitcher collapsed={collapsed} />,
        )}

        {renderCollapsibleGroup("Master Data", visibleMasterItems)}

        {renderCollapsibleGroup("BRE Engine", visibleBreItems)}

        {renderCollapsibleGroup("Communications", visibleCommsItems)}

        {renderCollapsibleGroup("Administration", visibleUserMgmt)}
      </SidebarContent>

      <SidebarFooter className="border-t border-[#ECEEF1] bg-white">
        <div className="p-2 space-y-2">
          {!collapsed && appUser && (
            <div className="flex items-center gap-2.5 px-1.5 py-1.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold"
                style={{ background: avatarColor(userName) || "linear-gradient(135deg, #0036DA, #2C40AA)" }}
                aria-hidden
              >
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1C1B1F] truncate leading-tight">
                  {appUser.full_name}
                </p>
                <p className="text-[11px] text-[#6B7684] truncate leading-tight">{appUser.email}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#0036DA]">
                {appUser.role === "super_admin" ? "Super" : "Admin"}
              </span>
            </div>
          )}

          {collapsed ? (
            <div className="flex justify-center pt-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-[#ECEEF1] text-[#45505C] hover:text-[#1C1B1F] hover:bg-[#F5F7FA]"
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
              className="w-full justify-start gap-2 h-9 rounded-[8px] border-[#ECEEF1] text-[13px] font-medium text-[#45505C] hover:text-[#1C1B1F] hover:bg-[#F5F7FA]"
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
