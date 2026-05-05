import { Router } from "express";
import { db } from "@workspace/db";
import { chatReasonsTable, chatReasonCategoriesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/chat-reasons", requireAuth, async (_req, res) => {
  const rows = await db
    .select({
      id: chatReasonsTable.id,
      nameAr: chatReasonsTable.nameAr,
      nameEn: chatReasonsTable.nameEn,
      color: chatReasonsTable.color,
      categoryId: chatReasonsTable.categoryId,
      isActive: chatReasonsTable.isActive,
      createdAt: chatReasonsTable.createdAt,
      categoryTitleEn: chatReasonCategoriesTable.titleEn,
      categoryTitleAr: chatReasonCategoriesTable.titleAr,
    })
    .from(chatReasonsTable)
    .leftJoin(
      chatReasonCategoriesTable,
      eq(chatReasonsTable.categoryId, chatReasonCategoriesTable.id),
    )
    .orderBy(asc(chatReasonsTable.id));
  res.json(rows);
});

router.post("/chat-reasons", requireAuth, requireAdmin, async (req, res) => {
  const { nameAr, nameEn, color, categoryId, isActive } = req.body || {};
  if (typeof nameAr !== "string" || typeof nameEn !== "string" || !nameAr.trim() || !nameEn.trim()) {
    res.status(400).json({ error: "nameAr and nameEn are required" });
    return;
  }
  const [row] = await db.insert(chatReasonsTable).values({
    nameAr: nameAr.trim(),
    nameEn: nameEn.trim(),
    color: typeof color === "string" && color.trim() ? color.trim() : "#FCA5A5",
    categoryId: typeof categoryId === "number" ? categoryId : null,
    isActive: typeof isActive === "boolean" ? isActive : true,
  }).returning();
  res.status(201).json(row);
});

router.put("/chat-reasons/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { nameAr, nameEn, color, categoryId, isActive } = req.body || {};
  const updates: Record<string, unknown> = {};
  if (typeof nameAr === "string") updates.nameAr = nameAr.trim();
  if (typeof nameEn === "string") updates.nameEn = nameEn.trim();
  if (typeof color === "string") updates.color = color.trim();
  if (categoryId === null || typeof categoryId === "number") updates.categoryId = categoryId;
  if (typeof isActive === "boolean") updates.isActive = isActive;
  const [row] = await db.update(chatReasonsTable)
    .set(updates)
    .where(eq(chatReasonsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/chat-reasons/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(chatReasonsTable).where(eq(chatReasonsTable.id, id));
  res.status(204).send();
});

export default router;
