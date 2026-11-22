// ח.פ (company number) / עוסק מורשה (licensed dealer) number. Both are
// 9 digits; people sometimes leave out a leading zero or type dashes and
// spaces, so 8-9 digits are accepted and only the digits are stored.
// Client-safe.

export function normalizeBusinessId(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidBusinessId(value: string): boolean {
  if (!/^[\d\s\-]+$/.test(value.trim())) return false;
  return /^\d{8,9}$/.test(normalizeBusinessId(value));
}
