import React from "react";
import { Moon, Sun, Leaf, Circle } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import {
  useBranding,
  useMyAvailability,
  useUpdateMyAvailability,
  useNotReadyReasons,
} from "@/lib/api-extra";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: branding } = useBranding();
  const { data: availability } = useMyAvailability();
  const { data: notReadyReasons } = useNotReadyReasons();
  const updateAvailability = useUpdateMyAvailability();

  const companyName = branding?.companyName ?? "Fratelanza Chating System";

  const isReady = availability?.isReady ?? true;
  const currentReason = notReadyReasons?.find((r) => r.id === availability?.notReadyReasonId);
  const statusColor = isReady ? "text-emerald-500" : "text-amber-500";
  const statusLabel = isReady
    ? "Ready"
    : currentReason
      ? `Not Ready · ${currentReason.value}`
      : "Not Ready";

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

      {/* Right — availability, notifications, theme toggle, user */}
      <div className="flex items-center gap-1.5">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-3 text-xs font-medium"
                data-testid="btn-availability"
              >
                <Circle className={`h-2 w-2 fill-current ${statusColor}`} />
                <span className="hidden md:inline">{statusLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Set availability</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => updateAvailability.mutate({ notReadyReasonId: null })}
                data-testid="availability-ready"
              >
                <Circle className="h-2 w-2 fill-current text-emerald-500 mr-2" />
                Ready
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Not Ready — pick reason</DropdownMenuLabel>
              {notReadyReasons?.length ? (
                notReadyReasons.map((r) => (
                  <DropdownMenuItem
                    key={r.id}
                    onClick={() => updateAvailability.mutate({ notReadyReasonId: r.id })}
                    data-testid={`availability-${r.key.toLowerCase()}`}
                  >
                    <Circle className="h-2 w-2 fill-current text-amber-500 mr-2" />
                    {r.value}
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No reasons configured</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

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
