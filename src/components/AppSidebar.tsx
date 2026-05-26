import {
  LayoutDashboard,
  Users,
  UploadCloud,
  Wallet,
  BookOpen,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { AdminPartnerSwitcher } from "@/components/AdminPartnerSwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/components/admin/dashboard/visualHelpers";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Bulk Upload", url: "/bulk-upload", icon: UploadCloud },
  { title: "Payouts", url: "/payouts", icon: Wallet },
  { title: "Master Data", url: "/master-data", icon: BookOpen },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { appUser, signOut } = useAuth();
  const { isSimulating, effectivePartnerName, isPartnerInactive } = usePartnerContext();

  const isPartnerRole = appUser?.role === "partner_admin" || appUser?.role === "partner_agent";
  const isUnlinkedPartner = isPartnerRole && !appUser?.partner_id;
  const showInactiveNotice = isPartnerRole && !!appUser?.partner_id && isPartnerInactive === true;

  const userName = appUser?.full_name ?? "User";
  const roleLabel = appUser?.role?.replace(/_/g, " ") ?? "";

  return (
    <Sidebar collapsible="icon" className="border-r" style={{ borderColor: "var(--pp-border-1)" }}>
      <SidebarContent className="bg-white">
        {/* Brand block */}
        <div
          className="flex items-center justify-between px-3 pt-3 pb-3 border-b"
          style={{ borderColor: "var(--pp-border-2)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="flex items-center justify-center text-white shrink-0"
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: "linear-gradient(135deg, #0036DA, #2C40AA)",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "-0.04em",
              }}
            >
              E
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <div
                  className="text-[13.5px] font-extrabold truncate"
                  style={{ letterSpacing: "-0.015em", color: "var(--pp-fg-1)" }}
                >
                  EduLoans
                </div>
                <div
                  className="text-[10px] font-bold uppercase truncate"
                  style={{ letterSpacing: "0.08em", color: "var(--pp-fg-3)" }}
                >
                  Partner Portal
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="flex items-center justify-center rounded-[7px] hover:bg-[#F5F7FA] shrink-0"
            style={{ width: 26, height: 26, color: "var(--pp-fg-3)" }}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="px-2 pt-3 flex flex-col gap-0.5">
          {mainItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="group flex items-center gap-2.5 px-[9px] py-[10px] rounded-[7px] text-[13.5px] font-medium transition-colors hover:bg-[#F5F7FA]"
              activeClassName="!bg-[#EEF2FF] !text-[#0036DA] !font-semibold shadow-[inset_2px_0_0_#0036DA]"
              style={{ color: "var(--pp-fg-2)" }}
            >
              <item.icon
                className="h-[18px] w-[18px] shrink-0 group-[.active]:text-[#0036DA]"
                style={{ color: "var(--pp-fg-3)" }}
              />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </NavLink>
          ))}
        </nav>

        {isUnlinkedPartner && !collapsed && (
          <div className="mx-3 mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div>
              Your account is not linked to a partner organization yet. Lead creation is disabled — please contact your admin.
            </div>
          </div>
        )}

        {showInactiveNotice && !collapsed && (
          <div className="mx-3 mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div>
              Your partner account is inactive — new lead submission is paused. Existing leads remain accessible.
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="bg-white border-t" style={{ borderColor: "var(--pp-border-2)" }}>
        <AdminPartnerSwitcher collapsed={collapsed} />
        <div className="px-3 pt-2 pb-3 flex flex-col gap-2">
          {appUser && (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="flex items-center justify-center rounded-full text-white shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  background: "linear-gradient(135deg, #FF6D1D, #DA2760)",
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                {initials(userName)}
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p
                      className="text-[12.5px] font-bold truncate"
                      style={{ color: "var(--pp-fg-1)" }}
                    >
                      {userName}
                    </p>
                    {isSimulating && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30">
                        SIM
                      </Badge>
                    )}
                  </div>
                  <p
                    className="text-[10.5px] truncate capitalize"
                    style={{ color: "var(--pp-fg-3)" }}
                  >
                    {roleLabel}
                  </p>
                  {isSimulating && effectivePartnerName && (
                    <p className="text-[10px] text-amber-600 truncate">{effectivePartnerName}</p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            className="group flex items-center gap-2 px-[9px] py-[10px] rounded-[7px] text-[13.5px] font-medium transition-colors hover:bg-[#FEF2F1] hover:text-[#D41000]"
            style={{ color: "var(--pp-fg-2)" }}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0 group-hover:text-[#D41000]" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
