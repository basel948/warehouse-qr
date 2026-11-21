// Single source of truth for "what does this product actually cost right now" -
// used both client-side for display/totals and server-side when an order is
// created, so a sale price can never be bypassed or spoofed from the client.
// In the shop, `price` is null for guests (prices are only sent to logged-in
// buyers, src/lib/public-product.ts); the result is then null too.
export function getEffectivePrice<P extends number | null>(product: {
  price: P;
  onSale: boolean;
  salePrice: number | null;
}): P {
  if (product.price == null) return product.price;
  return (product.onSale && product.salePrice != null ? product.salePrice : product.price) as P;
}

export function getSalePercentOff(product: {
  price: number | null;
  onSale: boolean;
  salePrice: number | null;
}): number | null {
  if (product.price == null || !product.onSale || product.salePrice == null || product.price <= 0) return null;
  return Math.round((1 - product.salePrice / product.price) * 100);
}
