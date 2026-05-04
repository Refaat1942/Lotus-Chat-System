import React from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  Clock,
  Sparkles,
  MessageSquare,
  Flame,
  TrendingUp,
  CheckCircle2,
  Phone,
} from "lucide-react";
import { FaWhatsapp, FaFacebookMessenger, FaInstagram, FaSms } from "react-icons/fa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { useInsights, type UnrepliedChat, type ChatSeverity } from "@/lib/api-extra";

const SEVERITY_STYLES: Record<ChatSeverity, { dot: string; label: string; pill: string }> = {
  normal: {
    dot: "bg-emerald-500",
    label: "Healthy",
    pill: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  medium: {
    dot: "bg-amber-500",
    label: "Waiting",
    pill: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  high: {
    dot: "bg-orange-500",
    label: "Late",
    pill: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  critical: {
    dot: "bg-rose-500",
    label: "Critical",
    pill: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  },
};

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const c = (channel ?? "").toLowerCase();
  if (c === "messenger") return <FaFacebookMessenger className={className ?? "h-3.5 w-3.5 text-blue-500"} />;
  if (c === "instagram") return <FaInstagram className={className ?? "h-3.5 w-3.5 text-pink-500"} />;
  if (c === "sms") return <FaSms className={className ?? "h-3.5 w-3.5 text-slate-500"} />;
  return <FaWhatsapp className={className ?? "h-3.5 w-3.5 text-emerald-500"} />;
}

function formatWaiting(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function InsightsPage() {
  const { data, isLoading, isFetching, dataUpdatedAt } = useInsights();
  const [, setLocation] = useLocation();

  const openChat = (id: number) => setLocation(`/chat?conv=${id}`);

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto bg-background animate-in fade-in duration-300">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            AI Insights
          </h2>
          <p className="text-muted-foreground mt-1">
            Auto-analyzed view of your inbox health, refreshed every 30 seconds.
          </p>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {isFetching ? (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Refreshing…
            </span>
          ) : dataUpdatedAt ? (
            <>Last updated {format(new Date(dataUpdatedAt), "h:mm:ss a")}</>
          ) : null}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Awaiting Reply"
          value={data?.summary.unrepliedCount}
          icon={<MessageSquare className="h-4 w-4 text-amber-500" />}
          loading={isLoading}
          accent="amber"
        />
        <KpiCard
          title="Urgent Chats"
          value={data?.summary.urgentCount}
          icon={<Flame className="h-4 w-4 text-rose-500" />}
          loading={isLoading}
          accent="rose"
        />
        <KpiCard
          title="Avg Reply (7d)"
          value={data ? `${data.summary.avgReplyMinutes}m` : undefined}
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          loading={isLoading}
          accent="blue"
        />
        <KpiCard
          title="SLA Threshold"
          value={data ? `${data.slaMinutes}m` : undefined}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          loading={isLoading}
          accent="emerald"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Unreplied / Urgent ledger */}
        <Card className="lg:col-span-2 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Conversations Needing Attention
              </CardTitle>
              <CardDescription>
                Customers waiting on a reply, sorted by how long they have been waiting.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !data || data.unrepliedChats.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
                title="Inbox zero"
                description="Every customer has been responded to. Nice work!"
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.unrepliedChats.map((c) => (
                  <UnrepliedRow key={c.conversationId} chat={c} onOpen={() => openChat(c.conversationId)} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Most active customers */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Most Active Customers
            </CardTitle>
            <CardDescription>By message volume — last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !data || data.mostActive.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8 text-muted-foreground/50" />}
                title="No activity yet"
                description="Once messages flow in, top customers will appear here."
              />
            ) : (
              <ol className="space-y-3">
                {data.mostActive.map((c, idx) => (
                  <li
                    key={c.customerId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-7 w-7 flex-shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{c.customerName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                        {c.branch && (
                          <>
                            <span className="opacity-50">•</span>
                            {c.branch}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{c.messageCount}</p>
                      <p className="text-[10px] text-muted-foreground">msgs</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UnrepliedRow({ chat, onOpen }: { chat: UnrepliedChat; onOpen: () => void }) {
  const sty = SEVERITY_STYLES[chat.severity];
  return (
    <li className="py-3 flex items-center gap-3 group hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sty.dot} ${chat.severity === "critical" ? "animate-pulse" : ""}`} />
      <div className="flex-shrink-0">
        <ChannelIcon channel={chat.channel} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="font-medium text-sm truncate">{chat.customerName}</p>
          {chat.agentName && (
            <span className="text-[10px] text-muted-foreground truncate">→ {chat.agentName}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <Badge variant="outline" className={`${sty.pill} text-[10px] font-medium tabular-nums`}>
          {sty.label} · {formatWaiting(chat.minutesWaiting)}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onOpen}
        >
          Open
        </Button>
      </div>
    </li>
  );
}

function KpiCard({
  title,
  value,
  icon,
  loading,
  accent,
}: {
  title: string;
  value?: string | number;
  icon: React.ReactNode;
  loading: boolean;
  accent: "amber" | "rose" | "blue" | "emerald";
}) {
  const ring = {
    amber: "hover:ring-amber-500/20",
    rose: "hover:ring-rose-500/20",
    blue: "hover:ring-blue-500/20",
    emerald: "hover:ring-emerald-500/20",
  }[accent];
  return (
    <Card className={`shadow-sm hover:shadow-md hover:ring-1 ${ring} transition-all`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-3xl font-bold tabular-nums">{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-10 flex flex-col items-center">
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
    </div>
  );
}
