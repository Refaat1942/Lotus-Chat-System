import { Router } from "express";
import { db } from "@workspace/db";
import { tagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/tags", requireAuth, async (_req, res) => {
  const tags = await db.select().from(tagsTable).orderBy(tagsTable.name);
  res.json(tags);
});

router.post("/tags", requireAuth, requireAdmin, async (req, res) => {
  const { name, color } = req.body;
  if (!name || !color) { res.status(400).json({ error: "name and color required" }); return; }
  const [tag] = await db.insert(tagsTable).values({ name, color }).returning();
  res.status(201).json(tag);
});

router.put("/tags/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, color } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (color) updates.color = color;
  const [tag] = await db.update(tagsTable).set(updates).where(eq(tagsTable.id, id)).returning();
  if (!tag) { res.status(404).json({ error: "Not found" }); return; }
  res.json(tag);
});

router.delete("/tags/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(tagsTable).where(eq(tagsTable.id, id));
  res.status(204).send();
});

export default router;
