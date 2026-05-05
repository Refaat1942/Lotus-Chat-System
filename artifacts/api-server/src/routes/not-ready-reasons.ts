import { Router } from "express";
import { db } from "@workspace/db";
import { notReadyReasonsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/not-ready-reasons", requireAuth, async (_req, res) => {
  const rows = await db.select().from(notReadyReasonsTable).orderBy(asc(notReadyReasonsTable.id));
  res.json(rows);
});

router.post("/not-ready-reasons", requireAuth, requireAdmin, async (req, res) => {
  const { key, value, isActive } = req.body || {};
  if (typeof key !== "string" || typeof value !== "string" || !key.trim() || !value.trim()) {
    res.status(400).json({ error: "key and value are required" });
    return;
  }
  try {
    const [row] = await db.insert(notReadyReasonsTable).values({
      key: key.trim().toUpperCase(),
      value: value.trim(),
      isActive: typeof isActive === "boolean" ? isActive : true,
    }).returning();
    res.status(201).json(row);
  } catch {
    res.status(409).json({ error: "key already exists" });
  }
});

router.put("/not-ready-reasons/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { key, value, isActive } = req.body || {};
  const updates: Record<string, unknown> = {};
  if (typeof key === "string") updates.key = key.trim().toUpperCase();
  if (typeof value === "string") updates.value = value.trim();
  if (typeof isActive === "boolean") updates.isActive = isActive;
  const [row] = await db.update(notReadyReasonsTable)
    .set(updates)
    .where(eq(notReadyReasonsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/not-ready-reasons/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(notReadyReasonsTable).where(eq(notReadyReasonsTable.id, id));
  res.status(204).send();
});

export default router;
