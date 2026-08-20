/**
 * Meta WhatsApp Flow Data Endpoint handler — BUDGET_SCREEN data_exchange routing.
 * Separate from nfm_reply webhook completion; does not touch customer ingestion.
 */

import type { EncryptedFlowRequestBody } from "./flow-crypto";
import { decryptFlowRequest, encryptFlowResponse, FlowCryptoError } from "./flow-crypto";
import {
  buildBudgetExchangeScreenData,
  FRATELANZA_FLOW_NAME,
  FRATELANZA_FLOW_SOURCE,
  isKnownBudgetId,
  routeBudgetScreen,
} from "./flow-budget-routing";
import { verifyFlowToken } from "./flow-token";
import { verifyMetaWebhookSignature } from "./signature";

export const FLOW_DATA_API_VERSION = "3.0";
export const BUDGET_SCREEN_ID = "BUDGET_SCREEN";

export interface FlowDataEndpointEnv {
  privateKeyPem?: string;
  privateKeyPassphrase?: string;
  appSecret?: string;
  flowTokenSecret?: string;
}

export interface FlowDataEndpointHandleInput {
  encryptedBody: EncryptedFlowRequestBody;
  rawBody?: Buffer;
  signatureHeader?: string;
  env?: FlowDataEndpointEnv;
}

export interface FlowDataEndpointHandleResult {
  statusCode: number;
  body: string;
  contentType: "text/plain";
}

function readEnv(): FlowDataEndpointEnv {
  return {
    privateKeyPem: process.env.WHATSAPP_FLOW_PRIVATE_KEY,
    privateKeyPassphrase: process.env.WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    flowTokenSecret: process.env.WHATSAPP_FLOW_TOKEN_SECRET,
  };
}

function trimString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function wrapEncryptedResponse(
  response: Record<string, unknown>,
  aesKey: Buffer,
  initialVector: Buffer,
): FlowDataEndpointHandleResult {
  return {
    statusCode: 200,
    body: encryptFlowResponse(response, aesKey, initialVector),
    contentType: "text/plain",
  };
}

function budgetScreenError(message: string): Record<string, unknown> {
  return {
    version: FLOW_DATA_API_VERSION,
    screen: BUDGET_SCREEN_ID,
    data: {
      error_message: message,
    },
  };
}

/** Pure handler for decrypted Meta Flow Data API requests. */
export function handleDecryptedFlowDataRequest(
  decrypted: Record<string, unknown>,
  env: FlowDataEndpointEnv = readEnv(),
): Record<string, unknown> {
  const version = trimString(decrypted.version, 10);
  if (version !== FLOW_DATA_API_VERSION) {
    return budgetScreenError("Unsupported Flow data API version.");
  }

  const action = trimString(decrypted.action, 50);
  if (!action) {
    return budgetScreenError("Missing Flow action.");
  }

  if (action === "ping") {
    // Meta health-check spec: response contains only data.status (no version/screen).
    return {
      data: { status: "active" },
    };
  }

  const tokenResult = verifyFlowToken(decrypted.flow_token, env.flowTokenSecret);
  if (!tokenResult.ok) {
    return budgetScreenError("Invalid or expired session. Please restart the flow.");
  }

  if (action === "INIT") {
    return {
      version: FLOW_DATA_API_VERSION,
      screen: BUDGET_SCREEN_ID,
      data: {},
    };
  }

  if (action !== "data_exchange") {
    return budgetScreenError(`Unsupported action: ${action}`);
  }

  const screen = trimString(decrypted.screen, 100);
  if (screen !== BUDGET_SCREEN_ID) {
    return budgetScreenError(`Unsupported screen: ${screen ?? "unknown"}`);
  }

  const data =
    decrypted.data && typeof decrypted.data === "object" && !Array.isArray(decrypted.data)
      ? (decrypted.data as Record<string, unknown>)
      : {};

  // Never trust client-supplied budget_qualified on the data endpoint path.
  if ("budget_qualified" in data) {
    return budgetScreenError("Invalid request payload.");
  }

  const budgetRange = trimString(data.budget_range, 100);
  if (!budgetRange || !isKnownBudgetId(budgetRange)) {
    return budgetScreenError("Invalid budget range selected.");
  }

  const source = trimString(data.source, 100) ?? FRATELANZA_FLOW_SOURCE;
  const flowName = trimString(data.flow_name, 200) ?? FRATELANZA_FLOW_NAME;

  const nextScreen = routeBudgetScreen(budgetRange);
  if (!nextScreen) {
    return budgetScreenError("Invalid budget range selected.");
  }

  return {
    version: FLOW_DATA_API_VERSION,
    screen: nextScreen,
    data: buildBudgetExchangeScreenData(budgetRange, source, flowName),
  };
}

/** Full encrypted request handler for POST /api/webhooks/whatsapp/flow. */
export function handleFlowDataEndpointRequest(
  input: FlowDataEndpointHandleInput,
): FlowDataEndpointHandleResult {
  const env = input.env ?? readEnv();
  const appSecret = env.appSecret?.trim();

  if (appSecret) {
    const valid = verifyMetaWebhookSignature(
      input.rawBody,
      input.signatureHeader,
      appSecret,
    );
    if (!valid) {
      return { statusCode: 403, body: "", contentType: "text/plain" };
    }
  }

  const privateKeyPem = env.privateKeyPem?.trim();
  if (!privateKeyPem) {
    return { statusCode: 500, body: "", contentType: "text/plain" };
  }

  let decrypted: Record<string, unknown>;
  let aesKey: Buffer;
  let initialVector: Buffer;

  try {
    const result = decryptFlowRequest(
      input.encryptedBody,
      privateKeyPem,
      env.privateKeyPassphrase,
    );
    decrypted = result.decrypted;
    aesKey = result.aesKey;
    initialVector = result.initialVector;
  } catch (err) {
    if (err instanceof FlowCryptoError) {
      return { statusCode: 421, body: "", contentType: "text/plain" };
    }
    return { statusCode: 500, body: "", contentType: "text/plain" };
  }

  const response = handleDecryptedFlowDataRequest(decrypted, env);
  return wrapEncryptedResponse(response, aesKey, initialVector);
}
