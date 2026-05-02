import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, conversationsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import type { Server as IOServer } from "socket.io";

const router = Router();

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const convId = Number(req.params.id);
  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(asc(messagesTable.createdAt));
  res.json(messages);
});

router.post("/conversations/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const convId = Number(req.params.id);
  const { body, senderType, isNote, attachments } = req.body;
  if (!body || !senderType) {
    res.status(400).json({ error: "body and senderType required" });
    return;
  }

  const [message] = await db.insert(messagesTable).values({
    conversationId: convId,
    senderId: req.user?.id || null,
    senderType,
    body,
    attachments: attachments || [],
    isNote: isNote || false,
    status: "sent",
  }).returning();

  // Update conversation's lastMessage and lastMessageAt
  await db.update(conversationsTable).set({
    lastMessage: body,
    lastMessageAt: new Date(),
  }).where(eq(conversationsTable.id, convId));

  // Emit via socket.io
  const io: IOServer = (req as AuthRequest & { app: { get: (k: string) => IOServer } }).app.get("io");
  if (io) {
    io.to(`conv:${convId}`).emit("new_message", message);
  }

  res.status(201).json(message);
});

export default router;
