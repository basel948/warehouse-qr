// Client-safe: the one place order totals are calculated, so the checkout
// window, the PDF, emails, WhatsApp captions, the admin orders page and
// pay-later balances always agree.

// Israeli VAT (מע"מ). Product prices are entered before VAT; VAT is added on
// top at checkout. New orders store the rate they were charged
// (Order.vatPercent), so a later rate change never rewrites past orders.
export const VAT_PERCENT = 18;

const round2 = (n: number) => Math.round(n * 100) / 100;

export type OrderTotals = {
  /** Items before any discount and before VAT. */
  subtotal: number;
  discountAmount: number;
  /** After discount, before VAT. */
  totalBeforeVat: number;
  vatPercent: number | null;
  vatAmount: number;
  /** What the buyer pays. */
  total: number;
};

/**
 * `vatPercent` null = an order from before VAT was added at checkout: its
 * total stays as it was then (no VAT line).
 */
export function calculateOrderTotals(
  subtotal: number,
  discountPercent: number | null | undefined,
  vatPercent: number | null | undefined
): OrderTotals {
  const discountAmount = discountPercent ? round2(subtotal * (discountPercent / 100)) : 0;
  const totalBeforeVat = round2(subtotal - discountAmount);
  const vatAmount = vatPercent ? round2(totalBeforeVat * (vatPercent / 100)) : 0;
  return {
    subtotal: round2(subtotal),
    discountAmount,
    totalBeforeVat,
    vatPercent: vatPercent ?? null,
    vatAmount,
    total: round2(totalBeforeVat + vatAmount),
  };
}
