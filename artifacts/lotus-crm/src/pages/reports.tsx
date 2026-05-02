import React from "react";
import { 
  useGetAgentPerformance, 
  useGetChatsOverTime,
  useExportReport,
  getExportReportQueryKey
} from "@workspace/api-client-react";
import { Download, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const { data: agentPerf, isLoading: agentLoading } = useGetAgentPerformance();
  const { data: chatsOverTime, isLoading: chartsLoading } = useGetChatsOverTime();
  const { toast } = useToast();
  const [exporting, setExporting] = React.useState(false);
  const { refetch: fetchExport } = useExportReport({
    query: { queryKey: getExportReportQueryKey(), enabled: false }
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: csvData, error } = await fetchExport();
      if (error) throw error;
      const blob = new Blob([csvData ?? ""], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `lotus_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Report exported successfully" });
    } catch {
      toast({ title: "Failed to export report", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Reports</h2>
          <p className="text-muted-foreground">Analyze team efficiency and conversation volume.</p>
        </div>
        <Button onClick={handleExport} disabled={exporting} variant="outline" className="bg-card">
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-primary" />
              Volume Trend
            </CardTitle>
            <CardDescription>Daily conversation volume over 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chatsOverTime || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
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
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                    />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-500" />
              Response Analysis
            </CardTitle>
            <CardDescription>Average response time per agent</CardDescription>
          </CardHeader>
          <CardContent>
             {agentLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={agentPerf || []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
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
                      tickFormatter={(val) => `${val}m`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(val: number) => [`${val} mins`, 'Avg Response Time']}
                    />
                    <Line type="step" dataKey="avgResponseTimeMinutes" stroke="hsl(var(--chart-3))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Agent Performance Ledger</CardTitle>
          <CardDescription>Detailed metrics for all team members</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent Name</TableHead>
                <TableHead className="text-right">Total Handled</TableHead>
                <TableHead className="text-right">Resolved</TableHead>
                <TableHead className="text-right">Resolution Rate</TableHead>
                <TableHead className="text-right">Active Chats</TableHead>
                <TableHead className="text-right">Avg Response Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell align="right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell align="right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell align="right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell align="right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell align="right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : agentPerf?.map((agent) => {
                const resolutionRate = agent.totalHandled > 0 ? Math.round((agent.resolved / agent.totalHandled) * 100) : 0;
                return (
                  <TableRow key={agent.agentId}>
                    <TableCell className="font-medium">{agent.agentName}</TableCell>
                    <TableCell className="text-right">{agent.totalHandled}</TableCell>
                    <TableCell className="text-right flex justify-end items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {agent.resolved}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-muted-foreground">{resolutionRate}%</span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${resolutionRate}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{agent.activeChats}</TableCell>
                    <TableCell className="text-right">{agent.avgResponseTimeMinutes} mins</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}