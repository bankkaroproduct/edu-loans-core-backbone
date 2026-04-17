import {
  Shield,
  Inbox,
  GitBranch,
  Gavel,
  Banknote,
  BarChart3,
  GraduationCap,
  Users,
  Settings,
  LogOut,
  ArrowLeftRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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

const adminItems = [
  { title: "Admin Dashboard", url: "/admin", icon: Shield, end: true },
  { title: "Lead Queue", url: "/admin/leads", icon: Inbox },
  { title: "Pipeline", url: "/admin/pipeline", icon: GitBranch },
  { title: "Underwriting", url: "/admin/underwriting", icon: Gavel },
  { title: "Disbursements", url: "/admin/disbursements", icon: Banknote },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
];

const adminMasterItems = [
  { title: "Partners", url: "/admin/partners", icon: Users },
  { title: "Lenders", url: "/admin/lenders", icon: Banknote },
  { title: "Universities", url: "/admin/universities", icon: GraduationCap },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();

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
              <span className="flex items-center gap-1.5">
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

        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && "Master Data"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMasterItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
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
      </SidebarContent>

      <SidebarFooter>
        <div className="p-2 space-y-2">
          {!collapsed && appUser && (
            <div className="px-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{appUser.full_name}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground truncate">{appUser.email}</p>
              </div>
              <Badge variant="outline" className="mt-1 text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">
                {appUser.role.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
          )}

          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className="w-full justify-start text-xs"
            onClick={() => navigate("/")}
            title="Switch to Partner Portal view"
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            {!collapsed && "Partner Portal view"}
          </Button>

          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {!collapsed && "Sign Out"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
