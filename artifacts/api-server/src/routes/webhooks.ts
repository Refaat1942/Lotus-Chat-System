import { Router } from "express";
import type { Express, Request } from "express";
import type { Server as IOServer } from "socket.io";
import { db } from "@workspace/db";
import {
  customersTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { handleFlowDataEndpointRequest } from "../lib/whatsapp/flow-data-endpoint";
import { verifyMetaWebhookSignature } from "../lib/whatsapp/signature";
import {
  processMetaWhatsAppWebhook,
  verifyMetaWebhookSubscription,
} from "../lib/whatsapp/webhook-handler";
import type { MetaWebhookPayload } from "../lib/whatsapp/types";

const router = Router();

export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

type LegacyProvider = "messenger" | "instagram";

interface LegacyInboundPayload {
  from?: string;
  phone?: string;
  name?: string;
  message?: string;
  body?: string;
  externalId?: string;
}

async function ingestLegacyInbound(
  provider: LegacyProvider,
  payload: LegacyInboundPayload,
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
      externalId: payload.externalId?.trim() || null,
    })
    .returning();

  if (io) {
    io.to(`conv:${conv.id}`).emit("new_message", message);
  }

  return {
    customerId: customer.id,
    conversationId: conv.id,
    messageId: message.id,
  };
}

function verifyLegacyWebhookSecret(req: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers["x-webhook-secret"] === secret;
}

function getIo(req: Request): IOServer | undefined {
  return (req as unknown as { app: Express }).app.get("io") as IOServer | undefined;
}

/** Meta Cloud API webhook verification (GET). */
router.get("/webhooks/whatsapp", (req, res) => {
  const challenge = verifyMetaWebhookSubscription(req.query as Record<string, unknown>);
  if (challenge) {
    res.status(200).type("text/plain").send(challenge);
    return;
  }
  res.status(403).json({ error: "Forbidden" });
});

/**
 * Meta WhatsApp Flow Data Endpoint (POST).
 * Encrypted data_exchange for endpoint-powered flows — separate from nfm_reply webhook.
 */
router.post("/webhooks/whatsapp/flow", (req, res) => {
  const rawBody = (req as RequestWithRawBody).rawBody;
  const signature = req.headers["x-hub-signature-256"];

  const result = handleFlowDataEndpointRequest({
    encryptedBody: req.body as {
      encrypted_flow_data: string;
      encrypted_aes_key: string;
      initial_vector: string;
    },
    rawBody,
    signatureHeader: typeof signature === "string" ? signature : undefined,
  });

  res.status(result.statusCode);
  if (result.body) {
    res.type(result.contentType).send(result.body);
    return;
  }
  res.end();
});

/** Meta Cloud API inbound events (POST). */
router.post("/webhooks/whatsapp", async (req, res) => {
  const rawBody = (req as RequestWithRawBody).rawBody;
  const signature = req.headers["x-hub-signature-256"];
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (appSecret?.trim()) {
    const valid = verifyMetaWebhookSignature(
      rawBody,
      typeof signature === "string" ? signature : undefined,
      appSecret,
    );
    if (!valid) {
      logger.warn("WhatsApp webhook rejected: invalid signature");
      res.status(403).json({ error: "Invalid signature" });
      return;
    }
  }

  try {
    const io = getIo(req);
    const stats = await processMetaWhatsAppWebhook(req.body as MetaWebhookPayload, io);
    res.status(200).json({ ok: true, ...stats });
  } catch (err) {
    logger.error({ err }, "WhatsApp webhook processing failed");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

/** Legacy generic webhook for messenger / instagram (backward compatible). */
router.post("/webhooks/:provider", async (req, res) => {
  const provider = req.params.provider as string;

  if (provider === "whatsapp") {
    res.status(400).json({ error: "Use POST /api/webhooks/whatsapp for WhatsApp" });
    return;
  }

  if (!verifyLegacyWebhookSecret(req)) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }

  if (!["messenger", "instagram"].includes(provider)) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }

  try {
    const io = getIo(req);
    const result = await ingestLegacyInbound(
      provider as LegacyProvider,
      req.body as LegacyInboundPayload,
      io,
    );

    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Invalid payload" });
  }
});

export default router;
