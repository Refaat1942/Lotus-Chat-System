import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, conversationsTable } from "@workspace/db";
import { eq, ilike, sql, and, SQL } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/customers", requireAuth, async (req, res) => {
  const { search, tag, branch } = req.query as Record<string, string>;

  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(customersTable.name, `%${search}%`));
  if (branch) conditions.push(eq(customersTable.branch, branch));
  if (tag) conditions.push(sql`${customersTable.tags} @> ARRAY[${tag}]::text[]`);

  const customers = await db.select().from(customersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(customersTable.createdAt);

  res.json(customers);
});

router.post("/customers", requireAuth, async (req, res) => {
  const { name, phone, branch, tags, notes, prescriptionNotes } = req.body;
  if (!name || !phone) {
    res.status(400).json({ error: "name and phone required" });
    return;
  }
  const [customer] = await db.insert(customersTable).values({
    name, phone, branch: branch || null, tags: tags || [], notes: notes || null, prescriptionNotes: prescriptionNotes || null
  }).returning();
  res.status(201).json(customer);
});

router.get("/customers/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }
  res.json(customer);
});

router.put("/customers/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, phone, branch, tags, notes, prescriptionNotes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (branch !== undefined) updates.branch = branch;
  if (tags !== undefined) updates.tags = tags;
  if (notes !== undefined) updates.notes = notes;
  if (prescriptionNotes !== undefined) updates.prescriptionNotes = prescriptionNotes;
  const [customer] = await db.update(customersTable).set(updates).where(eq(customersTable.id, id)).returning();
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }
  res.json(customer);
});

router.delete("/customers/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.status(204).send();
});

router.get("/customers/:id/conversations", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const conversations = await db.select({
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
  }).from(conversationsTable)
    .leftJoin(customersTable, eq(conversationsTable.customerId, customersTable.id))
    .where(eq(conversationsTable.customerId, id))
    .orderBy(conversationsTable.createdAt);
  res.json(conversations);
});

export default router;
