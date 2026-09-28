// One-time copy of every row from the old SQLite database into Postgres.
//
// Usage (the Postgres database must already have its tables, i.e. after
// `npx prisma migrate deploy` has run against it):
//
//   npx prisma generate --schema scripts/copy-to-postgres/sqlite-source.prisma
//   SQLITE_SOURCE_URL="file:/abs/path/to/live.db" \
//   DATABASE_URL="postgresql://..." \
//   npx tsx scripts/copy-to-postgres/copy.ts
//
// IDs, timestamps and relations are copied as-is, so product links, order
// history and Cloudinary image URLs all keep working. Refuses to run if the
// target already has any data, so it can't double-insert or overwrite.

import { Prisma, PrismaClient as PostgresClient } from "@prisma/client";
// Generated from sqlite-source.prisma (same models, SQLite datasource).
import { PrismaClient as SqliteClient } from "../../node_modules/.prisma/sqlite-source-client";

const source = new SqliteClient();
const target = new PostgresClient();

async function counts(db: SqliteClient | PostgresClient) {
  const client = db as PostgresClient;
  const productCategoryLinks = (
    await client.product.findMany({ select: { categories: { select: { id: true } } } })
  ).reduce((sum, p) => sum + p.categories.length, 0);
  return {
    admin: await client.admin.count(),
    category: await client.category.count(),
    subcategory: await client.subcategory.count(),
    product: await client.product.count(),
    productCategoryLinks,
    coupon: await client.coupon.count(),
    order: await client.order.count(),
    orderItem: await client.orderItem.count(),
  };
}

async function main() {
  const before = await counts(target);
  if (Object.values(before).some((n) => n > 0)) {
    throw new Error(`Target database is not empty, refusing to copy: ${JSON.stringify(before)}`);
  }

  const admins = await source.admin.findMany();
  const categories = await source.category.findMany();
  const subcategories = await source.subcategory.findMany();
  const products = await source.product.findMany({ include: { categories: { select: { id: true } } } });
  const coupons = await source.coupon.findMany();
  const orders = await source.order.findMany();
  const orderItems = await source.orderItem.findMany();

  // All-or-nothing: a failure part-way leaves the target empty again.
  await target.$transaction(
    async (tx) => {
      await tx.admin.createMany({ data: admins });
      await tx.category.createMany({ data: categories });
      await tx.subcategory.createMany({ data: subcategories });
      await tx.product.createMany({
        data: products.map(({ categories: _categories, ...product }) => product),
      });
      // Product<->Category is an implicit many-to-many, stored in Prisma's
      // "_CategoryToProduct" join table (A = Category.id, B = Product.id).
      // Inserted in one statement - one create()+connect per product is a
      // round trip each, which is far too slow over a remote connection.
      const links = products.flatMap((product) =>
        product.categories.map((category) => Prisma.sql`(${category.id}, ${product.id})`)
      );
      if (links.length > 0) {
        await tx.$executeRaw`INSERT INTO "_CategoryToProduct" ("A", "B") VALUES ${Prisma.join(links)}`;
      }
      await tx.coupon.createMany({ data: coupons });
      await tx.order.createMany({ data: orders });
      await tx.orderItem.createMany({ data: orderItems });
    },
    { timeout: 600_000, maxWait: 60_000 }
  );

  const sourceCounts = await counts(source);
  const targetCounts = await counts(target);
  console.table({ source: sourceCounts, target: targetCounts });

  const mismatched = Object.keys(sourceCounts).filter(
    (key) => sourceCounts[key as keyof typeof sourceCounts] !== targetCounts[key as keyof typeof targetCounts]
  );
  if (mismatched.length > 0) {
    throw new Error(`Row counts differ for: ${mismatched.join(", ")}`);
  }
  console.log("Copy complete, all row counts match.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
