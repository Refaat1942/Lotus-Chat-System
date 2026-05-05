import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileBarChart,
  Settings,
  LogOut,
  Sparkles,
  Inbox,
  Megaphone,
} from "lucide-react";
import { FaWhatsapp, FaFacebookMessenger, FaInstagram } from "react-icons/fa";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { AvailabilityToggle } from "@/components/availability-toggle";
import { useBranding } from "@/lib/api-extra";
import { useInsights } from "@/lib/api-extra";
import { TopBar } from "@/components/top-bar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: branding } = useBranding();
  const { data: insights } = useInsights();

  const channelCounts = insights?.channelCounts ?? {};
  const urgentCount = insights?.summary.urgentCount ?? 0;

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="flex items-center px-4 py-5 border-b border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.companyName}
                  className="h-8 w-8 rounded-md object-cover ring-1 ring-border/50"
                />
              ) : (
                <div className="bg-primary rounded-md p-1.5 flex items-center justify-center shadow-sm">
                  <MessageSquare className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <span className="font-bold text-lg text-foreground tracking-tight truncate">
                {branding?.companyName ?? "Lotus Pharmacies"}
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent className="py-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")}>
                  <Link href="/dashboard" className="flex items-center gap-3 transition-colors">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Inbox parent + channel sub-items */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/chat")}>
                  <Link href="/chat" className="flex items-center gap-3 transition-colors">
                    <Inbox className="h-4 w-4" />
                    <span>Inbox</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={location === "/chat?channel=whatsapp"}>
                      <Link href="/chat?channel=whatsapp" className="flex items-center gap-2">
                        <FaWhatsapp className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="flex-1">WhatsApp</span>
                        {channelCounts.whatsapp > 0 && (
                          <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                            {channelCounts.whatsapp}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={location === "/chat?channel=messenger"}>
                      <Link href="/chat?channel=messenger" className="flex items-center gap-2">
                        <FaFacebookMessenger className="h-3.5 w-3.5 text-blue-500" />
                        <span className="flex-1">Messenger</span>
                        {channelCounts.messenger > 0 && (
                          <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium">
                            {channelCounts.messenger}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={location === "/chat?channel=instagram"}>
                      <Link href="/chat?channel=instagram" className="flex items-center gap-2">
                        <FaInstagram className="h-3.5 w-3.5 text-pink-500" />
                        <span className="flex-1">Instagram</span>
                        {channelCounts.instagram > 0 && (
                          <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-600 font-medium">
                            {channelCounts.instagram}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/insights")}>
                  <Link href="/insights" className="flex items-center gap-3 transition-colors">
                    <Sparkles className="h-4 w-4" />
                    <span className="flex-1">AI Insights</span>
                    {urgentCount > 0 && (
                      <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-medium animate-pulse">
                        {urgentCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/customers")}>
                  <Link href="/customers" className="flex items-center gap-3 transition-colors">
                    <Users className="h-4 w-4" />
                    <span>Customers</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/reports")}>
                  <Link href="/reports" className="flex items-center gap-3 transition-colors">
                    <FileBarChart className="h-4 w-4" />
                    <span>Reports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {user?.role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/marketing")}>
                    <Link href="/marketing" className="flex items-center gap-3 transition-colors">
                      <Megaphone className="h-4 w-4" />
                      <span>Marketing</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {user?.role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/settings")}>
                    <Link href="/settings" className="flex items-center gap-3 transition-colors">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-4 flex flex-col gap-3">
            {user?.role === "agent" && <AvailabilityToggle />}
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground hover:text-foreground transition-colors"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-in fade-in duration-300">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
