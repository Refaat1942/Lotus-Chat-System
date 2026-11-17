import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { requirePermission } from "../middlewares/permissions";
import { REPORTS, REPORT_BY_ID, type ReportDef, type ReportFilters } from "../lib/report-defs";
import { buildXlsx } from "../lib/xlsx";
import { logAudit } from "../lib/audit";
import { logger } from "../lib/logger";

const router = Router();
router.use("/report-exports", requireAuth, requirePermission("canViewReports"));

const CHANNELS = new Set(["whatsapp", "messenger", "instagram", "sms", "web", "email"]);
const MAX_EXPORT_ROWS = 100_000;
const DAY = 24 * 60 * 60 * 1000;

function parseFilters(req: Request): ReportFilters {
  const q = req.query as Record<string, string | undefined>;
  const date = (v: string | undefined): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  const now = new Date();
  let to = date(q.to) ?? now;
  let from = date(q.from) ?? new Date(to.getTime() - 7 * DAY);
  if (from > to) [from, to] = [to, from];
  // Cap at ~2 years so a typo cannot scan the whole history by accident.
  if (to.getTime() - from.getTime() > 731 * DAY) from = new Date(to.getTime() - 731 * DAY);
  const channel = q.channel && CHANNELS.has(q.channel) ? q.channel : null;
  const agentId = q.agentId && /^\d+$/.test(q.agentId) ? Number(q.agentId) : null;
  const tz = Number(q.tzOffset);
  const tzMin = Number.isFinite(tz) && Math.abs(tz) <= 14 * 60 ? Math.round(tz) : 0;
  return { from, to, channel, agentId, tzMin };
}

function pageParams(req: Request): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Number(req.query.pageSize) || 25;
  return { page, pageSize: Math.min(Math.max(size, 10), 500) };
}

function effective(def: ReportDef, f: ReportFilters): ReportFilters {
  return {
    ...f,
    channel: def.filters.channel ? f.channel : null,
    agentId: def.filters.agent ? f.agentId : null,
  };
}

async function fetchRows(def: ReportDef, f: ReportFilters, limit: number, offset: number) {
  const result = await db.execute(sql`
    SELECT * FROM (${def.query(f)}) AS t
    ORDER BY ${sql.raw(def.orderBy)}
    LIMIT ${limit} OFFSET ${offset}`);
  const rows = (result.rows ?? []) as Record<string, unknown>[];
  const stamps = def.columns.filter((c) => c.type === "datetime").map((c) => c.key);
  for (const r of rows) for (const k of stamps) r[k] = toIso(r[k]);
  return def.mapRow ? rows.map(def.mapRow) : rows;
}

/** Timestamps are stored as UTC without a zone; mark them as UTC explicitly. */
function toIso(v: unknown): unknown {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
    const d = new Date(s.replace(" ", "T") + "Z");
    return isNaN(d.getTime()) ? s : d.toISOString();
  }
  return s;
}

async function countRows(def: ReportDef, f: ReportFilters): Promise<number> {
  const result = await db.execute(sql`SELECT COUNT(*)::int AS n FROM (${def.query(f)}) AS t`);
  return Number((result.rows?.[0] as { n?: number } | undefined)?.n ?? 0);
}

function getDef(req: Request, res: Response): ReportDef | null {
  const def = REPORT_BY_ID.get(String(req.params.id));
  if (!def) {
    res.status(404).json({ error: "Unknown report" });
    return null;
  }
  return def;
}

/** Catalogue for the report picker. */
router.get("/report-exports", (_req, res) => {
  res.json(
    REPORTS.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      description: r.description,
      dateHint: r.dateHint,
      filters: r.filters,
      columns: r.columns.map((c) => ({ key: c.key, label: c.label, type: c.type ?? "text", wide: (c.width ?? 0) >= 35 })),
    })),
  );
});

/** One page of a report for the on-screen table. */
router.get("/report-exports/:id", async (req, res) => {
  const def = getDef(req, res);
  if (!def) return;
  const f = effective(def, parseFilters(req));
  const { page, pageSize } = pageParams(req);
  try {
    const [total, rows] = await Promise.all([
      countRows(def, f),
      fetchRows(def, f, pageSize, (page - 1) * pageSize),
    ]);
    res.json({ total, page, pageSize, rows });
  } catch (err) {
    logger.error({ err, report: def.id }, "report query failed");
    res.status(500).json({ error: "Could not build this report" });
  }
});

function fmtDay(d: Date, tzMin: number): string {
  return new Date(d.getTime() + tzMin * 60_000).toISOString().slice(0, 10);
}

/** Excel download: ?scope=page (current page) or ?scope=all (every row). */
router.get("/report-exports/:id/xlsx", async (req, res) => {
  const def = getDef(req, res);
  if (!def) return;
  const f = effective(def, parseFilters(req));
  const all = req.query.scope !== "page";
  const { page, pageSize } = pageParams(req);
  try {
    const rows = all
      ? await fetchRows(def, f, MAX_EXPORT_ROWS, 0)
      : await fetchRows(def, f, pageSize, (page - 1) * pageSize);

    const parts = [`${fmtDay(f.from, f.tzMin)} to ${fmtDay(f.to, f.tzMin)}`];
    if (f.channel) parts.push(`Channel: ${f.channel[0].toUpperCase()}${f.channel.slice(1)}`);
    if (f.agentId) {
      const r = await db.execute(sql`SELECT name FROM users WHERE id = ${f.agentId}`);
      const name = (r.rows?.[0] as { name?: string } | undefined)?.name;
      if (name) parts.push(`Agent: ${name}`);
    }
    if (!all) parts.push(`Page ${page}`);
    parts.push(`${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "row" : "rows"}`);
    if (all && rows.length >= MAX_EXPORT_ROWS) parts.push(`limited to the first ${MAX_EXPORT_ROWS.toLocaleString("en-US")}`);
    const exported = new Date(Date.now() + f.tzMin * 60_000).toISOString().slice(0, 16).replace("T", " ");

    const file = buildXlsx({
      sheetName: def.title.replace(/ Report$/, ""),
      title: `${def.title} — Lotus Pharmacies Chat System`,
      subtitle: `${parts.join(" · ")} · Exported ${exported}`,
      columns: def.columns,
      rows,
      tzOffsetMinutes: f.tzMin,
    });

    const name = `lotus-${def.id}-${fmtDay(f.from, f.tzMin)}_${fmtDay(f.to, f.tzMin)}${all ? "" : `-page${page}`}.xlsx`;
    void logAudit({
      actorId: (req as AuthRequest).user?.id,
      action: "report.exported",
      entityType: "report",
      details: { report: def.id, scope: all ? "all" : "page", rows: rows.length },
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(file));
  } catch (err) {
    logger.error({ err, report: def.id }, "report export failed");
    res.status(500).json({ error: "Could not export this report" });
  }
});

export default router;
