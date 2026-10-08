// What buyers' browsers receive for a product: everything except the exact
// warehouse quantity (the shop only ever shows in / out of stock). Use it on
// every product handed to the shop (pages and the public products API).
export function toPublicProduct<T extends { stockQuantity?: number | null }>(product: T): Omit<T, "stockQuantity"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stockQuantity, ...rest } = product;
  return rest;
}
