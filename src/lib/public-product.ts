// Server-only: what buyers' browsers receive for a product. Use it on every
// product handed to the shop (pages and the public products API).
//
// - Buyers see no prices at all (the owner prices each order by hand), so
//   price and salePrice are removed.
// - The exact warehouse quantity is never sent (the shop only shows in / out
//   of stock).

type ShopQueryProduct = {
  stockQuantity?: number | null;
  price: number;
  salePrice: number | null;
};

export type PublicProduct<T extends ShopQueryProduct> = Omit<T, "stockQuantity" | "price" | "salePrice">;

export function toPublicProduct<T extends ShopQueryProduct>(product: T): PublicProduct<T> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stockQuantity, price, salePrice, ...rest } = product;
  return rest;
}
