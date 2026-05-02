import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, customersTable, usersTable } from "@workspace/db";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { tryAutoAssign, drainQueue } from "../lib/assignment";
import type { Server as IOServer } from "socket.io";

const router = Router();

async function getConversationWithRelations(id: number) {
  const rows = await db.select({
    id: conversationsTable.id,
    customerId: conversationsTable.customerId,
    assignedAgentId: conversationsTable.assignedAgentId,
    status: conversationsTable.status,
    tags: conversationsTable.tags,
    lastMessage: conversationsTable.lastMessage,
    lastMessageAt: conversationsTable.lastMessageAt,
    unreadCount: conversationsTable.unreadCount,
    createdAt: conversationsTable.createdAt,
    resolvedAt: conversationsTable.resolvedAt,
    queuedAt: conversationsTable.queuedAt,
    customer: {
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      branch: customersTable.branch,
      tags: customersTable.tags,
      notes: customersTable.notes,
      prescriptionNotes: customersTable.prescriptionNotes,
      createdAt: customersTable.createdAt,
    },
    assignedAgent: {
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    },
  }).from(conversationsTable)
    .leftJoin(customersTable, eq(conversationsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(conversationsTable.assignedAgentId, usersTable.id))
    .where(eq(conversationsTable.id, id));
  return rows[0] ?? null;
}

router.get("/conversations", requireAuth, async (req: AuthRequest, res) => {
  const { status, agentId, tag, search } = req.query as Record<string, string>;

  const baseQuery = db.select({
    id: conversationsTable.id,
    customerId: conversationsTable.customerId,
    assignedAgentId: conversationsTable.assignedAgentId,
    status: conversationsTable.status,
    tags: conversationsTable.tags,
    lastMessage: conversationsTable.lastMessage,
    lastMessageAt: conversationsTable.lastMessageAt,
    unreadCount: conversationsTable.unreadCount,
    createdAt: conversationsTable.createdAt,
    resolvedAt: conversationsTable.resolvedAt,
    queuedAt: conversationsTable.queuedAt,
    customer: {
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      branch: customersTable.branch,
      tags: customersTable.tags,
      notes: customersTable.notes,
      prescriptionNotes: customersTable.prescriptionNotes,
      createdAt: customersTable.createdAt,
    },
    assignedAgent: {
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    },
  }).from(conversationsTable)
    .leftJoin(customersTable, eq(conversationsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(conversationsTable.assignedAgentId, usersTable.id));

  const conditions = [];
  if (status) conditions.push(eq(conversationsTable.status, status as "open" | "resolved" | "pending"));
  if (agentId) conditions.push(eq(conversationsTable.assignedAgentId, Number(agentId)));
  if (search) conditions.push(ilike(customersTable.name, `%${search}%`));
  if (tag) conditions.push(sql<boolean>`${tag} = ANY(${conversationsTable.tags})`);
  if (req.user?.role === "agent") {
    conditions.push(eq(conversationsTable.assignedAgentId, req.user.id));
  }

  const rows = await baseQuery
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(conversationsTable.lastMessageAt));

  res.json(rows);
});

router.post("/conversations", requireAuth, async (req, res) => {
  const { customerId, tags, assignedAgentId } = req.body;
  if (!customerId) { res.status(400).json({ error: "customerId required" }); return; }
  const [conv] = await db.insert(conversationsTable).values({
    customerId, tags: tags || [], assignedAgentId: assignedAgentId || null,
  }).returning();

  // If no explicit assignee, run auto-assignment
  if (!assignedAgentId) {
    const io = req.app.get("io") as IOServer | undefined;
    await tryAutoAssign(conv.id, io);
  }

  const full = await getConversationWithRelations(conv.id);
  res.status(201).json(full);
});

router.get("/conversations/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const conv = await getConversationWithRelations(id);
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  // Agents can only view their own assigned conversations
  if (req.user?.role === "agent" && conv.assignedAgentId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(conv);
});

router.put("/conversations/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await getConversationWithRelations(id);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user?.role === "agent" && existing.assignedAgentId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const { tags, status, assignedAgentId } = req.body;
  const updates: Record<string, unknown> = {};
  if (tags !== undefined) updates.tags = tags;
  if (status !== undefined) updates.status = status;
  if (assignedAgentId !== undefined) updates.assignedAgentId = assignedAgentId;
  await db.update(conversationsTable).set(updates).where(eq(conversationsTable.id, id));
  const full = await getConversationWithRelations(id);
  res.json(full);
});

router.patch("/conversations/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await getConversationWithRelations(id);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user?.role === "agent" && existing.assignedAgentId !== null && existing.assignedAgentId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const { tags, status, assignedAgentId } = req.body;
  const updates: Record<string, unknown> = {};
  if (tags !== undefined) updates.tags = tags;
  if (status !== undefined) updates.status = status;
  if (assignedAgentId !== undefined) updates.assignedAgentId = assignedAgentId;
  if (Object.keys(updates).length === 0) { res.json(existing); return; }
  await db.update(conversationsTable).set(updates).where(eq(conversationsTable.id, id));
  const full = await getConversationWithRelations(id);
  res.json(full);
});

router.post("/conversations/:id/assign", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const { agentId } = req.body;
  const existing = await getConversationWithRelations(id);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user?.role === "agent" && existing.assignedAgentId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.update(conversationsTable).set({ assignedAgentId: agentId || null }).where(eq(conversationsTable.id, id));
  const full = await getConversationWithRelations(id);

  const io = req.app.get("io") as IOServer | undefined;
  if (io) io.to(`conv:${id}`).emit("agent_assigned", { conversationId: id, agentId });

  res.json(full);
});

router.post("/conversations/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await getConversationWithRelations(id);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (req.user?.role === "agent" && existing.assignedAgentId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.update(conversationsTable).set({ status: "resolved", resolvedAt: new Date() }).where(eq(conversationsTable.id, id));
  const full = await getConversationWithRelations(id);

  // The agent now has capacity — try to pull the next queued chat to them.
  const io = req.app.get("io") as IOServer | undefined;
  void drainQueue(io);

  res.json(full);
});

export default router;
