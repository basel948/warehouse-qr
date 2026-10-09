// Client-safe: the one place order totals and coupon discounts are
// calculated, so the checkout window, the orders API, the PDF, emails,
// WhatsApp captions, the admin orders page and pay-later balances agree.

// Israeli VAT (מע"מ). Product prices are entered before VAT; VAT is added on
// top at checkout. New orders store the rate they were charged
// (Order.vatPercent), so a later rate change never rewrites past orders.
export const VAT_PERCENT = 18;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A coupon as checkout sees it. Empty categoryIds = whole order. */
export type CouponRule = { code: string; discountPercent: number; categoryIds: string[] };

/**
 * The coupon that discounts a product: of the coupons covering it (whole-order
 * ones, or ones for any of its categories), the biggest. Coupons never stack
 * on the same item.
 */
export function bestCouponFor(productCategoryIds: string[], coupons: CouponRule[]): CouponRule | null {
  let best: CouponRule | null = null;
  for (const coupon of coupons) {
    const covers =
      coupon.categoryIds.length === 0 || coupon.categoryIds.some((id) => productCategoryIds.includes(id));
    if (covers && (!best || coupon.discountPercent > best.discountPercent)) best = coupon;
  }
  return best;
}

export type TotalsLine = {
  price: number;
  quantity: number;
  /** This line's own coupon snapshot (orders with per-item coupons). */
  couponCode?: string | null;
  discountPercent?: number | null;
};

export type CouponDiscount = { code: string; percent: number; amount: number };

export type OrderTotals = {
  /** Items before any discount and before VAT. */
  subtotal: number;
  /** One entry per coupon that discounted something. */
  discounts: CouponDiscount[];
  discountAmount: number;
  /** After discounts, before VAT. */
  totalBeforeVat: number;
  vatPercent: number | null;
  vatAmount: number;
  /** What the buyer pays. */
  total: number;
};

/**
 * `orderCoupon` is the order-wide coupon of orders from before per-item
 * coupons; it applies to lines without their own discount. `vatPercent` null
 * = an order from before VAT was added at checkout (no VAT line).
 */
export function calculateOrderTotals(
  lines: TotalsLine[],
  orderCoupon: { couponCode: string | null; discountPercent: number | null } | null,
  vatPercent: number | null | undefined
): OrderTotals {
  let subtotal = 0;
  // Discounted amount per coupon, summed before rounding once.
  const byCoupon = new Map<string, { code: string; percent: number; base: number }>();
  for (const line of lines) {
    const amount = line.price * line.quantity;
    subtotal += amount;
    const ownCoupon = line.discountPercent ? { code: line.couponCode ?? "", percent: line.discountPercent } : null;
    const coupon =
      ownCoupon ??
      (orderCoupon?.discountPercent ? { code: orderCoupon.couponCode ?? "", percent: orderCoupon.discountPercent } : null);
    if (!coupon) continue;
    const key = `${coupon.code}|${coupon.percent}`;
    const entry = byCoupon.get(key) ?? { ...coupon, base: 0 };
    entry.base += amount;
    byCoupon.set(key, entry);
  }
  const discounts = Array.from(byCoupon.values()).map((c) => ({
    code: c.code,
    percent: c.percent,
    amount: round2(c.base * (c.percent / 100)),
  }));
  const discountAmount = round2(discounts.reduce((sum, d) => sum + d.amount, 0));
  const totalBeforeVat = round2(subtotal - discountAmount);
  const vatAmount = vatPercent ? round2(totalBeforeVat * (vatPercent / 100)) : 0;
  return {
    subtotal: round2(subtotal),
    discounts,
    discountAmount,
    totalBeforeVat,
    vatPercent: vatPercent ?? null,
    vatAmount,
    total: round2(totalBeforeVat + vatAmount),
  };
}
