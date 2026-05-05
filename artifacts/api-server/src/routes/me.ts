import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, notReadyReasonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /api/me/availability — current ready/not-ready state for the logged-in user
router.get("/me/availability", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const [row] = await db
    .select({
      notReadyReasonId: usersTable.notReadyReasonId,
      notReadySince: usersTable.notReadySince,
      reasonKey: notReadyReasonsTable.key,
      reasonValue: notReadyReasonsTable.value,
    })
    .from(usersTable)
    .leftJoin(notReadyReasonsTable, eq(usersTable.notReadyReasonId, notReadyReasonsTable.id))
    .where(eq(usersTable.id, userId))
    .limit(1);
  res.json({
    isReady: !row?.notReadyReasonId,
    notReadyReasonId: row?.notReadyReasonId ?? null,
    notReadySince: row?.notReadySince ?? null,
    notReadyReason: row?.reasonValue ?? null,
  });
});

// PATCH /api/me/availability — toggle ready / not-ready
// Body: { notReadyReasonId: number | null }
router.patch("/me/availability", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { notReadyReasonId } = req.body || {};
  if (notReadyReasonId !== null && (typeof notReadyReasonId !== "number" || !Number.isInteger(notReadyReasonId) || notReadyReasonId <= 0)) {
    res.status(400).json({ error: "notReadyReasonId must be a positive integer or null" });
    return;
  }
  if (typeof notReadyReasonId === "number") {
    const [r] = await db.select({ id: notReadyReasonsTable.id })
      .from(notReadyReasonsTable)
      .where(eq(notReadyReasonsTable.id, notReadyReasonId))
      .limit(1);
    if (!r) { res.status(400).json({ error: "Invalid not-ready reason" }); return; }
  }
  const isNotReady = notReadyReasonId !== null;
  await db.update(usersTable)
    .set({
      notReadyReasonId: isNotReady ? notReadyReasonId : null,
      notReadySince: isNotReady ? new Date() : null,
    })
    .where(eq(usersTable.id, userId));
  res.json({ ok: true, isReady: !isNotReady });
});

export default router;
