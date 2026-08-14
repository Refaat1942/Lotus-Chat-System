import React from "react";
import { Link } from "wouter";
import { useT } from "@/i18n";
import { useMyPermissions } from "@/lib/api-extra";
import {
  useGetDashboardStats,
  useGetChatsOverTime,
  useGetAgentPerformance,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  Activity,
  Inbox,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function KpiCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value?: number | string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value ?? "—"}</div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardLimited() {
  const t = useT();
  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h2>
        <p className="text-muted-foreground">{t("dashboard.limitedSubtitle")}</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.noReportsAccess")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/chat">
              <Inbox className="h-4 w-4 mr-2" />
              {t("dashboard.goToInbox")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardAnalytics() {
  const t = useT();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: chatsOverTime, isLoading: chartsLoading } = useGetChatsOverTime();
  const { data: agentPerf, isLoading: agentPerfLoading } = useGetAgentPerformance();

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h2>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("dashboard.totalConversations")}
          value={stats?.totalConversations}
          icon={<MessageSquare className="h-4 w-4 text-primary" />}
          loading={statsLoading}
        />
        <KpiCard
          title={t("dashboard.activeChats")}
          value={stats?.activeChats}
          icon={<Activity className="h-4 w-4 text-amber-500" />}
          loading={statsLoading}
        />
        <KpiCard
          title={t("dashboard.completedToday")}
          value={stats?.resolvedChats}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          loading={statsLoading}
        />
        <KpiCard
          title={t("dashboard.avgResponse")}
          value={stats?.avgResponseTimeMinutes ? `${stats.avgResponseTimeMinutes}m` : "0m"}
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          loading={statsLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t("dashboard.conversationVolume")}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {chartsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chatsOverTime ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(parseISO(v), "MMM d")}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t("dashboard.agentPerformance")}</CardTitle>
          </CardHeader>
          <CardContent>
            {agentPerfLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agentPerf ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="agentName" className="text-xs" hide />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="resolved" name={t("dashboard.completedLabel")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: perms, isLoading } = useMyPermissions();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!perms?.canViewReports) {
    return <DashboardLimited />;
  }

  return <DashboardAnalytics />;
}
