// Server-only: what buyers' browsers receive for a product. Use it on every
// product handed to the shop (pages and the public products API), with the
// product queried using shopProductInclude().
//
// - The exact warehouse quantity is never sent (the shop only shows in / out
//   of stock).
// - Guests (no buyer login) get no prices at all: price and salePrice are null.
// - A logged-in buyer gets their customer type's prices only; other types'
//   prices never leave the server.
import { priceForType } from "@/lib/customer-price";
import { PRODUCT_INCLUDE } from "@/lib/variant-groups";

/** PRODUCT_INCLUDE plus this customer type's price row (none for guests). */
export function shopProductInclude(customerTypeId: string | null) {
  return {
    ...PRODUCT_INCLUDE,
    // A guest matches no row ("" is never an id).
    typePrices: { where: { customerTypeId: customerTypeId ?? "" }, select: { price: true } },
  } as const;
}

type ShopQueryProduct = {
  stockQuantity?: number | null;
  price: number;
  onSale: boolean;
  salePrice: number | null;
  typePrices: { price: number }[];
};

export type PublicProduct<T extends ShopQueryProduct> = Omit<T, "stockQuantity" | "typePrices" | "price" | "salePrice"> & {
  price: number | null;
  salePrice: number | null;
};

/** `customerTypeId` null = a guest: prices are removed. */
export function toPublicProduct<T extends ShopQueryProduct>(product: T, customerTypeId: string | null): PublicProduct<T> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stockQuantity, typePrices, price, salePrice, ...rest } = product;
  if (!customerTypeId) return { ...rest, price: null, salePrice: null };
  return { ...rest, ...priceForType(product, typePrices[0]?.price) };
}
