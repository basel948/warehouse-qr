// Client-safe: how a product is sold and counted (Product.unit). Labels for
// the shop and admin come from the i18n dictionaries (catalog.units.*); the
// Hebrew ones here are for server-rendered documents (order PDF), which are
// always Hebrew.

export const PRODUCT_UNIT = {
  UNIT: "UNIT",
  CARTON: "CARTON",
} as const;

export type ProductUnit = (typeof PRODUCT_UNIT)[keyof typeof PRODUCT_UNIT];

export const PRODUCT_UNITS: ProductUnit[] = [PRODUCT_UNIT.UNIT, PRODUCT_UNIT.CARTON];

export function asProductUnit(value: string | null | undefined): ProductUnit {
  return value === PRODUCT_UNIT.CARTON ? PRODUCT_UNIT.CARTON : PRODUCT_UNIT.UNIT;
}

const HEBREW: Record<ProductUnit, { one: string; many: string }> = {
  UNIT: { one: "יחידה", many: "יחידות" },
  CARTON: { one: "קרטון", many: "קרטונים" },
};

/** "1 יחידה", "10 קרטונים" (for the order PDF). */
export function formatQuantityHe(quantity: number, unit: string | null | undefined): string {
  const labels = HEBREW[asProductUnit(unit)];
  return `${quantity} ${quantity === 1 ? labels.one : labels.many}`;
}

// At or below this many, the admin shows a "low stock" badge.
export const LOW_STOCK_THRESHOLD = 5;
