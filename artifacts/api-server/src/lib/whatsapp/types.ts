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

/** Incoming message — text and WhatsApp Flow (nfm_reply) supported. */
export interface MetaIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: MetaIncomingInteractive;
}

export interface MetaIncomingInteractive {
  type: string;
  nfm_reply?: {
    response_json?: string | Record<string, unknown>;
    body?: string;
    name?: string;
  };
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
