import { Router } from "express";
import { db } from "@workspace/db";
import { quickRepliesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/quick-replies", requireAuth, async (_req, res) => {
  const replies = await db.select().from(quickRepliesTable).orderBy(quickRepliesTable.title);
  res.json(replies);
});

router.post("/quick-replies", requireAuth, requireAdmin, async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) { res.status(400).json({ error: "title and body required" }); return; }
  const [reply] = await db.insert(quickRepliesTable).values({ title, body }).returning();
  res.status(201).json(reply);
});

router.delete("/quick-replies/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(quickRepliesTable).where(eq(quickRepliesTable.id, id));
  res.status(204).send();
});

export default router;
