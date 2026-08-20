import { db } from "@workspace/db";
import {
  customersTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { Server as IOServer } from "socket.io";
import { logger } from "../logger";
import {
  buildFlowAuditMessage,
  mergeTags,
  parseFlowResponseJson,
  QUALIFIED_50K_PLUS_TAG,
  validateAndNormalizeFlowFields,
  type FlowQualificationData,
} from "./flow-response";
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

export interface IngestFlowReplyInput {
  waId: string;
  wamid: string;
  responseJson: unknown;
  metaFlowName?: string;
  profileName?: string;
}

export interface WebhookProcessResult {
  messagesProcessed: number;
  statusesProcessed: number;
  duplicatesSkipped: number;
  unsupportedSkipped: number;
  flowsProcessed: number;
  flowsSkipped: number;
}

async function findMessageByExternalId(wamid: string) {
  const [row] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.externalId, wamid))
    .limit(1);
  return row ?? null;
}

async function findOrCreateWhatsAppCustomer(
  waId: string,
  profileName?: string,
) {
  const phone = normalizeWhatsAppPhone(waId);
  if (!phone) {
    throw new Error("phone is required");
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
        name: profileName?.trim() || phone,
        phone,
        tags: ["New"],
      })
      .returning();
  } else if (profileName?.trim() && customer.name === phone) {
    await db
      .update(customersTable)
      .set({ name: profileName.trim() })
      .where(eq(customersTable.id, customer.id));
    customer = { ...customer, name: profileName.trim() };
  }

  return customer;
}

async function findOrCreateOpenWhatsAppConversation(
  customerId: number,
  lastMessage: string,
) {
  let [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.customerId, customerId),
        eq(conversationsTable.channel, "whatsapp"),
        eq(conversationsTable.status, "open"),
      ),
    )
    .limit(1);

  if (!conv) {
    [conv] = await db
      .insert(conversationsTable)
      .values({
        customerId,
        channel: "whatsapp",
        status: "open",
        lastMessage,
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
        lastMessage,
        lastMessageAt: new Date(),
        lastSenderType: "customer",
        unreadCount: (conv.unreadCount ?? 0) + 1,
      })
      .where(eq(conversationsTable.id, conv.id));
  }

  return conv;
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

  const customer = await findOrCreateWhatsAppCustomer(input.waId, input.profileName);
  const conv = await findOrCreateOpenWhatsAppConversation(customer.id, body);

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

function applyFlowQualificationToCustomer(
  customer: typeof customersTable.$inferSelect,
  flow: FlowQualificationData,
) {
  const tags = flow.budgetQualified
    ? mergeTags(customer.tags ?? [], [QUALIFIED_50K_PLUS_TAG])
    : customer.tags ?? [];

  const customerUpdates: Record<string, unknown> = {
    budgetQualified: flow.budgetQualified,
    budgetRange: flow.budgetRange,
    projectType: flow.projectType,
    projectDescription: flow.projectDescription,
    companyName: flow.companyName,
    leadSource: flow.leadSource,
    flowName: flow.flowName,
    tags,
  };

  if (flow.customerName) {
    customerUpdates.name = flow.customerName;
  }

  return { customerUpdates, tags };
}

/**
 * Ingest a WhatsApp Flow nfm_reply submission. Idempotent on wamid.
 */
export async function ingestWhatsAppFlowReply(
  input: IngestFlowReplyInput,
  io?: IOServer,
) {
  const existing = await findMessageByExternalId(input.wamid);
  if (existing) {
    return { duplicate: true as const, message: existing };
  }

  const parsed = parseFlowResponseJson(input.responseJson);
  if (!parsed) {
    throw new Error("invalid flow response_json");
  }

  const flow = validateAndNormalizeFlowFields(parsed, input.metaFlowName);
  if (!flow) {
    throw new Error("flow response failed validation");
  }

  const customer = await findOrCreateWhatsAppCustomer(input.waId, input.profileName);
  const auditBody = buildFlowAuditMessage(flow);
  const conv = await findOrCreateOpenWhatsAppConversation(customer.id, auditBody);

  if (
    flow.conversationIdFromFlow !== null &&
    flow.conversationIdFromFlow !== conv.id
  ) {
    logger.warn(
      {
        flowConversationId: flow.conversationIdFromFlow,
        linkedConversationId: conv.id,
        customerId: customer.id,
      },
      "Flow conversation_id does not match linked open WhatsApp conversation",
    );
  }

  const { customerUpdates, tags: customerTags } = applyFlowQualificationToCustomer(
    customer,
    flow,
  );

  const [updatedCustomer] = await db
    .update(customersTable)
    .set(customerUpdates)
    .where(eq(customersTable.id, customer.id))
    .returning();

  const conversationTags = flow.budgetQualified
    ? mergeTags(conv.tags ?? [], [QUALIFIED_50K_PLUS_TAG])
    : conv.tags ?? [];

  await db
    .update(conversationsTable)
    .set({ tags: conversationTags })
    .where(eq(conversationsTable.id, conv.id))
    .returning();

  let message;
  try {
    [message] = await db
      .insert(messagesTable)
      .values({
        conversationId: conv.id,
        senderType: "customer",
        body: auditBody,
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
    io.to(`conv:${conv.id}`).emit("flow_submitted", {
      conversationId: conv.id,
      customerId: updatedCustomer.id,
      messageId: message.id,
      qualified: flow.budgetQualified,
      budgetRange: flow.budgetRange,
      projectType: flow.projectType,
      flowName: flow.flowName,
      tags: conversationTags,
    });
  }

  return {
    duplicate: false as const,
    customerId: updatedCustomer.id,
    conversationId: conv.id,
    message,
    flow,
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
  if (
    msg.type === "interactive" &&
    msg.interactive?.type === "nfm_reply" &&
    msg.interactive.nfm_reply
  ) {
    try {
      const result = await ingestWhatsAppFlowReply(
        {
          waId: msg.from,
          wamid: msg.id,
          responseJson: msg.interactive.nfm_reply.response_json,
          metaFlowName: msg.interactive.nfm_reply.name,
          profileName: contactNameForWaId(contacts, msg.from),
        },
        io,
      );

      if (result.duplicate) {
        stats.duplicatesSkipped += 1;
      } else {
        stats.flowsProcessed += 1;
        stats.messagesProcessed += 1;
      }
    } catch (err) {
      stats.flowsSkipped += 1;
      logger.warn(
        { err, wamid: msg.id, from: msg.from },
        "WhatsApp Flow nfm_reply skipped",
      );
    }
    return;
  }

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
 * Handles text messages, Flow nfm_reply submissions, and status updates.
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
    flowsProcessed: 0,
    flowsSkipped: 0,
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
