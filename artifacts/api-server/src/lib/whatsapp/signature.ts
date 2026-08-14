import crypto from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

/**
 * Validate Meta webhook X-Hub-Signature-256 header using the raw request body.
 * Uses timing-safe comparison. Returns false when secret or signature is missing.
 */
export function verifyMetaWebhookSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!rawBody || !signatureHeader || !appSecret?.trim()) {
    return false;
  }

  const header = signatureHeader.trim();
  if (!header.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const expectedHex = header.slice(SIGNATURE_PREFIX.length);
  if (!/^[0-9a-f]{64}$/i.test(expectedHex)) {
    return false;
  }

  const computed = crypto
    .createHmac("sha256", appSecret.trim())
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(expectedHex, "hex"),
    );
  } catch {
    return false;
  }
}

/** Compute signature for tests — not used in production paths. */
export function computeMetaWebhookSignature(rawBody: Buffer, appSecret: string): string {
  const hex = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return `${SIGNATURE_PREFIX}${hex}`;
}
