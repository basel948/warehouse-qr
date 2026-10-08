// Server-only: warehouse stock bookkeeping (Product.stockQuantity). Products
// with a null stockQuantity aren't tracked and are never touched here.
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type StockShortage = { productId: string; name: string; available: number };

/** Total quantity per product (a cart may list a product more than once). */
export function quantitiesByProduct(items: { productId: string; quantity: number }[]): Map<string, number> {
  const needed = new Map<string, number>();
  for (const item of items) needed.set(item.productId, (needed.get(item.productId) ?? 0) + item.quantity);
  return needed;
}

/**
 * Takes the quantities off tracked products, all or nothing. Each decrement
 * only applies while enough stock is left (a conditional update), so two
 * orders racing for the last units can't both succeed. Returns the ids of the
 * tracked products it deducted, or the shortages (and throws nothing) so the
 * caller can roll the transaction back with a clear message.
 */
export async function deductStock(
  tx: Tx,
  needed: Map<string, number>
): Promise<{ ok: true; deducted: Set<string> } | { ok: false; shortages: StockShortage[] }> {
  const products = await tx.product.findMany({
    where: { id: { in: Array.from(needed.keys()) }, stockQuantity: { not: null } },
    select: { id: true, name: true, stockQuantity: true },
  });
  const shortages: StockShortage[] = [];
  for (const product of products) {
    const quantity = needed.get(product.id) ?? 0;
    const result = await tx.product.updateMany({
      where: { id: product.id, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    if (result.count === 0) {
      const current = await tx.product.findUnique({ where: { id: product.id }, select: { stockQuantity: true } });
      shortages.push({ productId: product.id, name: product.name, available: Math.max(0, current?.stockQuantity ?? 0) });
    }
  }
  if (shortages.length > 0) return { ok: false, shortages };

  const deducted = new Set(products.map((p) => p.id));
  // Sold out: show it as out of stock in the shop.
  await tx.product.updateMany({
    where: { id: { in: Array.from(deducted) }, stockQuantity: { lte: 0 } },
    data: { inStock: false },
  });
  return { ok: true, deducted };
}

/** Puts a cancelled order's deducted quantities back, and marks them restored. */
export async function restoreOrderStock(tx: Tx, orderId: string): Promise<void> {
  const lines = await tx.orderItem.findMany({ where: { orderId, stockDeducted: true } });
  for (const line of lines) {
    // Only if still tracked: a product switched to untracked keeps null.
    await tx.product.updateMany({
      where: { id: line.productId, stockQuantity: { not: null } },
      data: { stockQuantity: { increment: line.quantity }, inStock: true },
    });
  }
  await tx.orderItem.updateMany({ where: { orderId, stockDeducted: true }, data: { stockDeducted: false } });
}

/**
 * Re-applies a reopened (previously cancelled) order to the stock. Unlike a
 * new order it can't be refused, so a product short of stock goes down to 0.
 */
export async function redeductOrderStock(tx: Tx, orderId: string): Promise<void> {
  const lines = await tx.orderItem.findMany({
    where: { orderId, stockDeducted: false, product: { stockQuantity: { not: null } } },
    include: { product: { select: { stockQuantity: true } } },
  });
  for (const line of lines) {
    const left = Math.max(0, (line.product.stockQuantity ?? 0) - line.quantity);
    await tx.product.update({
      where: { id: line.productId },
      data: { stockQuantity: left, ...(left === 0 ? { inStock: false } : {}) },
    });
    await tx.orderItem.update({ where: { id: line.id }, data: { stockDeducted: true } });
  }
}
