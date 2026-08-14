import { db } from "@workspace/db";
import {
  customersTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { Server as IOServer } from "socket.io";
import { logger } from "../logger";
import { normalizeWhatsAppPhone } from "./phone";
import type {
  LocalMessageStatus,
  MetaIncomingMessage,
  MetaMessageStatus,
  MetaWebhookPayload,
  MetaWebhookValue,
} from "./types";

export interface IngestTextMessageInput {
  waId: string;
  wamid: string;
  body: string;
  profileName?: string;
}

export interface WebhookProcessResult {
  messagesProcessed: number;
  statusesProcessed: number;
  duplicatesSkipped: number;
  unsupportedSkipped: number;
}

async function findMessageByExternalId(wamid: string) {
  const [row] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.externalId, wamid))
    .limit(1);
  return row ?? null;
}

/**
 * Ingest an inbound text message from WhatsApp (Meta or generic path).
 * Idempotent on wamid / externalId.
 */
export async function ingestWhatsAppTextMessage(
  input: IngestTextMessageInput,
  io?: IOServer,
) {
  const phone = normalizeWhatsAppPhone(input.waId);
  const body = input.body.trim();
  if (!phone || !body) {
    throw new Error("phone and message body are required");
  }

  const existing = await findMessageByExternalId(input.wamid);
  if (existing) {
    return { duplicate: true as const, message: existing };
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
        name: input.profileName?.trim() || phone,
        phone,
        tags: ["New"],
      })
      .returning();
  } else if (input.profileName?.trim() && customer.name === phone) {
    await db
      .update(customersTable)
      .set({ name: input.profileName.trim() })
      .where(eq(customersTable.id, customer.id));
    customer = { ...customer, name: input.profileName.trim() };
  }

  let [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.customerId, customer.id),
        eq(conversationsTable.channel, "whatsapp"),
        eq(conversationsTable.status, "open"),
      ),
    )
    .limit(1);

  if (!conv) {
    [conv] = await db
      .insert(conversationsTable)
      .values({
        customerId: customer.id,
        channel: "whatsapp",
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

  let message;
  try {
    [message] = await db
      .insert(messagesTable)
      .values({
        conversationId: conv.id,
        senderType: "customer",
        body,
        externalId: input.wamid,
        status: "delivered",
      })
      .returning();
  } catch (err: unknown) {
    const pgCode =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (pgCode === "23505") {
      const dup = await findMessageByExternalId(input.wamid);
      if (dup) return { duplicate: true as const, message: dup };
    }
    throw err;
  }

  if (io) {
    io.to(`conv:${conv.id}`).emit("new_message", message);
  }

  return {
    duplicate: false as const,
    customerId: customer.id,
    conversationId: conv.id,
    message,
  };
}

function mapMetaStatus(status: MetaMessageStatus["status"]): LocalMessageStatus | null {
  if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return null;
}

export async function applyWhatsAppStatusUpdate(
  statusEvent: MetaMessageStatus,
  io?: IOServer,
): Promise<{ updated: boolean; messageId?: number }> {
  const localStatus = mapMetaStatus(statusEvent.status);
  if (!localStatus) {
    return { updated: false };
  }

  const [message] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.externalId, statusEvent.id))
    .limit(1);

  if (!message) {
    logger.debug({ wamid: statusEvent.id, status: statusEvent.status }, "Status for unknown wamid");
    return { updated: false };
  }

  if (message.status === localStatus) {
    return { updated: false, messageId: message.id };
  }

  const [updated] = await db
    .update(messagesTable)
    .set({ status: localStatus })
    .where(eq(messagesTable.id, message.id))
    .returning();

  if (io && updated) {
    io.emit("message_status", { messageId: updated.id, status: localStatus });
  }

  return { updated: true, messageId: message.id };
}

function contactNameForWaId(
  contacts: Array<{ wa_id?: string; profile?: { name?: string } }> | undefined,
  waId: string,
): string | undefined {
  const normalized = normalizeWhatsAppPhone(waId);
  const match = contacts?.find(
    (c) => c.wa_id && normalizeWhatsAppPhone(c.wa_id) === normalized,
  );
  return match?.profile?.name?.trim() || undefined;
}

async function handleIncomingMetaMessage(
  msg: MetaIncomingMessage,
  contacts: MetaWebhookValue["contacts"],
  io: IOServer | undefined,
  stats: WebhookProcessResult,
) {
  if (msg.type !== "text" || !msg.text?.body) {
    stats.unsupportedSkipped += 1;
    logger.debug({ type: msg.type, wamid: msg.id }, "Skipping unsupported WhatsApp message type");
    return;
  }

  const result = await ingestWhatsAppTextMessage(
    {
      waId: msg.from,
      wamid: msg.id,
      body: msg.text.body,
      profileName: contactNameForWaId(contacts, msg.from),
    },
    io,
  );

  if (result.duplicate) {
    stats.duplicatesSkipped += 1;
  } else {
    stats.messagesProcessed += 1;
  }
}

/**
 * Process a Meta WhatsApp Cloud API webhook POST body.
 * Handles text messages and delivery/read/failed status updates.
 */
export async function processMetaWhatsAppWebhook(
  payload: MetaWebhookPayload,
  io?: IOServer,
): Promise<WebhookProcessResult> {
  const stats: WebhookProcessResult = {
    messagesProcessed: 0,
    statusesProcessed: 0,
    duplicatesSkipped: 0,
    unsupportedSkipped: 0,
  };

  if (payload.object !== "whatsapp_business_account") {
    return stats;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const value = change.value;
      if (!value) continue;

      for (const msg of value.messages ?? []) {
        await handleIncomingMetaMessage(msg, value.contacts, io, stats);
      }

      for (const status of value.statuses ?? []) {
        const result = await applyWhatsAppStatusUpdate(status, io);
        if (result.updated) {
          stats.statusesProcessed += 1;
        }
      }
    }
  }

  return stats;
}

/** Meta GET webhook verification — returns challenge string or null. */
export function verifyMetaWebhookSubscription(query: Record<string, unknown>): string | null {
  const mode = typeof query["hub.mode"] === "string" ? query["hub.mode"] : "";
  const token =
    typeof query["hub.verify_token"] === "string" ? query["hub.verify_token"] : "";
  const challenge =
    typeof query["hub.challenge"] === "string" ? query["hub.challenge"] : "";

  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!expected) return null;

  if (mode === "subscribe" && token === expected && challenge) {
    return challenge;
  }

  return null;
}
