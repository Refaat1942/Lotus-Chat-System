import { Router } from "express";
import { db } from "@workspace/db";
import { chatReasonCategoriesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/chat-reason-categories", requireAuth, async (_req, res) => {
  const rows = await db.select().from(chatReasonCategoriesTable).orderBy(asc(chatReasonCategoriesTable.id));
  res.json(rows);
});

router.post("/chat-reason-categories", requireAuth, requireAdmin, async (req, res) => {
  const { titleAr, titleEn, isActive } = req.body || {};
  if (typeof titleAr !== "string" || typeof titleEn !== "string" || !titleAr.trim() || !titleEn.trim()) {
    res.status(400).json({ error: "titleAr and titleEn are required" });
    return;
  }
  const [row] = await db.insert(chatReasonCategoriesTable).values({
    titleAr: titleAr.trim(),
    titleEn: titleEn.trim(),
    isActive: typeof isActive === "boolean" ? isActive : true,
  }).returning();
  res.status(201).json(row);
});

router.put("/chat-reason-categories/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { titleAr, titleEn, isActive } = req.body || {};
  const updates: Record<string, unknown> = {};
  if (typeof titleAr === "string") updates.titleAr = titleAr.trim();
  if (typeof titleEn === "string") updates.titleEn = titleEn.trim();
  if (typeof isActive === "boolean") updates.isActive = isActive;
  const [row] = await db.update(chatReasonCategoriesTable)
    .set(updates)
    .where(eq(chatReasonCategoriesTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/chat-reason-categories/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(chatReasonCategoriesTable).where(eq(chatReasonCategoriesTable.id, id));
  res.status(204).send();
});

export default router;
