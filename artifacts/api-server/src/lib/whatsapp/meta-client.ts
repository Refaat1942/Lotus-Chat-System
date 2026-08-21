import { logger } from "../logger";
import type { SendTextResult } from "./types";

const DEFAULT_GRAPH_VERSION = "v21.0";
const REQUEST_TIMEOUT_MS = 30_000;

function getGraphVersion(): string {
  return (process.env.WHATSAPP_GRAPH_API_VERSION ?? DEFAULT_GRAPH_VERSION).trim();
}

function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured");
  return id;
}

function getAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not configured");
  return token;
}

/** True when both token and phone number id are set (minimum for outbound send). */
export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
}

function graphUrl(path: string): string {
  const version = getGraphVersion();
  return `https://graph.facebook.com/${version}/${path}`;
}

/**
 * Send a plain-text WhatsApp message via Meta Graph API.
 * Returns the Meta message id (wamid). Never logs the access token.
 */
export async function sendTextMessage(to: string, body: string): Promise<SendTextResult> {
  const phoneNumberId = getPhoneNumberId();
  const accessToken = getAccessToken();
  const url = graphUrl(`${phoneNumberId}/messages`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
      signal: controller.signal,
    });

    const data = (await res.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: number; type?: string };
    };

    if (!res.ok) {
      const errMsg = data.error?.message ?? `Graph API returned HTTP ${res.status}`;
      logger.warn(
        { status: res.status, errorCode: data.error?.code, errorType: data.error?.type },
        "WhatsApp Graph API send failed",
      );
      throw new Error(errMsg);
    }

    const wamid = data.messages?.[0]?.id;
    if (!wamid) {
      throw new Error("Graph API response missing message id");
    }

    return { wamid };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn({ phoneNumberId }, "WhatsApp Graph API request timed out");
      throw new Error("WhatsApp API request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
