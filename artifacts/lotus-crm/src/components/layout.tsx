import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, MessageSquare, Users, FileBarChart, Settings, LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Reports", href: "/reports", icon: FileBarChart },
    ...(user?.role === "admin" ? [{ name: "Settings", href: "/settings", icon: Settings }] : []),
  ];

  return (
    <SidebarProvider>
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar className="border-r border-border">
        <SidebarHeader className="flex items-center px-4 py-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="bg-primary rounded-md p-1.5 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">Lotus<span className="text-primary">CRM</span></span>
          </div>
        </SidebarHeader>
        <SidebarContent className="py-4">
          <SidebarMenu>
            {navigation.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  asChild 
                  isActive={location === item.href || location.startsWith(item.href + '/')}
                >
                  <Link href={item.href} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="border-t border-border p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">{user?.name}</span>
              <span className="text-xs text-muted-foreground mt-1 capitalize">{user?.role}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-8 w-8 text-muted-foreground hover:text-foreground">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={logout} data-testid="button-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
    </SidebarProvider>
  );
}
