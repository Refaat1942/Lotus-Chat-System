/**
 * WhatsApp Flow session token validation for the Data Endpoint.
 * Opaque tokens (Meta / Builder) pass structural checks.
 * Tokens prefixed with frl.v1. are HMAC-verified when a secret is configured.
 */

import crypto from "node:crypto";

export const FLOW_TOKEN_PREFIX = "frl.v1.";
export const MAX_FLOW_TOKEN_LENGTH = 500;
const MAX_SIGNED_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

export interface FlowTokenValidationResult {
  ok: boolean;
  reason?: string;
}

function trimToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_FLOW_TOKEN_LENGTH) return null;
  return trimmed;
}

/** Structural validation — required for every request. */
export function validateFlowTokenStructure(token: unknown): FlowTokenValidationResult {
  const trimmed = trimToken(token);
  if (!trimmed) {
    return { ok: false, reason: "flow_token is missing or invalid" };
  }
  return { ok: true };
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer | null {
  try {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    return Buffer.from(padded + "=".repeat(padLen), "base64");
  } catch {
    return null;
  }
}

/** Create an HMAC-signed flow token for outbound Flow messages. */
export function signFlowToken(payload: { nonce: string; issuedAtMs?: number }, secret: string): string {
  const issuedAtMs = payload.issuedAtMs ?? Date.now();
  const body = JSON.stringify({ n: payload.nonce, t: issuedAtMs });
  const encodedBody = base64UrlEncode(body);
  const sig = crypto.createHmac("sha256", secret.trim()).update(encodedBody).digest();
  return `${FLOW_TOKEN_PREFIX}${encodedBody}.${base64UrlEncode(sig)}`;
}

/** Verify HMAC-signed frl.v1. tokens. Opaque tokens skip HMAC when secret is unset. */
export function verifyFlowToken(token: unknown, secret?: string): FlowTokenValidationResult {
  const structural = validateFlowTokenStructure(token);
  if (!structural.ok) return structural;

  const trimmed = (token as string).trim();
  if (!trimmed.startsWith(FLOW_TOKEN_PREFIX)) {
    return { ok: true };
  }

  if (!secret?.trim()) {
    return { ok: true };
  }

  const remainder = trimmed.slice(FLOW_TOKEN_PREFIX.length);
  const dot = remainder.lastIndexOf(".");
  if (dot <= 0) {
    return { ok: false, reason: "Signed flow_token format is invalid" };
  }

  const encodedBody = remainder.slice(0, dot);
  const encodedSig = remainder.slice(dot + 1);
  const sigBuf = base64UrlDecode(encodedSig);
  const bodyBuf = base64UrlDecode(encodedBody);
  if (!sigBuf || !bodyBuf) {
    return { ok: false, reason: "Signed flow_token encoding is invalid" };
  }

  const expectedSig = crypto.createHmac("sha256", secret.trim()).update(encodedBody).digest();
  if (sigBuf.length !== expectedSig.length) {
    return { ok: false, reason: "Signed flow_token signature is invalid" };
  }

  try {
    if (!crypto.timingSafeEqual(sigBuf, expectedSig)) {
      return { ok: false, reason: "Signed flow_token signature is invalid" };
    }
  } catch {
    return { ok: false, reason: "Signed flow_token signature is invalid" };
  }

  try {
    const parsed = JSON.parse(bodyBuf.toString("utf8")) as { n?: unknown; t?: unknown };
    if (typeof parsed.t === "number" && Number.isFinite(parsed.t)) {
      const age = Date.now() - parsed.t;
      if (age > MAX_SIGNED_TOKEN_AGE_MS || age < -60_000) {
        return { ok: false, reason: "Signed flow_token has expired" };
      }
    }
  } catch {
    return { ok: false, reason: "Signed flow_token payload is invalid" };
  }

  return { ok: true };
}
