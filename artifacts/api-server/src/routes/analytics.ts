import { Router } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
  usersTable,
  customersTable,
} from "@workspace/db";
import { eq, and, gte, sql, count, avg } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/analytics/dashboard", requireAuth, async (_req, res) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalConvRow] = await db.select({ count: count() }).from(conversationsTable);
  const [activeRow] = await db.select({ count: count() }).from(conversationsTable).where(eq(conversationsTable.status, "open"));
  const [resolvedRow] = await db.select({ count: count() }).from(conversationsTable).where(eq(conversationsTable.status, "resolved"));
  const [pendingRow] = await db.select({ count: count() }).from(conversationsTable).where(eq(conversationsTable.status, "pending"));
  const [newTodayRow] = await db.select({ count: count() }).from(conversationsTable).where(gte(conversationsTable.createdAt, startOfDay));
  const [totalCustomersRow] = await db.select({ count: count() }).from(customersTable);
  const [totalAgentsRow] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "agent"));

  // Avg response time: avg minutes between conversation creation and first agent message
  const avgResult = await db.execute(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (m.created_at - c.created_at)) / 60) as avg_minutes
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id AND m.sender_type = 'agent'
    WHERE m.id = (
      SELECT id FROM messages WHERE conversation_id = c.id AND sender_type = 'agent' ORDER BY created_at ASC LIMIT 1
    )
  `);

  const avgMinutes = (avgResult.rows[0] as { avg_minutes: string | null })?.avg_minutes;

  res.json({
    totalConversations: Number(totalConvRow.count),
    activeChats: Number(activeRow.count),
    resolvedChats: Number(resolvedRow.count),
    avgResponseTimeMinutes: avgMinutes ? Math.round(Number(avgMinutes) * 10) / 10 : 0,
    openConversations: Number(activeRow.count) + Number(pendingRow.count),
    newConversationsToday: Number(newTodayRow.count),
    totalCustomers: Number(totalCustomersRow.count),
    totalAgents: Number(totalAgentsRow.count),
  });
});

router.get("/analytics/chats-over-time", requireAuth, async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db.execute(sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM conversations
    WHERE created_at >= ${thirtyDaysAgo.toISOString()}
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `);

  res.json(result.rows.map((r: { date: Date; count: string }) => ({
    date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date),
    count: Number(r.count),
  })));
});

router.get("/analytics/agent-performance", requireAuth, async (_req, res) => {
  const result = await db.execute(sql`
    SELECT
      u.id as agent_id,
      u.name as agent_name,
      COUNT(DISTINCT c.id) as total_handled,
      COUNT(DISTINCT CASE WHEN c.status = 'resolved' THEN c.id END) as resolved,
      COUNT(DISTINCT CASE WHEN c.status = 'open' THEN c.id END) as active_chats,
      AVG(CASE
        WHEN m.created_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (m.created_at - c.created_at)) / 60
        ELSE NULL
      END) as avg_response_time
    FROM users u
    LEFT JOIN conversations c ON c.assigned_agent_id = u.id
    LEFT JOIN LATERAL (
      SELECT created_at FROM messages
      WHERE conversation_id = c.id AND sender_type = 'agent'
      ORDER BY created_at ASC LIMIT 1
    ) m ON true
    WHERE u.role = 'agent'
    GROUP BY u.id, u.name
    ORDER BY total_handled DESC
  `);

  res.json(result.rows.map((r: {
    agent_id: number; agent_name: string;
    total_handled: string; resolved: string;
    active_chats: string; avg_response_time: string | null;
  }) => ({
    agentId: Number(r.agent_id),
    agentName: r.agent_name,
    totalHandled: Number(r.total_handled),
    resolved: Number(r.resolved),
    activeChats: Number(r.active_chats),
    avgResponseTimeMinutes: r.avg_response_time ? Math.round(Number(r.avg_response_time) * 10) / 10 : 0,
  })));
});

router.get("/analytics/recent-activity", requireAuth, async (_req, res) => {
  const result = await db.execute(sql`
    (SELECT
      CONCAT('conv-', c.id) as id,
      'conversation_created' as type,
      CONCAT('New conversation started with ', cu.name) as description,
      NULL as agent_name,
      cu.name as customer_name,
      c.created_at
    FROM conversations c
    JOIN customers cu ON c.customer_id = cu.id
    ORDER BY c.created_at DESC LIMIT 5)

    UNION ALL

    (SELECT
      CONCAT('res-', c.id) as id,
      'conversation_resolved' as type,
      CONCAT('Conversation with ', cu.name, ' resolved') as description,
      u.name as agent_name,
      cu.name as customer_name,
      c.resolved_at as created_at
    FROM conversations c
    JOIN customers cu ON c.customer_id = cu.id
    LEFT JOIN users u ON u.id = c.assigned_agent_id
    WHERE c.status = 'resolved' AND c.resolved_at IS NOT NULL
    ORDER BY c.resolved_at DESC LIMIT 5)

    UNION ALL

    (SELECT
      CONCAT('msg-', m.id) as id,
      'message_sent' as type,
      CONCAT(u.name, ' sent a message') as description,
      u.name as agent_name,
      NULL as customer_name,
      m.created_at
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.sender_type = 'agent'
    ORDER BY m.created_at DESC LIMIT 5)

    ORDER BY created_at DESC LIMIT 20
  `);

  res.json(result.rows.map((r: {
    id: string; type: string; description: string;
    agent_name: string | null; customer_name: string | null; created_at: Date;
  }) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    agentName: r.agent_name,
    customerName: r.customer_name,
    createdAt: r.created_at,
  })));
});

router.get("/analytics/reports/export", requireAuth, async (_req, res) => {
  const result = await db.execute(sql`
    SELECT
      u.name as "Agent Name",
      COUNT(DISTINCT c.id) as "Total Handled",
      COUNT(DISTINCT CASE WHEN c.status = 'resolved' THEN c.id END) as "Resolved",
      COUNT(DISTINCT CASE WHEN c.status = 'open' THEN c.id END) as "Active Chats",
      ROUND(AVG(CASE
        WHEN m.created_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (m.created_at - c.created_at)) / 60
        ELSE NULL
      END)::numeric, 1) as "Avg Response Time (min)"
    FROM users u
    LEFT JOIN conversations c ON c.assigned_agent_id = u.id
    LEFT JOIN LATERAL (
      SELECT created_at FROM messages
      WHERE conversation_id = c.id AND sender_type = 'agent'
      ORDER BY created_at ASC LIMIT 1
    ) m ON true
    WHERE u.role = 'agent'
    GROUP BY u.id, u.name
    ORDER BY COUNT(DISTINCT c.id) DESC
  `);

  const headers = Object.keys(result.rows[0] || {}).join(",");
  const rows = result.rows.map((r: Record<string, unknown>) =>
    Object.values(r).map(v => `"${String(v ?? "")}"`).join(",")
  );
  const csv = [headers, ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=report.csv");
  res.send(csv);
});

export default router;
