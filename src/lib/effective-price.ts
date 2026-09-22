// Single source of truth for "what does this product actually cost right now" -
// used both client-side for display/totals and server-side when an order is
// created, so a sale price can never be bypassed or spoofed from the client.
export function getEffectivePrice(product: {
  price: number;
  onSale: boolean;
  salePrice: number | null;
}): number {
  return product.onSale && product.salePrice != null ? product.salePrice : product.price;
}

export function getSalePercentOff(product: {
  price: number;
  onSale: boolean;
  salePrice: number | null;
}): number | null {
  if (!product.onSale || product.salePrice == null || product.price <= 0) return null;
  return Math.round((1 - product.salePrice / product.price) * 100);
}
