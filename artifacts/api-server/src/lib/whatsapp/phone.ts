/**
 * Normalize a WhatsApp wa_id or phone string to digits-only for consistent DB matching.
 * Meta wa_id values are typically digits without a leading +.
 */
export function normalizeWhatsAppPhone(value: string): string {
  return value.replace(/\D/g, "");
}
