/**
 * Export Reports catalogue.
 *
 * Each report is a single SQL query whose column aliases match `columns[].key`.
 * The route wraps it for paging / counting and turns it into a table or an
 * .xlsx file, so adding a report = adding one entry here.
 */
import { sql, type SQL } from "drizzle-orm";
import type { XlsxColumn } from "./xlsx";

export interface ReportFilters {
  from: Date;
  to: Date;
  channel: string | null;
  agentId: number | null;
  /** Viewer's minutes east of UTC; used for per-day grouping. */
  tzMin: number;
}

export type ReportCategory = "Agents" | "Chats" | "Contacts" | "Operations" | "Marketing" | "Bots";

export interface ReportDef {
  id: string;
  title: string;
  category: ReportCategory;
  description: string;
  /** What the date range applies to, shown under the date picker. */
  dateHint: string;
  filters: { channel: boolean; agent: boolean };
  columns: XlsxColumn[];
  /** ORDER BY applied on the wrapped query (aliases are quoted column keys). */
  orderBy: string;
  query: (f: ReportFilters) => SQL;
  mapRow?: (row: Record<string, unknown>) => Record<string, unknown>;
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "user.created": "Created user",
  "user.updated": "Updated user",
  "user.activated": "Activated user",
  "user.deactivated": "Deactivated user",
  "user.deleted": "Deleted user",
  "user.reset_link_issued": "Issued password reset link",
  "permissions.role_changed": "Changed role permissions",
  "permissions.user_changed": "Changed a user's permissions",
  "conversation.assigned": "Assigned chat",
  "conversation.auto_assigned": "Chat assigned automatically",
  "conversation.bulk_assigned": "Assigned chats (bulk)",
  "conversation.takeover": "Took over chat",
  "conversation.takeover_released": "Handed chat back",
  "conversation.team_transferred": "Transferred chats to a team",
  "whisper.sent": "Sent a whisper",
  "monitor.open": "Opened an agent's chat (monitoring)",
  "settings.updated": "Changed settings",
  "templates.synced": "Synced WhatsApp templates",
  "bot.created": "Created bot",
  "bot.updated": "Updated bot",
  "bot.deleted": "Deleted bot",
  "customers.exported": "Exported customers",
  "report.exported": "Exported a report",
  "customers.imported": "Imported customers",
  "customers.merged": "Merged duplicate customers",
  "delivery.updated": "Updated a delivery",
  "driver.created": "Added driver",
  "driver.updated": "Updated driver",
  "team.created": "Created team",
  "team.updated": "Updated team",
  "team.members_changed": "Changed team members",
  "team.deleted": "Deleted team",
};

/** Human channel name for a SQL column reference (trusted, constant input). */
function channelLabel(col: string): SQL {
  return sql.raw(`CASE ${col} WHEN 'whatsapp' THEN 'WhatsApp' WHEN 'messenger' THEN 'Messenger'
    WHEN 'instagram' THEN 'Instagram' WHEN 'sms' THEN 'SMS' WHEN 'web' THEN 'Web'
    WHEN 'email' THEN 'Email' ELSE ${col} END`);
}

function chan(f: ReportFilters, col: string): SQL {
  return f.channel ? sql`AND ${sql.raw(col)} = ${f.channel}` : sql``;
}
function agent(f: ReportFilters, col: string): SQL {
  return f.agentId ? sql`AND ${sql.raw(col)} = ${f.agentId}` : sql``;
}
function between(f: ReportFilters, col: string): SQL {
  return sql`${sql.raw(col)} BETWEEN ${f.from.toISOString()} AND ${f.to.toISOString()}`;
}
function offset(f: ReportFilters): SQL {
  return sql`(${f.tzMin}::int * interval '1 minute')`;
}
const STATUS_LABEL = (col: string) =>
  sql.raw(`CASE ${col} WHEN 'open' THEN 'Open' WHEN 'pending' THEN 'Pending' WHEN 'completed' THEN 'Completed' ELSE ${col} END`);

/** First non-note, non-bot agent reply per conversation. */
const FIRST_REPLY = sql.raw(`(
  SELECT MIN(m.created_at) FROM messages m
  WHERE m.conversation_id = c.id AND m.sender_type = 'agent' AND m.is_note = false AND m.is_bot = false
)`);

