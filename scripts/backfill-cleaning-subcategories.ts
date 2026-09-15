/**
 * One-off backfill: creates subcategories under the "חומרי ניקוי" category
 * and assigns existing products to them by matching keywords in the product
 * name. This is a starting point, not a final classification — review and
 * fix assignments in /admin/products afterward.
 *
 * Safe to re-run: only touches products that don't already have a
 * subcategory, and subcategory creation is an upsert by (categoryId, name).
 *
 * Usage: npx tsx scripts/backfill-cleaning-subcategories.ts
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnv(file = path.join(process.cwd(), ".env")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const prisma = new PrismaClient();

const CATEGORY_NAME = "חומרי ניקוי";

const RULES: { name: string; pattern: RegExp }[] = [
  { name: "ניקוי רצפות", pattern: /רצפ|ריצפ|פרקט/ },
  { name: "ניקוי אסלה ואמבטיה", pattern: /אסל|אבנית|אמבטיה/ },
  { name: "כביסה", pattern: /כביסה|כביסת|מרכך/ },
  { name: "ניקוי כלים", pattern: /כלים/ },
  {
    name: "מטהרי אוויר",
    pattern: /אייר וויק|מרענן אוויר|תרסיס ריח|ארומתרפיה|מפזר מקלות|בקבוקוני? מילוי|בקבוקוני ריח/,
  },
  { name: "ניקוי זכוכית ומשטחים", pattern: /זכוכית|מגב חלונות|משטחי מטבח|לניקוי מטבח|מנקה מטבח/ },
  {
    name: "חיטוי וניקוי רב-תכליתי",
    pattern: /חיטוי|אנטיבקטריאלי|רב-תכליתי|רב-פעולתי|אקונומיקה|Javel|אבקת ניקוי|ניקוי כללי|נוזל מרוכז/,
  },
  { name: "אביזרי ניקוי", pattern: /כפפות|מיקרופייבר|ספוגי|צמר פלדה|יעה|Bucket|שקיות אשפה|שפשוף/ },
];

async function main() {
  const category = await prisma.category.findFirst({ where: { name: CATEGORY_NAME } });
  if (!category) {
    console.log(`Category "${CATEGORY_NAME}" not found — nothing to do.`);
    return;
  }

  const products = await prisma.product.findMany({
    where: { categoryId: category.id, subcategoryId: null },
    select: { id: true, name: true },
  });

  const subcategoryIdByName = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const product of products) {
    const rule = RULES.find((r) => r.pattern.test(product.name));
    if (!rule) continue;

    let subcategoryId = subcategoryIdByName.get(rule.name);
    if (!subcategoryId) {
      const subcategory = await prisma.subcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: rule.name } },
        update: {},
        create: { name: rule.name, categoryId: category.id, order: subcategoryIdByName.size },
      });
      subcategoryId = subcategory.id;
      subcategoryIdByName.set(rule.name, subcategoryId);
    }

    await prisma.product.update({ where: { id: product.id }, data: { subcategoryId } });
    counts.set(rule.name, (counts.get(rule.name) ?? 0) + 1);
  }

  const unmatched = products.length - Array.from(counts.values()).reduce((a, b) => a + b, 0);

  console.log("Assigned:");
  counts.forEach((count, name) => console.log(`  ${name}: ${count}`));
  console.log(`Left unclassified (review manually): ${unmatched}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
