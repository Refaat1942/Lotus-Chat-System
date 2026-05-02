import React from "react";
import { 
  useGetDashboardStats, 
  useGetChatsOverTime, 
  useGetAgentPerformance, 
  useGetRecentActivity,
  ActivityItemType
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Users, 
  Activity,
  UserPlus,
  MessageCircle,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: chatsOverTime, isLoading: chartsLoading } = useGetChatsOverTime();
  const { data: agentPerf, isLoading: agentPerfLoading } = useGetAgentPerformance();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your pharmacy's conversational health.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard 
          title="Total Conversations" 
          value={stats?.totalConversations} 
          icon={<MessageSquare className="h-4 w-4 text-primary" />} 
          loading={statsLoading}
        />
        <KpiCard 
          title="Active Chats" 
          value={stats?.activeChats} 
          icon={<Activity className="h-4 w-4 text-amber-500" />} 
          loading={statsLoading}
        />
        <KpiCard 
          title="Resolved Today" 
          value={stats?.resolvedChats} 
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} 
          loading={statsLoading}
        />
        <KpiCard 
          title="Avg Response Time" 
          value={stats?.avgResponseTimeMinutes ? `${stats.avgResponseTimeMinutes}m` : '0m'} 
          icon={<Clock className="h-4 w-4 text-blue-500" />} 
          loading={statsLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Chats Over Time Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Conversation Volume</CardTitle>
            <CardDescription>Last 30 days of message activity</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {chartsLoading ? (
              <Skeleton className="h-[300px] w-full ml-4" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chatsOverTime || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => format(parseISO(val), "MMM d")}
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `${val}`} 
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorCount)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Performance Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Agent Resolution Performance</CardTitle>
            <CardDescription>Resolved vs Handled conversations</CardDescription>
          </CardHeader>
          <CardContent>
            {agentPerfLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentPerf || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="agentName" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Bar dataKey="totalHandled" name="Total Handled" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resolved" name="Resolved" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Live updates from the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {activity?.map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <ActivityIcon type={item.type} />
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium leading-none">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(item.createdAt), "MMM d, h:mm a")}
                        {item.agentName && ` • by ${item.agentName}`}
                      </p>
                    </div>
                  </div>
                ))}
                {activity?.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No recent activity to show.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Summary */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
             <div className="flex items-center">
                <Users className="h-9 w-9 text-muted-foreground mr-4" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Total Customers</p>
                  <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.totalCustomers}</p>
                </div>
              </div>
              <div className="flex items-center">
                <ShieldCheck className="h-9 w-9 text-muted-foreground mr-4" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Total Agents</p>
                  <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.totalAgents}</p>
                </div>
              </div>
              <div className="flex items-center">
                <MessageSquare className="h-9 w-9 text-muted-foreground mr-4" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Open Unassigned</p>
                  <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.openConversations}</p>
                </div>
              </div>
              <div className="flex items-center">
                <UserPlus className="h-9 w-9 text-muted-foreground mr-4" />
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">New Chats Today</p>
                  <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.newConversationsToday}</p>
                </div>
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, loading }: { title: string, value?: string | number, icon: React.ReactNode, loading: boolean }) {
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
          <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }: { type: ActivityItemType }) {
  const getIcon = () => {
    switch (type) {
      case "conversation_created": return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case "conversation_resolved": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "message_sent": return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
      case "agent_assigned": return <RefreshCw className="h-4 w-4 text-amber-500" />;
      case "customer_created": return <UserPlus className="h-4 w-4 text-purple-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="bg-muted rounded-full p-2 mt-0.5">
      {getIcon()}
    </div>
  );
}