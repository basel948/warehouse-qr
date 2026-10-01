/**
 * Buyers type their phone in local Israeli format (leading 0), but the
 * WhatsApp Cloud API requires international format with no leading 0
 * (e.g. "972501234567"). Owner numbers in env vars are already stored in
 * that format, so this is a no-op for those.
 *
 * Also used as the identity of a pay-later customer, so "050-1234567",
 * "0501234567" and "+972 50 123 4567" count as the same person.
 * Client-safe (no server-only imports).
 */
export function normalizeIsraeliPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return `972${digits.slice(1)}`;
  }
  return digits;
}
