import { Receipt, Package, Settings, LogIn, LogOut, Wrench, Crown, Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const baseNav = [
  { title: "Dashboard", url: "/", icon: Receipt },
  { title: "Product Setup", url: "/setup", icon: Wrench },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Pricing", url: "/pricing", icon: Crown },
  // { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, isAuthenticated, signOut, loading } = useAuth();
  const { isAdmin } = useUserRole();
  const { isPro } = useSubscription();
  const navigate = useNavigate();

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "U";
  const navItems = [...baseNav, ...(isAdmin ? [{ title: "Admin", url: "/admin", icon: Shield }] : [])];

  return (
    <Sidebar collapsible="icon">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary">
          <Receipt className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-sidebar-foreground truncate">Profit Finder</h1>
            <p className="text-xs text-muted-foreground truncate">Ingredient Costing & Profit Finder</p>
          </div>
        )}
      </div>

      {!loading && isAuthenticated && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-sidebar-border">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{userInitials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="overflow-hidden min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.email?.split("@")[0] || "User"}</p>
                {isPro && <Badge variant="default" className="text-[9px] px-1 py-0 h-4"><Crown className="h-2.5 w-2.5 mr-0.5" />PRO</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-primary text-primary-foreground hover:bg-primary/90"
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!loading && (
          isAuthenticated ? (
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              onClick={signOut}
              className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </Button>
          ) : (
            <Button variant="outline" size={collapsed ? "icon" : "sm"} onClick={() => navigate("/auth")} className="w-full justify-start gap-2">
              <LogIn className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign In</span>}
            </Button>
          )
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
