import React from "react";
import { Moon, Sun, Leaf } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/api-extra";
import { NotificationsBell } from "@/components/notifications-bell";

export function TopBar() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: branding } = useBranding();

  const companyName = branding?.companyName ?? "Lotus Pharmacies";

  return (
    <header
      className="h-14 flex-shrink-0 border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50 flex items-center justify-between px-4 md:px-6 z-10"
      data-testid="top-bar"
    >
      {/* Left — branding (visible because the sidebar can be collapsed) */}
      <div className="flex items-center gap-2.5 min-w-0">
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={companyName}
            className="h-8 w-8 rounded-md object-cover ring-1 ring-border/50 shadow-sm"
          />
        ) : (
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Leaf className="h-4 w-4" />
          </div>
        )}
        <span className="font-semibold text-sm tracking-tight truncate hidden sm:inline">
          {companyName}
        </span>
      </div>

      {/* Right — notifications, theme toggle, user */}
      <div className="flex items-center gap-1.5">
        <NotificationsBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-9 w-9 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
          data-testid="btn-theme-toggle"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-border">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
              {user?.name?.substring(0, 2).toUpperCase() ?? "??"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium truncate max-w-[140px]">
              {user?.name}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">
              {user?.role}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
