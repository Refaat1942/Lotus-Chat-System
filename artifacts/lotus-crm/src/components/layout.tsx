import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale, useT } from "@/i18n";
import React from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  LayoutDashboard,
  Sparkles,
  Users,
  FileBarChart,
  Settings,
  LogOut,
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
import { useBranding } from "@/lib/api-extra";
import { useInsights } from "@/lib/api-extra";
import { useMyPermissions } from "@/lib/api-extra";
import { TopBar } from "@/components/top-bar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const searchString = useSearch();
  const { user, logout } = useAuth();
  const { data: branding } = useBranding();
  const { data: insights } = useInsights();
  const { data: perms, isLoading: permsLoading } = useMyPermissions();
  const t = useT();
  const { dir } = useLocale();

  const channelParam = new URLSearchParams(searchString).get("channel");
  const channelActive = (ch: string) => location.startsWith("/chat") && channelParam === ch;

  const channelCounts = insights?.channelCounts ?? {};
  const urgentCount = insights?.summary.urgentCount ?? 0;

  const isActive = (href: string) =>
    location === href || location.startsWith(href + "/");

  const canViewChats = !permsLoading && !!perms?.canViewChats;
  const canManageCustomers = !permsLoading && !!perms?.canManageCustomers;
  const canViewReports = !permsLoading && !!perms?.canViewReports;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background" dir={dir}>
        <Sidebar className="border-r border-border">
          <SidebarHeader className="flex items-center px-4 py-5 border-b border-border bg-gradient-to-r from-primary/5 via-background to-accent/5">
            <div className="flex items-center gap-3 min-w-0 w-full">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.companyName}
                  className="h-10 w-10 rounded-lg object-cover ring-2 ring-primary/30 shadow-md flex-shrink-0"
                />
              ) : (
                <div className="bg-gradient-to-br from-primary to-accent rounded-lg p-2 flex items-center justify-center shadow-lg border border-primary/20 flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-primary-foreground animate-pulse" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="font-bold text-base bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent truncate block">
                  {branding?.companyName ?? t("common.appName")}
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="py-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")}>
                  <Link href="/dashboard" className="flex items-center gap-3 transition-colors">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>{t("nav.dashboard")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {canViewChats && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/chat") && !channelParam}>
                  <Link href="/chat" className="flex items-center gap-3 transition-colors">
                    <Inbox className="h-4 w-4" />
                    <span>{t("nav.inbox")}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={channelActive("whatsapp")}>
                      <Link href="/chat?channel=whatsapp" className="flex items-center gap-2">
                        <FaWhatsapp className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="flex-1">{t("nav.whatsapp")}</span>
                        {channelCounts.whatsapp > 0 && (
                          <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                            {channelCounts.whatsapp}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={channelActive("messenger")}>
                      <Link href="/chat?channel=messenger" className="flex items-center gap-2">
                        <FaFacebookMessenger className="h-3.5 w-3.5 text-blue-500" />
                        <span className="flex-1">{t("nav.messenger")}</span>
                        {channelCounts.messenger > 0 && (
                          <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium">
                            {channelCounts.messenger}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={channelActive("instagram")}>
                      <Link href="/chat?channel=instagram" className="flex items-center gap-2">
                        <FaInstagram className="h-3.5 w-3.5 text-pink-500" />
                        <span className="flex-1">{t("nav.instagram")}</span>
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
              )}

              {canViewChats && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/insights")}>
                  <Link href="/insights" className="flex items-center gap-3 transition-colors">
                    <Sparkles className="h-4 w-4" />
                    <span className="flex-1">{t("nav.insights")}</span>
                    {urgentCount > 0 && (
                      <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-medium animate-pulse">
                        {urgentCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}

              {canManageCustomers && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/customers")}>
                  <Link href="/customers" className="flex items-center gap-3 transition-colors">
                    <Users className="h-4 w-4" />
                    <span>{t("nav.customers")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}

              {canViewReports && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/reports")}>
                  <Link href="/reports" className="flex items-center gap-3 transition-colors">
                    <FileBarChart className="h-4 w-4" />
                    <span>{t("nav.reports")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}

              {user?.role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/marketing")}>
                    <Link href="/marketing" className="flex items-center gap-3 transition-colors">
                      <Megaphone className="h-4 w-4" />
                      <span>{t("nav.marketing")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {user?.role === "admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/settings")}>
                    <Link href="/settings" className="flex items-center gap-3 transition-colors">
                      <Settings className="h-4 w-4" />
                      <span>{t("nav.settings")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-4 flex flex-col gap-3">
            <LanguageSwitcher compact />
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground hover:text-foreground transition-colors"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("nav.logout")}
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
