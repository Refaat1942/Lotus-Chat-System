/** Meta WhatsApp Cloud API webhook payload types (subset used by this integration). */

export interface MetaWebhookPayload {
  object?: string;
  entry?: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id?: string;
  changes?: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  field?: string;
  value?: MetaWebhookValue;
}

export interface MetaWebhookValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: MetaWebhookContact[];
  messages?: MetaIncomingMessage[];
  statuses?: MetaMessageStatus[];
}

export interface MetaWebhookContact {
  wa_id?: string;
  profile?: { name?: string };
}

/** Incoming message — text supported now; other types reserved for future media support. */
export interface MetaIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  // Future: image, document, audio, video, sticker, location, etc.
}

export interface MetaMessageStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
}

export interface SendTextResult {
  wamid: string;
}

export type LocalMessageStatus = "sent" | "delivered" | "read" | "failed";
