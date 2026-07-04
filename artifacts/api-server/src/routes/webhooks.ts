import { Router } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Server as IOServer } from "socket.io";
import type { Express } from "express";

const router = Router();

type Provider = "whatsapp" | "messenger" | "instagram";

interface InboundPayload {
  from?: string;
  phone?: string;
  name?: string;
  message?: string;
  body?: string;
  externalId?: string;
}

async function ingestInbound(
  provider: Provider,
  payload: InboundPayload,
  io?: IOServer,
) {
  const phone = String(payload.phone ?? payload.from ?? "").trim();
  const body = String(payload.message ?? payload.body ?? "").trim();
  if (!phone || !body) {
    throw new Error("phone/from and message/body are required");
  }

  let [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.phone, phone))
    .limit(1);

  if (!customer) {
    [customer] = await db
      .insert(customersTable)
      .values({
        name: payload.name?.trim() || phone,
        phone,
        tags: ["New"],
      })
      .returning();
  }

  let [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.customerId, customer.id),
        eq(conversationsTable.channel, provider),
        eq(conversationsTable.status, "open"),
      ),
    )
    .limit(1);

  if (!conv) {
    [conv] = await db
      .insert(conversationsTable)
      .values({
        customerId: customer.id,
        channel: provider,
        status: "open",
        lastMessage: body,
        lastMessageAt: new Date(),
        lastSenderType: "customer",
        unreadCount: 1,
      })
      .returning();
  } else {
    await db
      .update(conversationsTable)
      .set({
        status: "open",
        lastMessage: body,
        lastMessageAt: new Date(),
        lastSenderType: "customer",
        unreadCount: (conv.unreadCount ?? 0) + 1,
      })
      .where(eq(conversationsTable.id, conv.id));
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      conversationId: conv.id,
      senderType: "customer",
      body,
      status: "delivered",
    })
    .returning();

  if (io) {
    io.to(`conv:${conv.id}`).emit("new_message", message);
  }

  return { customerId: customer.id, conversationId: conv.id, messageId: message.id };
}

function verifyWebhookSecret(req: { headers: Record<string, unknown> }): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers["x-webhook-secret"] === secret;
}

router.post("/webhooks/:provider", async (req, res) => {
  if (!verifyWebhookSecret(req)) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }

  const provider = req.params.provider as Provider;
  if (!["whatsapp", "messenger", "instagram"].includes(provider)) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }

  try {
    const io = (req as unknown as { app: Express }).app.get("io") as IOServer | undefined;
    const result = await ingestInbound(provider, req.body as InboundPayload, io);
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid payload" });
  }
});

export default router;
