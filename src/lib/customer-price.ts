// Client-safe: what a product costs for one customer type (school,
// restaurant…). Used by the shop's server pages (toPublicProduct) and by the
// orders API, so the price a buyer sees and the price they're charged agree.

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `typePrice` is the product's price for the buyer's type (ProductTypePrice),
 * or null when the owner hasn't set one: then the base price applies. A sale
 * is the same % off for every type (salePrice is set against the base price).
 */
export function priceForType(
  product: { price: number; onSale: boolean; salePrice: number | null },
  typePrice: number | null | undefined
): { price: number; salePrice: number | null } {
  const price = typePrice ?? product.price;
  if (product.salePrice == null || product.price <= 0) return { price, salePrice: product.salePrice };
  if (typePrice == null) return { price, salePrice: product.salePrice };
  return { price, salePrice: round2(price * (product.salePrice / product.price)) };
}