export const REPORTS: ReportDef[] = [
  // ------------------------------------------------------------------ Agents
  {
    id: "agent-kpi",
    title: "Agent KPI Report",
    category: "Agents",
    description: "Chats handled, completion rate, first-response and resolution times per agent.",
    dateHint: "Chats created in this period",
    filters: { channel: true, agent: true },
    orderBy: `"chats" DESC, "agent"`,
    columns: [
      { key: "agent", label: "Agent" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "team", label: "Team" },
      { key: "chats", label: "Chats handled", type: "integer" },
      { key: "completed", label: "Completed", type: "integer" },
      { key: "open", label: "Open", type: "integer" },
      { key: "pending", label: "Pending", type: "integer" },
      { key: "completion_rate", label: "Completion rate", type: "percent" },
      { key: "messages_sent", label: "Messages sent", type: "integer" },
      { key: "avg_first_response_min", label: "Avg first response (min)", type: "decimal" },
      { key: "avg_resolution_min", label: "Avg resolution (min)", type: "decimal" },
      { key: "last_login", label: "Last sign-in", type: "datetime" },
    ],
    query: (f) => sql`
      WITH conv AS (
        SELECT c.id, c.assigned_agent_id, c.status, c.created_at, c.resolved_at, ${FIRST_REPLY} AS first_reply
        FROM conversations c
        WHERE ${between(f, "c.created_at")} ${chan(f, "c.channel")}
      ),
      msgs AS (
        SELECT m.sender_id, COUNT(*)::int AS n
        FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.sender_type = 'agent' AND m.is_note = false AND m.is_bot = false
          AND ${between(f, "m.created_at")} ${chan(f, "c.channel")}
        GROUP BY m.sender_id
      )
      SELECT u.name AS "agent", u.email AS "email", INITCAP(u.role) AS "role", tm.name AS "team",
        COUNT(conv.id)::int AS "chats",
        (COUNT(conv.id) FILTER (WHERE conv.status = 'completed'))::int AS "completed",
        (COUNT(conv.id) FILTER (WHERE conv.status = 'open'))::int AS "open",
        (COUNT(conv.id) FILTER (WHERE conv.status = 'pending'))::int AS "pending",
        ROUND(100.0 * COUNT(conv.id) FILTER (WHERE conv.status = 'completed') / NULLIF(COUNT(conv.id), 0), 1)::float AS "completion_rate",
        COALESCE(MAX(msgs.n), 0)::int AS "messages_sent",
        ROUND((AVG(EXTRACT(EPOCH FROM (conv.first_reply - conv.created_at)) / 60))::numeric, 1)::float AS "avg_first_response_min",
        ROUND((AVG(EXTRACT(EPOCH FROM (conv.resolved_at - conv.created_at)) / 60) FILTER (WHERE conv.resolved_at IS NOT NULL))::numeric, 1)::float AS "avg_resolution_min",
        u.last_login_at AS "last_login"
      FROM users u
      LEFT JOIN teams tm ON tm.id = u.team_id
      LEFT JOIN conv ON conv.assigned_agent_id = u.id
      LEFT JOIN msgs ON msgs.sender_id = u.id
      WHERE u.is_active = true ${agent(f, "u.id")}
      GROUP BY u.id, u.name, u.email, u.role, tm.name, u.last_login_at`,
  },
  {
    id: "users-activity",
    title: "Users Activity Report",
    category: "Agents",
    description: "Sign-ins, assignments, setting changes and every other action, by user.",
    dateHint: "Actions taken in this period",
    filters: { channel: false, agent: true },
    orderBy: `"time" DESC`,
    columns: [
      { key: "time", label: "Time", type: "datetime" },
      { key: "user", label: "User" },
      { key: "role", label: "Role" },
      { key: "action", label: "Action" },
      { key: "target", label: "Target" },
      { key: "details", label: "Details", width: 50 },
    ],
    query: (f) => sql`
      SELECT a.created_at AS "time", COALESCE(u.name, 'System') AS "user", INITCAP(u.role) AS "role",
        a.action AS "action",
        CASE WHEN a.entity_type IS NULL THEN NULL
             WHEN a.entity_id IS NULL THEN INITCAP(a.entity_type)
             ELSE INITCAP(a.entity_type) || ' #' || a.entity_id END AS "target",
        a.details::text AS "details"
      FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
      WHERE ${between(f, "a.created_at")} ${agent(f, "a.actor_id")}`,
    mapRow: (r) => ({ ...r, action: ACTION_LABELS[String(r.action)] ?? r.action, details: r.details === "null" ? null : r.details }),
  },
  {
    id: "teams",
    title: "Teams Report",
    category: "Agents",
    description: "Chats routed to each team, completion and response time.",
    dateHint: "Chats created in this period",
    filters: { channel: true, agent: false },
    orderBy: `"chats" DESC, "team"`,
    columns: [
      { key: "team", label: "Team" },
      { key: "leader", label: "Team leader" },
      { key: "members", label: "Members", type: "integer" },
      { key: "chats", label: "Chats", type: "integer" },
      { key: "completed", label: "Completed", type: "integer" },
      { key: "open", label: "Open", type: "integer" },
      { key: "completion_rate", label: "Completion rate", type: "percent" },
      { key: "avg_first_response_min", label: "Avg first response (min)", type: "decimal" },
    ],
    query: (f) => sql`
      WITH conv AS (
        SELECT c.id, c.team_id, c.status, c.created_at, ${FIRST_REPLY} AS first_reply
        FROM conversations c
        WHERE ${between(f, "c.created_at")} ${chan(f, "c.channel")}
      )
      SELECT t.name AS "team", l.name AS "leader",
        (SELECT COUNT(*) FROM users mu WHERE mu.team_id = t.id AND mu.is_active)::int AS "members",
        COUNT(conv.id)::int AS "chats",
        (COUNT(conv.id) FILTER (WHERE conv.status = 'completed'))::int AS "completed",
        (COUNT(conv.id) FILTER (WHERE conv.status = 'open'))::int AS "open",
        ROUND(100.0 * COUNT(conv.id) FILTER (WHERE conv.status = 'completed') / NULLIF(COUNT(conv.id), 0), 1)::float AS "completion_rate",
        ROUND((AVG(EXTRACT(EPOCH FROM (conv.first_reply - conv.created_at)) / 60))::numeric, 1)::float AS "avg_first_response_min"
      FROM teams t
      LEFT JOIN users l ON l.id = t.leader_id
      LEFT JOIN conv ON conv.team_id = t.id
      GROUP BY t.id, t.name, l.name`,
  },
  {
    id: "agents-chat-reasons",
    title: "Agents Chat Topics Report",
    category: "Agents",
    description: "How many chats of each topic every agent handled.",
    dateHint: "Chats created in this period",
    filters: { channel: true, agent: true },
    orderBy: `"agent", "chats" DESC`,
    columns: [
      { key: "agent", label: "Agent" },
      { key: "topic", label: "Topic" },
      { key: "category", label: "Category" },
      { key: "chats", label: "Chats", type: "integer" },
      { key: "completed", label: "Completed", type: "integer" },
    ],
    query: (f) => sql`
      SELECT COALESCE(u.name, 'Unassigned') AS "agent", COALESCE(r.name_en, 'Unsorted') AS "topic",
        cat.title_en AS "category", COUNT(*)::int AS "chats",
        (COUNT(*) FILTER (WHERE c.status = 'completed'))::int AS "completed"
      FROM conversations c
      LEFT JOIN users u ON u.id = c.assigned_agent_id
      LEFT JOIN chat_reasons r ON r.id = c.chat_reason_id
      LEFT JOIN chat_reason_categories cat ON cat.id = r.category_id
      WHERE ${between(f, "c.created_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}
      GROUP BY u.name, r.name_en, cat.title_en`,
  },

  // ------------------------------------------------------------------- Chats
  {
    id: "chat-info",
    title: "Chat Information Report",
    category: "Chats",
    description: "One row per chat: customer, agent, topic, status, message counts and timings.",
    dateHint: "Chats created in this period",
    filters: { channel: true, agent: true },
    orderBy: `"created" DESC`,
    columns: [
      { key: "chat_id", label: "Chat #", type: "integer" },
      { key: "created", label: "Created", type: "datetime" },
      { key: "customer", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "channel", label: "Channel" },
      { key: "agent", label: "Agent" },
      { key: "team", label: "Team" },
      { key: "topic", label: "Topic" },
      { key: "status", label: "Status" },
      { key: "tags", label: "Tags" },
      { key: "messages", label: "Messages", type: "integer" },
      { key: "customer_messages", label: "From customer", type: "integer" },
      { key: "agent_messages", label: "From agents", type: "integer" },
      { key: "first_response_min", label: "First response (min)", type: "decimal" },
      { key: "resolved", label: "Completed at", type: "datetime" },
      { key: "resolution_min", label: "Resolution (min)", type: "decimal" },
      { key: "last_message_at", label: "Last message", type: "datetime" },
    ],
    query: (f) => sql`
      SELECT c.id AS "chat_id", c.created_at AS "created", cu.name AS "customer", cu.phone AS "phone",
        ${channelLabel("c.channel")} AS "channel", COALESCE(u.name, 'Unassigned') AS "agent", t.name AS "team",
        r.name_en AS "topic", ${STATUS_LABEL("c.status")} AS "status", c.tags AS "tags",
        COALESCE(mc.total, 0)::int AS "messages", COALESCE(mc.cust, 0)::int AS "customer_messages", COALESCE(mc.agent, 0)::int AS "agent_messages",
        ROUND((EXTRACT(EPOCH FROM (mc.first_reply - c.created_at)) / 60)::numeric, 1)::float AS "first_response_min",
        c.resolved_at AS "resolved",
        ROUND((EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 60)::numeric, 1)::float AS "resolution_min",
        c.last_message_at AS "last_message_at"
      FROM conversations c
      JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN users u ON u.id = c.assigned_agent_id
      LEFT JOIN teams t ON t.id = c.team_id
      LEFT JOIN chat_reasons r ON r.id = c.chat_reason_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE NOT m.is_note) AS total,
          COUNT(*) FILTER (WHERE m.sender_type = 'customer') AS cust,
          COUNT(*) FILTER (WHERE m.sender_type = 'agent' AND NOT m.is_note) AS agent,
          MIN(m.created_at) FILTER (WHERE m.sender_type = 'agent' AND NOT m.is_note AND NOT m.is_bot) AS first_reply
        FROM messages m WHERE m.conversation_id = c.id
      ) mc ON true
      WHERE ${between(f, "c.created_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}`,
  },
  {
    id: "chat-status",
    title: "Chat Status Report",
    category: "Chats",
    description: "Day by day: new chats, completed, still open, pending and unassigned.",
    dateHint: "Days in this period",
    filters: { channel: true, agent: true },
    orderBy: `"date" DESC`,
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "new_chats", label: "New chats", type: "integer" },
      { key: "completed", label: "Completed that day", type: "integer" },
      { key: "still_open", label: "Still open", type: "integer" },
      { key: "pending", label: "Pending", type: "integer" },
      { key: "unassigned", label: "Unassigned", type: "integer" },
      { key: "avg_first_response_min", label: "Avg first response (min)", type: "decimal" },
    ],
    query: (f) => sql`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${f.from.toISOString()}::timestamptz AT TIME ZONE 'UTC' + ${offset(f)}),
          date_trunc('day', ${f.to.toISOString()}::timestamptz AT TIME ZONE 'UTC' + ${offset(f)}),
          interval '1 day')::date AS d
      ),
      created AS (
        SELECT (c.created_at + ${offset(f)})::date AS d, COUNT(*) AS n,
          COUNT(*) FILTER (WHERE c.status = 'open') AS open,
          COUNT(*) FILTER (WHERE c.status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE c.assigned_agent_id IS NULL) AS unassigned,
          AVG(EXTRACT(EPOCH FROM (${FIRST_REPLY} - c.created_at)) / 60) AS frt
        FROM conversations c
        WHERE ${between(f, "c.created_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}
        GROUP BY 1
      ),
      resolved AS (
        SELECT (c.resolved_at + ${offset(f)})::date AS d, COUNT(*) AS n
        FROM conversations c
        WHERE ${between(f, "c.resolved_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}
        GROUP BY 1
      )
      SELECT to_char(days.d, 'YYYY-MM-DD') AS "date",
        COALESCE(created.n, 0)::int AS "new_chats", COALESCE(resolved.n, 0)::int AS "completed",
        COALESCE(created.open, 0)::int AS "still_open", COALESCE(created.pending, 0)::int AS "pending",
        COALESCE(created.unassigned, 0)::int AS "unassigned",
        ROUND(created.frt::numeric, 1)::float AS "avg_first_response_min"
      FROM days LEFT JOIN created ON created.d = days.d LEFT JOIN resolved ON resolved.d = days.d`,
  },
  {
    id: "assigning",
    title: "Assigning Report",
    category: "Chats",
    description: "Every assignment, automatic or manual, take-overs and team transfers.",
    dateHint: "Assignments made in this period",
    filters: { channel: false, agent: true },
    orderBy: `"time" DESC`,
    columns: [
      { key: "time", label: "Time", type: "datetime" },
      { key: "action", label: "Action" },
      { key: "by", label: "Done by" },
      { key: "chat_id", label: "Chat #", type: "integer" },
      { key: "customer", label: "Customer" },
      { key: "from_agent", label: "From agent" },
      { key: "to_agent", label: "To agent / team" },
      { key: "chats", label: "Chats", type: "integer" },
    ],
    query: (f) => sql`
      SELECT a.created_at AS "time", a.action AS "action", COALESCE(actor.name, 'System') AS "by",
        a.entity_id AS "chat_id", cu.name AS "customer",
        fa.name AS "from_agent",
        COALESCE(ta.name, tt.name) AS "to_agent",
        CASE WHEN jsonb_typeof(a.details->'ids') = 'array' THEN jsonb_array_length(a.details->'ids') ELSE 1 END AS "chats"
      FROM audit_logs a
      LEFT JOIN users actor ON actor.id = a.actor_id
      LEFT JOIN conversations c ON c.id = a.entity_id AND a.entity_type = 'conversation'
      LEFT JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN users fa ON fa.id = CASE WHEN a.details->>'from' ~ '^[0-9]+$' THEN (a.details->>'from')::int END
      LEFT JOIN users ta ON ta.id = CASE WHEN a.details->>'to' ~ '^[0-9]+$' THEN (a.details->>'to')::int END
      LEFT JOIN teams tt ON tt.id = CASE WHEN a.details->>'teamId' ~ '^[0-9]+$' THEN (a.details->>'teamId')::int END
      WHERE a.action IN ('conversation.assigned', 'conversation.auto_assigned', 'conversation.bulk_assigned',
                         'conversation.takeover', 'conversation.takeover_released', 'conversation.team_transferred')
        AND ${between(f, "a.created_at")}
        ${f.agentId ? sql`AND (a.actor_id = ${f.agentId} OR a.details->>'to' = ${String(f.agentId)} OR a.details->>'from' = ${String(f.agentId)})` : sql``}`,
    mapRow: (r) => ({ ...r, action: ACTION_LABELS[String(r.action)] ?? r.action }),
  },
  {
    id: "unhandled",
    title: "Unhandled Contacts Report",
    category: "Chats",
    description: "Customers whose last message has no reply yet, longest waiting first.",
    dateHint: "Customer's last message in this period",
    filters: { channel: true, agent: true },
    orderBy: `"waiting_since" ASC`,
    columns: [
      { key: "chat_id", label: "Chat #", type: "integer" },
      { key: "customer", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "channel", label: "Channel" },
      { key: "agent", label: "Agent" },
      { key: "team", label: "Team" },
      { key: "topic", label: "Topic" },
      { key: "status", label: "Status" },
      { key: "last_message", label: "Last message", width: 45 },
      { key: "waiting_since", label: "Waiting since", type: "datetime" },
      { key: "waiting_hours", label: "Waiting (hours)", type: "decimal" },
      { key: "unread", label: "Unread", type: "integer" },
    ],
    query: (f) => sql`
      SELECT c.id AS "chat_id", cu.name AS "customer", cu.phone AS "phone", ${channelLabel("c.channel")} AS "channel",
        COALESCE(u.name, 'Unassigned') AS "agent", t.name AS "team", r.name_en AS "topic", ${STATUS_LABEL("c.status")} AS "status",
        c.last_message AS "last_message", c.last_message_at AS "waiting_since",
        ROUND((EXTRACT(EPOCH FROM (now() - c.last_message_at)) / 3600)::numeric, 1)::float AS "waiting_hours",
        c.unread_count AS "unread"
      FROM conversations c
      JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN users u ON u.id = c.assigned_agent_id
      LEFT JOIN teams t ON t.id = c.team_id
      LEFT JOIN chat_reasons r ON r.id = c.chat_reason_id
      WHERE c.status <> 'completed' AND c.last_sender_type = 'customer'
        AND ${between(f, "c.last_message_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}`,
  },
  {
    id: "hanging",
    title: "Hanging Chats Report",
    category: "Chats",
    description: "Open chats with no activity for longer than the hanging limit in Settings.",
    dateHint: "Chats created in this period",
    filters: { channel: true, agent: true },
    orderBy: `"idle_hours" DESC`,
    columns: [
      { key: "chat_id", label: "Chat #", type: "integer" },
      { key: "customer", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "channel", label: "Channel" },
      { key: "agent", label: "Agent" },
      { key: "last_sender", label: "Last message from" },
      { key: "last_message", label: "Last message", width: 45 },
      { key: "last_activity", label: "Last activity", type: "datetime" },
      { key: "idle_hours", label: "Idle (hours)", type: "decimal" },
    ],
    query: (f) => sql`
      SELECT c.id AS "chat_id", cu.name AS "customer", cu.phone AS "phone", ${channelLabel("c.channel")} AS "channel",
        COALESCE(u.name, 'Unassigned') AS "agent", INITCAP(c.last_sender_type) AS "last_sender",
        c.last_message AS "last_message", COALESCE(c.last_message_at, c.created_at) AS "last_activity",
        ROUND((EXTRACT(EPOCH FROM (now() - COALESCE(c.last_message_at, c.created_at))) / 3600)::numeric, 1)::float AS "idle_hours"
      FROM conversations c
      JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN users u ON u.id = c.assigned_agent_id
      WHERE c.status <> 'completed'
        AND COALESCE(c.last_message_at, c.created_at) < now() - ((SELECT COALESCE(MAX(hanging_hours), 24) FROM settings) * interval '1 hour')
        AND ${between(f, "c.created_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}`,
  },
  {
    id: "chat-reasons",
    title: "Chat Topics Report",
    category: "Chats",
    description: "Chats per topic with their share of all chats.",
    dateHint: "Chats created in this period",
    filters: { channel: true, agent: true },
    orderBy: `"chats" DESC`,
    columns: [
      { key: "topic", label: "Topic" },
      { key: "topic_ar", label: "Topic (Arabic)" },
      { key: "category", label: "Category" },
      { key: "chats", label: "Chats", type: "integer" },
      { key: "completed", label: "Completed", type: "integer" },
      { key: "open", label: "Open", type: "integer" },
      { key: "share", label: "Share of chats", type: "percent" },
    ],
    query: (f) => sql`
      SELECT COALESCE(r.name_en, 'Unsorted') AS "topic", r.name_ar AS "topic_ar", cat.title_en AS "category",
        COUNT(*)::int AS "chats",
        (COUNT(*) FILTER (WHERE c.status = 'completed'))::int AS "completed",
        (COUNT(*) FILTER (WHERE c.status = 'open'))::int AS "open",
        ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1)::float AS "share"
      FROM conversations c
      LEFT JOIN chat_reasons r ON r.id = c.chat_reason_id
      LEFT JOIN chat_reason_categories cat ON cat.id = r.category_id
      WHERE ${between(f, "c.created_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}
      GROUP BY r.name_en, r.name_ar, cat.title_en`,
  },
  {
    id: "tags",
    title: "Tags Report",
    category: "Chats",
    description: "How often each tag was used on chats.",
    dateHint: "Chats created in this period",
    filters: { channel: true, agent: true },
    orderBy: `"chats" DESC`,
    columns: [
      { key: "tag", label: "Tag" },
      { key: "chats", label: "Chats", type: "integer" },
      { key: "completed", label: "Completed", type: "integer" },
      { key: "share", label: "Share of tagged chats", type: "percent" },
    ],
    query: (f) => sql`
      SELECT tag AS "tag", COUNT(*)::int AS "chats",
        (COUNT(*) FILTER (WHERE c.status = 'completed'))::int AS "completed",
        ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1)::float AS "share"
      FROM conversations c, unnest(c.tags) AS tag
      WHERE ${between(f, "c.created_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}
      GROUP BY tag`,
  },

  // ---------------------------------------------------------------- Contacts
  {
    id: "contacts-info",
    title: "Contacts Info Report",
    category: "Contacts",
    description: "Contact details of every customer who chatted, with their channels and activity.",
    dateHint: "Customers with chats in this period",
    filters: { channel: true, agent: true },
    orderBy: `"last_contact" DESC NULLS LAST`,
    columns: [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "branch", label: "Branch" },
      { key: "address", label: "Address" },
      { key: "channels", label: "Channels" },
      { key: "tags", label: "Tags" },
      { key: "chats", label: "Chats in period", type: "integer" },
      { key: "first_contact", label: "First contact", type: "datetime" },
      { key: "last_contact", label: "Last contact", type: "datetime" },
      { key: "blocked", label: "Blocked" },
      { key: "created", label: "Added on", type: "datetime" },
    ],
    query: (f) => sql`
      SELECT cu.name AS "name", cu.phone AS "phone", cu.email AS "email", cu.branch AS "branch", cu.address AS "address",
        ARRAY_REMOVE(ARRAY[
          CASE WHEN EXISTS (SELECT 1 FROM conversations x WHERE x.customer_id = cu.id AND x.channel = 'whatsapp') THEN 'WhatsApp' END,
          CASE WHEN cu.messenger_psid IS NOT NULL THEN 'Messenger' END,
          CASE WHEN cu.instagram_id IS NOT NULL THEN 'Instagram' END
        ], NULL) AS "channels",
        cu.tags AS "tags", COUNT(c.id)::int AS "chats",
        (SELECT MIN(x.created_at) FROM conversations x WHERE x.customer_id = cu.id) AS "first_contact",
        MAX(COALESCE(c.last_message_at, c.created_at)) AS "last_contact",
        CASE WHEN cu.is_blocked THEN 'Yes' ELSE 'No' END AS "blocked",
        cu.created_at AS "created"
      FROM customers cu
      JOIN conversations c ON c.customer_id = cu.id
        AND (${between(f, "c.created_at")} OR ${between(f, "c.last_message_at")})
        ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}
      GROUP BY cu.id`,
  },
  {
    id: "contact-messages",
    title: "Contact Messages Report",
    category: "Contacts",
    description: "Every message sent and received, with who sent it and its delivery status.",
    dateHint: "Messages sent in this period",
    filters: { channel: true, agent: true },
    orderBy: `"time" DESC`,
    columns: [
      { key: "time", label: "Time", type: "datetime" },
      { key: "chat_id", label: "Chat #", type: "integer" },
      { key: "customer", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "channel", label: "Channel" },
      { key: "from", label: "From" },
      { key: "type", label: "Type" },
      { key: "message", label: "Message", width: 60 },
      { key: "attachments", label: "Attachments", type: "integer" },
      { key: "status", label: "Status" },
    ],
    query: (f) => sql`
      SELECT m.created_at AS "time", c.id AS "chat_id", cu.name AS "customer", cu.phone AS "phone",
        ${channelLabel("c.channel")} AS "channel",
        CASE m.sender_type WHEN 'customer' THEN 'Customer' WHEN 'system' THEN 'System' ELSE COALESCE(u.name, 'Agent') END AS "from",
        CASE WHEN m.is_note THEN 'Internal note' WHEN m.is_bot THEN 'Bot' WHEN m.template_id IS NOT NULL THEN 'Template' ELSE 'Message' END AS "type",
        m.body AS "message", COALESCE(array_length(m.attachments, 1), 0)::int AS "attachments",
        CASE WHEN m.sender_type = 'customer' THEN NULL ELSE INITCAP(m.status) END AS "status"
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN customers cu ON cu.id = c.customer_id
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE ${between(f, "m.created_at")} ${chan(f, "c.channel")} ${agent(f, "c.assigned_agent_id")}`,
  },
  {
    id: "branches",
    title: "Branches Report",
    category: "Contacts",
    description: "Customers, chats and deliveries per pharmacy branch.",
    dateHint: "Activity in this period",
    filters: { channel: true, agent: false },
    orderBy: `"chats" DESC`,
    columns: [
      { key: "branch", label: "Branch" },
      { key: "customers", label: "Customers (total)", type: "integer" },
      { key: "new_customers", label: "New customers", type: "integer" },
      { key: "chats", label: "Chats", type: "integer" },
      { key: "completed", label: "Completed", type: "integer" },
      { key: "deliveries", label: "Deliveries", type: "integer" },
    ],
    query: (f) => sql`
      SELECT COALESCE(NULLIF(cu.branch, ''), 'No branch') AS "branch",
        COUNT(DISTINCT cu.id)::int AS "customers",
        (COUNT(DISTINCT cu.id) FILTER (WHERE ${between(f, "cu.created_at")}))::int AS "new_customers",
        COUNT(DISTINCT c.id)::int AS "chats",
        (COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'completed'))::int AS "completed",
        COUNT(DISTINCT d.id)::int AS "deliveries"
      FROM customers cu
      LEFT JOIN conversations c ON c.customer_id = cu.id AND ${between(f, "c.created_at")} ${chan(f, "c.channel")}
      LEFT JOIN delivery_orders d ON d.customer_id = cu.id AND ${between(f, "d.created_at")}
      GROUP BY 1`,
  },

  // -------------------------------------------------------------- Operations
  {
    id: "deliveries",
    title: "Drivers & Deliveries Report",
    category: "Operations",
    description: "Delivery orders with driver, status, amount and delivery time.",
    dateHint: "Orders created in this period",
    filters: { channel: false, agent: true },
    orderBy: `"created" DESC`,
    columns: [
      { key: "order_number", label: "Order #" },
      { key: "created", label: "Created", type: "datetime" },
      { key: "customer", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address", width: 35 },
      { key: "driver", label: "Driver" },
      { key: "driver_group", label: "Driver group" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount", type: "decimal" },
      { key: "scheduled_for", label: "Scheduled for", type: "datetime" },
      { key: "delivered_at", label: "Delivered at", type: "datetime" },
      { key: "delivery_min", label: "Delivery time (min)", type: "decimal" },
      { key: "created_by", label: "Created by" },
    ],
    query: (f) => sql`
      SELECT d.order_number AS "order_number", d.created_at AS "created", cu.name AS "customer", cu.phone AS "phone",
        COALESCE(d.address, cu.address) AS "address", dr.name AS "driver", g.name AS "driver_group",
        INITCAP(REPLACE(d.status, '_', ' ')) AS "status", d.amount::float AS "amount",
        d.scheduled_for AS "scheduled_for", d.delivered_at AS "delivered_at",
        ROUND((EXTRACT(EPOCH FROM (d.delivered_at - d.created_at)) / 60)::numeric, 1)::float AS "delivery_min",
        u.name AS "created_by"
      FROM delivery_orders d
      JOIN customers cu ON cu.id = d.customer_id
      LEFT JOIN drivers dr ON dr.id = d.driver_id
      LEFT JOIN driver_groups g ON g.id = dr.group_id
      LEFT JOIN users u ON u.id = d.created_by
      WHERE ${between(f, "d.created_at")} ${agent(f, "d.created_by")}`,
  },

  // --------------------------------------------------------------- Marketing
  {
    id: "campaigns",
    title: "Campaign Report",
    category: "Marketing",
    description: "Broadcast campaigns with recipients, sent, failed and success rate.",
    dateHint: "Campaigns created in this period",
    filters: { channel: true, agent: false },
    orderBy: `"created" DESC`,
    columns: [
      { key: "name", label: "Campaign" },
      { key: "channel", label: "Channel" },
      { key: "audience", label: "Audience" },
      { key: "status", label: "Status" },
      { key: "recipients", label: "Recipients", type: "integer" },
      { key: "sent", label: "Sent", type: "integer" },
      { key: "failed", label: "Failed", type: "integer" },
      { key: "success_rate", label: "Success rate", type: "percent" },
      { key: "created", label: "Created", type: "datetime" },
      { key: "scheduled_at", label: "Scheduled for", type: "datetime" },
      { key: "sent_at", label: "Sent at", type: "datetime" },
      { key: "message", label: "Message", width: 50 },
    ],
    query: (f) => sql`
      SELECT k.name AS "name", ${channelLabel("k.channel")} AS "channel", k.audience AS "audience", INITCAP(k.status) AS "status",
        k.recipient_count AS "recipients", k.sent_count AS "sent", k.failed_count AS "failed",
        ROUND(100.0 * k.sent_count / NULLIF(k.recipient_count, 0), 1)::float AS "success_rate",
        k.created_at AS "created", k.scheduled_at AS "scheduled_at", k.sent_at AS "sent_at", k.message AS "message"
      FROM campaigns k
      WHERE ${between(f, "k.created_at")} ${chan(f, "k.channel")}`,
  },
  {
    id: "templates",
    title: "WhatsApp Templates Report",
    category: "Marketing",
    description: "Template messages sent and how many were delivered, read or failed.",
    dateHint: "Template messages sent in this period",
    filters: { channel: false, agent: true },
    orderBy: `"sent" DESC, "template"`,
    columns: [
      { key: "template", label: "Template" },
      { key: "language", label: "Language" },
      { key: "category", label: "Category" },
      { key: "status", label: "Meta status" },
      { key: "sent", label: "Sent in period", type: "integer" },
      { key: "delivered", label: "Delivered", type: "integer" },
      { key: "read", label: "Read", type: "integer" },
      { key: "failed", label: "Failed", type: "integer" },
      { key: "read_rate", label: "Read rate", type: "percent" },
      { key: "total_uses", label: "Uses (all time)", type: "integer" },
      { key: "last_used", label: "Last used", type: "datetime" },
    ],
    query: (f) => sql`
      SELECT t.name AS "template", t.language AS "language", INITCAP(t.category) AS "category", INITCAP(t.status) AS "status",
        COUNT(m.id)::int AS "sent",
        (COUNT(m.id) FILTER (WHERE m.status IN ('delivered', 'read')))::int AS "delivered",
        (COUNT(m.id) FILTER (WHERE m.status = 'read'))::int AS "read",
        (COUNT(m.id) FILTER (WHERE m.status = 'failed'))::int AS "failed",
        ROUND(100.0 * COUNT(m.id) FILTER (WHERE m.status = 'read') / NULLIF(COUNT(m.id), 0), 1)::float AS "read_rate",
        t.usage_count AS "total_uses", t.last_used_at AS "last_used"
      FROM whatsapp_templates t
      LEFT JOIN messages m ON m.template_id = t.id AND ${between(f, "m.created_at")} ${agent(f, "m.sender_id")}
      GROUP BY t.id`,
  },

  // -------------------------------------------------------------------- Bots
  {
    id: "survey-bot",
    title: "Bot & Survey Report",
    category: "Bots",
    description: "Every bot conversation with the customer's answers and how it ended.",
    dateHint: "Bot sessions started in this period",
    filters: { channel: true, agent: false },
    orderBy: `"started" DESC`,
    columns: [
      { key: "started", label: "Started", type: "datetime" },
      { key: "bot", label: "Bot" },
      { key: "kind", label: "Bot type" },
      { key: "customer", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "channel", label: "Channel" },
      { key: "result", label: "Result" },
      { key: "answers", label: "Answers", width: 60 },
      { key: "ended", label: "Ended", type: "datetime" },
      { key: "duration_min", label: "Duration (min)", type: "decimal" },
    ],
    query: (f) => sql`
      SELECT s.started_at AS "started", b.name AS "bot", INITCAP(b.kind) AS "kind", cu.name AS "customer", cu.phone AS "phone",
        ${channelLabel("c.channel")} AS "channel",
        CASE s.status WHEN 'completed' THEN 'Completed' WHEN 'handed_over' THEN 'Handed to agent'
          WHEN 'abandoned' THEN 'Abandoned' ELSE 'In progress' END AS "result",
        s.answers AS "answers", s.ended_at AS "ended",
        ROUND((EXTRACT(EPOCH FROM (COALESCE(s.ended_at, s.last_activity_at) - s.started_at)) / 60)::numeric, 1)::float AS "duration_min"
      FROM bot_sessions s
      JOIN bots b ON b.id = s.bot_id
      JOIN conversations c ON c.id = s.conversation_id
      JOIN customers cu ON cu.id = c.customer_id
      WHERE ${between(f, "s.started_at")} ${chan(f, "c.channel")}`,
    mapRow: (r) => {
      const a = r.answers as Record<string, unknown> | null;
      const answers = a && typeof a === "object"
        ? Object.entries(a).map(([k, v]) => `${k}: ${String(v)}`).join(" | ")
        : null;
      return { ...r, answers: answers || null };
    },
  },
];

export const REPORT_BY_ID = new Map(REPORTS.map((r) => [r.id, r]));
