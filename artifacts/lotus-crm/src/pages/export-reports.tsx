import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { customFetch, useListUsers } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  parseISO,
} from "date-fns";
import {
  Bot,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Contact,
  FileSpreadsheet,
  Loader2,
  Megaphone,
  MessagesSquare,
  Search,
  Sheet,
  Truck,
  UserRound,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ColumnType = "text" | "number" | "integer" | "decimal" | "percent" | "datetime" | "date";

interface ReportMeta {
  id: string;
  title: string;
  category: string;
  description: string;
  dateHint: string;
  filters: { channel: boolean; agent: boolean };
  columns: { key: string; label: string; type: ColumnType; wide?: boolean }[];
}

interface ReportPage {
  total: number;
  page: number;
  pageSize: number;
  rows: Record<string, unknown>[];
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Agents: UserRound,
  Chats: MessagesSquare,
  Contacts: Contact,
  Operations: Truck,
  Marketing: Megaphone,
  Bots: Bot,
};

const CHANNELS = [
  { v: "all", l: "All channels" },
  { v: "whatsapp", l: "WhatsApp" },
  { v: "messenger", l: "Messenger" },
  { v: "instagram", l: "Instagram" },
];

type Range = { from: Date; to: Date };

const PRESETS: { label: string; range: () => Range }[] = [
  { label: "Today", range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Yesterday", range: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: "Last 7 days", range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: "Last 30 days", range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: "This month", range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { label: "Last month", range: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
];

const STATUS_TONE: Record<string, string> = {
  open: "bg-info/10 text-info border-info/30",
  pending: "bg-warning/10 text-warning border-warning/30",
  completed: "bg-success/10 text-success border-success/30",
  delivered: "bg-success/10 text-success border-success/30",
  read: "bg-success/10 text-success border-success/30",
  sent: "bg-success/10 text-success border-success/30",
  approved: "bg-success/10 text-success border-success/30",
  "handed to agent": "bg-info/10 text-info border-info/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  abandoned: "bg-destructive/10 text-destructive border-destructive/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};
const BADGE_KEYS = new Set(["status", "result", "channel"]);

function readStoredReport(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("r") ?? localStorage.getItem("export-report");
  } catch {
    return null;
  }
}

function formatCell(v: unknown, type: ColumnType): string | null {
  if (v == null || v === "") return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  switch (type) {
    case "datetime": {
      const d = new Date(String(v));
      return isNaN(d.getTime()) ? String(v) : format(d, "d MMM yyyy, HH:mm");
    }
    case "date": {
      const d = parseISO(String(v));
      return isNaN(d.getTime()) ? String(v) : format(d, "EEE d MMM yyyy");
    }
    case "percent":
      return `${Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    case "decimal":
      return Number(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case "integer":
    case "number":
      return Number(v).toLocaleString("en-US");
    default:
      return String(v);
  }
}

export default function ExportReportsPage() {
  const { toast } = useToast();
  const { data: users } = useListUsers();
  const { data: catalogue, isLoading: catLoading } = useQuery({
    queryKey: ["/api/report-exports"],
    queryFn: () => customFetch<ReportMeta[]>("/api/report-exports"),
    staleTime: Infinity,
  });

  const [reportId, setReportId] = useState<string | null>(readStoredReport);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Range>(PRESETS[2].range());
  const [channel, setChannel] = useState("all");
  const [agentId, setAgentId] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState<null | "page" | "all">(null);

  const report = useMemo(
    () => catalogue?.find((r) => r.id === reportId) ?? catalogue?.[0],
    [catalogue, reportId],
  );

  useEffect(() => {
    if (!report) return;
    try {
      localStorage.setItem("export-report", report.id);
      const url = new URL(window.location.href);
      url.searchParams.set("r", report.id);
      window.history.replaceState(null, "", url);
    } catch {
      /* storage unavailable: nothing to remember */
    }
  }, [report]);

  // Any filter change starts again from the first page.
  useEffect(() => setPage(1), [report?.id, range, channel, agentId, pageSize]);

  const params = useMemo(() => {
    const p = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      tzOffset: String(-new Date().getTimezoneOffset()),
      page: String(page),
      pageSize: String(pageSize),
    });
    if (report?.filters.channel && channel !== "all") p.set("channel", channel);
    if (report?.filters.agent && agentId !== "all") p.set("agentId", agentId);
    return p;
  }, [range, page, pageSize, channel, agentId, report]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["/api/report-exports", report?.id, params.toString()],
    queryFn: () => customFetch<ReportPage>(`/api/report-exports/${report!.id}?${params}`),
    enabled: !!report,
    placeholderData: keepPreviousData,
  });

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = new Map<string, ReportMeta[]>();
    for (const r of catalogue ?? []) {
      if (q && !`${r.title} ${r.description} ${r.category}`.toLowerCase().includes(q)) continue;
      out.set(r.category, [...(out.get(r.category) ?? []), r]);
    }
    return [...out.entries()];
  }, [catalogue, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const agents = (users ?? []).filter((u) => (u as { isActive?: boolean }).isActive !== false);

  const download = async (scope: "page" | "all") => {
    if (!report) return;
    setExporting(scope);
    try {
      const blob = await customFetch<Blob>(`/api/report-exports/${report.id}/xlsx?${params}&scope=${scope}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lotus-${report.id}-${format(range.from, "yyyy-MM-dd")}_${format(range.to, "yyyy-MM-dd")}${scope === "page" ? `-page${page}` : ""}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast({ title: "Excel file ready", description: `${report.title} downloaded.` });
    } catch (e) {
      toast({
        title: "Could not export",
        description: (e as { data?: { error?: string } }).data?.error ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const presetLabel = PRESETS.find((p) => {
    const r = p.range();
    return r.from.getTime() === range.from.getTime() && r.to.getTime() === range.to.getTime();
  })?.label;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reports</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Export Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a report, set the period, preview it, and download it as an Excel file.
            </p>
          </div>
          <Button variant="outline" asChild className="h-10">
            <Link href="/reports">
              <BarChart3 className="h-4 w-4 mr-2" /> Charts & dashboard
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Report picker (desktop) */}
          <aside className="hidden lg:flex flex-col rounded-2xl border border-border bg-card shadow-sm max-h-[calc(100dvh-12rem)] sticky top-4">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find a report"
                  className="h-10 pl-9"
                  aria-label="Find a report"
                />
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-2" aria-label="Reports">
              {catLoading &&
                Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 m-1 rounded-lg" />)}
              {grouped.map(([cat, list]) => {
                const Icon = CATEGORY_ICON[cat] ?? Sheet;
                return (
                  <div key={cat} className="mb-2">
                    <p className="flex items-center gap-2 px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" /> {cat}
                    </p>
                    {list.map((r) => {
                      const active = r.id === report?.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setReportId(r.id)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "hover:bg-accent text-foreground",
                          )}
                        >
                          <span className="font-medium block leading-tight">{r.title}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {!catLoading && grouped.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground text-center">No report matches “{search}”.</p>
              )}
            </nav>
          </aside>

          <section className="min-w-0 space-y-4">
            {/* Report picker (phones / tablets) */}
            <div className="lg:hidden">
              <Select value={report?.id ?? ""} onValueChange={setReportId}>
                <SelectTrigger className="h-11" aria-label="Report">
                  <SelectValue placeholder="Choose a report" />
                </SelectTrigger>
                <SelectContent>
                  {grouped.map(([cat, list]) => (
                    <SelectGroup key={cat}>
                      <SelectLabel>{cat}</SelectLabel>
                      {list.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title + filters */}
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="p-4 sm:p-5 border-b border-border flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {report ? (
                    <>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                        <h2 className="text-lg font-bold tracking-tight truncate">{report.title}</h2>
                        <Badge variant="outline" className="hidden sm:inline-flex">{report.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                    </>
                  ) : (
                    <Skeleton className="h-10 w-72" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="h-10"
                    onClick={() => void download("page")}
                    disabled={!report || !data?.rows.length || exporting !== null}
                  >
                    {exporting === "page" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                    Export page to Excel
                  </Button>
                  <Button
                    className="h-10"
                    onClick={() => void download("all")}
                    disabled={!report || !data?.total || exporting !== null}
                  >
                    {exporting === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                    Export all to Excel
                  </Button>
                </div>
              </div>

              <div className="p-4 sm:p-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5 xl:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Period · {report?.dateHint ?? ""}</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-10 w-full justify-start font-normal">
                        <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="truncate">
                          {presetLabel ? `${presetLabel} · ` : ""}
                          {format(range.from, "d MMM yyyy")} – {format(range.to, "d MMM yyyy")}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="flex flex-col sm:flex-row">
                        <div className="flex sm:flex-col gap-1 p-2 sm:p-3 border-b sm:border-b-0 sm:border-r border-border overflow-x-auto">
                          {PRESETS.map((p) => (
                            <Button
                              key={p.label}
                              variant={presetLabel === p.label ? "secondary" : "ghost"}
                              size="sm"
                              className="justify-start shrink-0"
                              onClick={() => setRange(p.range())}
                            >
                              {p.label}
                            </Button>
                          ))}
                        </div>
                        <Calendar
                          mode="range"
                          defaultMonth={range.from}
                          selected={{ from: range.from, to: range.to }}
                          onSelect={(r) => {
                            if (r?.from) setRange({ from: startOfDay(r.from), to: endOfDay(r.to ?? r.from) });
                          }}
                          disabled={{ after: new Date() }}
                          numberOfMonths={2}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Channel</p>
                  <Select value={channel} onValueChange={setChannel} disabled={!report?.filters.channel}>
                    <SelectTrigger className="h-10" aria-label="Channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.v} value={c.v}>
                          {c.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Agent</p>
                  <Select value={agentId} onValueChange={setAgentId} disabled={!report?.filters.agent}>
                    <SelectTrigger className="h-10" aria-label="Agent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All agents</SelectItem>
                      {agents.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border">
                <p className="text-sm">
                  {data ? (
                    <>
                      <span className="font-bold">{data.total.toLocaleString("en-US")}</span>{" "}
                      <span className="text-muted-foreground">{data.total === 1 ? "row" : "rows"}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Loading…</span>
                  )}
                  {isFetching && data && <Loader2 className="inline h-3.5 w-3.5 ml-2 animate-spin text-muted-foreground" />}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground hidden sm:inline">Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-9 w-[84px]" aria-label="Rows per page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[25, 50, 100, 250].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[65dvh]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                    <TableRow className="hover:bg-transparent">
                      {report?.columns.map((c) => (
                        <TableHead
                          key={c.key}
                          className={cn(
                            "whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                            c.type !== "text" && c.type !== "datetime" && c.type !== "date" && "text-right",
                          )}
                        >
                          {c.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(isLoading || !report) &&
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {(report?.columns ?? Array.from({ length: 6 })).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    {report &&
                      data?.rows.map((row, i) => (
                        <TableRow key={i}>
                          {report.columns.map((c) => {
                            const text = formatCell(row[c.key], c.type);
                            const numeric = c.type !== "text" && c.type !== "datetime" && c.type !== "date";
                            const tone = text && BADGE_KEYS.has(c.key) ? STATUS_TONE[text.toLowerCase()] : undefined;
                            return (
                              <TableCell
                                key={c.key}
                                className={cn(
                                  "text-sm align-top",
                                  numeric && "text-right tabular-nums",
                                  (c.type === "datetime" || c.type === "date") && "whitespace-nowrap tabular-nums",
                                  c.type === "text" && (c.wide ? "min-w-[240px] max-w-[420px]" : "whitespace-nowrap"),
                                )}
                              >
                                {text == null ? (
                                  <span className="text-muted-foreground/60">—</span>
                                ) : BADGE_KEYS.has(c.key) ? (
                                  <Badge variant="outline" className={cn("font-medium whitespace-nowrap", tone)}>
                                    {text}
                                  </Badge>
                                ) : (
                                  <span className="line-clamp-3 break-words" title={text.length > 60 ? text : undefined}>
                                    {text}
                                  </span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>

                {report && data && data.rows.length === 0 && !isLoading && (
                  <div className="py-16 text-center">
                    <Sheet className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-3 font-medium">No data for this period</p>
                    <p className="text-sm text-muted-foreground">Try a longer period or other filters.</p>
                  </div>
                )}
                {isError && (
                  <div className="py-16 text-center">
                    <p className="font-medium">Could not load this report</p>
                    <Button variant="outline" className="mt-3" onClick={() => void refetch()}>
                      Try again
                    </Button>
                  </div>
                )}
              </div>

              {data && data.total > 0 && (
                <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-border text-sm">
                  <p className="text-muted-foreground">
                    {((data.page - 1) * data.pageSize + 1).toLocaleString("en-US")}–
                    {Math.min(data.page * data.pageSize, data.total).toLocaleString("en-US")} of{" "}
                    {data.total.toLocaleString("en-US")}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 tabular-nums">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
