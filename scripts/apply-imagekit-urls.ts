/**
 * Applies the Cloudinary -> ImageKit image URL switch (made on the local dev
 * database by migrate-to-imagekit.ts) to another database, e.g. production.
 *
 * Only updates a product when both its id and its current imageUrl match the
 * old Cloudinary URL in scripts/imagekit-url-map.json, so anything changed on
 * that database since is left alone. Also deletes the duplicate product
 * migrate-to-imagekit.ts removed, if it still has no orders.
 *
 * Usage (DATABASE_URL must point at the target database):
 *   npx tsx scripts/apply-imagekit-urls.ts --dry-run
 *   npx tsx scripts/apply-imagekit-urls.ts
 *
 * Safe to re-run.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const DUPLICATE_PRODUCT_ID = "cmu01lbgl002r7cixkbatjpb7";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const map: Array<{ id: string; oldUrl: string; newUrl: string }> = JSON.parse(
    fs.readFileSync("scripts/imagekit-url-map.json", "utf-8")
  );

  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/\?.*$/, "");
  console.log(`Database: ${host || "(DATABASE_URL not set)"}${dryRun ? "  [dry run]" : ""}`);

  const products = await prisma.product.findMany({
    where: { id: { in: map.map((m) => m.id) } },
    select: { id: true, imageUrl: true },
  });
  const current = new Map(products.map((p) => [p.id, p.imageUrl]));

  const toUpdate = map.filter((m) => current.get(m.id) === m.oldUrl);
  const alreadyDone = map.filter((m) => current.get(m.id) === m.newUrl).length;
  const missing = map.filter((m) => !current.has(m.id)).length;
  const changedSince = map.length - toUpdate.length - alreadyDone - missing;
  console.log(`To update: ${toUpdate.length}. Already on ImageKit: ${alreadyDone}. Product not found: ${missing}. Image changed since (skipped): ${changedSince}.`);

  const duplicate = await prisma.product.findUnique({
    where: { id: DUPLICATE_PRODUCT_ID },
    include: { _count: { select: { orderItems: true } } },
  });
  console.log(duplicate ? `Duplicate: ${duplicate.name} (orders: ${duplicate._count.orderItems})` : "Duplicate already deleted.");

  if (dryRun) return;

  for (const m of toUpdate) {
    await prisma.product.updateMany({ where: { id: m.id, imageUrl: m.oldUrl }, data: { imageUrl: m.newUrl } });
  }
  console.log(`Updated ${toUpdate.length} products.`);

  if (duplicate?._count.orderItems === 0) {
    await prisma.product.delete({ where: { id: DUPLICATE_PRODUCT_ID } });
    console.log("Deleted duplicate product.");
  } else if (duplicate) {
    console.log("Duplicate has orders - not deleting it.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
