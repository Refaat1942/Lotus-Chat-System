import { Router } from "express";
import { db } from "@workspace/db";
import { campaignsTable, customersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/campaigns", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(campaignsTable)
    .orderBy(desc(campaignsTable.createdAt));
  res.json(rows);
});

router.post("/campaigns", requireAuth, requireAdmin, async (req, res) => {
  const { name, channel, message, audience } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "name (min 2 chars) is required" });
    return;
  }
  if (!message || typeof message !== "string" || message.trim().length < 1) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const allowedChannels = ["whatsapp", "messenger", "instagram", "sms"];
  const ch = allowedChannels.includes(channel) ? channel : "whatsapp";

  const [row] = await db
    .insert(campaignsTable)
    .values({
      name: name.trim(),
      channel: ch,
      message: message.trim(),
      audience: typeof audience === "string" && audience ? audience : "all",
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/campaigns/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
  res.status(204).end();
});

/**
 * "Send" stub — no real provider yet. Marks the campaign as sent and records
 * a synthetic recipient count derived from the customers table so the UI has
 * meaningful numbers to show. Idempotent: re-sending updates sentAt.
 */
router.post(
  "/campaigns/:id/send",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customersTable);
    const [row] = await db
      .update(campaignsTable)
      .set({
        status: "sent",
        sentAt: new Date(),
        recipientCount: Number(count) || 0,
      })
      .where(eq(campaignsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      ...row,
      providerStatus: "stubbed",
      message:
        "Campaign queued (stub). Connect a provider to deliver real messages.",
    });
  },
);

export default router;
