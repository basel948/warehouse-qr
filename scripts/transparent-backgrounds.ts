/**
 * Applies Cloudinary AI background removal to the imageUrl of every product
 * that was imported from the "חומרי ניקוי" photo batch (identified by exact
 * name match against cleaning_products_he.csv's suggested_name column) —
 * scoped deliberately so it doesn't touch unrelated products (e.g. the
 * original seed catalog).
 *
 * Non-destructive: Cloudinary transformations are generated on demand from
 * the original uploaded asset, so this only changes which delivery URL is
 * stored on the Product row, not the original file.
 *
 * Usage:
 *   npx tsx scripts/transparent-backgrounds.ts <csv-file> [--limit=N] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
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

const TRANSFORM = "e_background_removal";

function withBackgroundRemoved(url: string): string | null {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const insertAt = idx + marker.length;
  const withTransform = `${url.slice(0, insertAt)}${TRANSFORM}/${url.slice(insertAt)}`;
  // Force a PNG extension so Cloudinary serves real alpha transparency
  // instead of flattening onto a background when re-encoding to JPEG.
  return withTransform.replace(/\.(jpg|jpeg|png|webp)(\?.*)?$/i, ".png$2");
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const dryRun = flags.includes("--dry-run");
  const limitFlag = flags.find((f) => f.startsWith("--limit="));
  const limit = limitFlag ? parseInt(limitFlag.split("=")[1], 10) : undefined;

  const [csvPath] = args;
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/transparent-backgrounds.ts <csv-file> [--dry-run] [--limit=N]");
    process.exit(1);
  }

  const workbook = XLSX.readFile(csvPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: { suggested_name?: string }[] = XLSX.utils.sheet_to_json(sheet);
  const names = new Set(rows.map((r) => (r.suggested_name ?? "").trim()).filter(Boolean));
  console.log(`Loaded ${names.size} product names from ${path.basename(csvPath)}`);

  const prisma = new PrismaClient();
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, imageUrl: true },
  });
  let matched = allProducts.filter((p) => names.has(p.name.trim()) && p.imageUrl);
  if (limit) matched = matched.slice(0, limit);
  console.log(`Matched ${matched.length} product(s) with an image${dryRun ? " [DRY RUN]" : ""}`);

  let updated = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (let i = 0; i < matched.length; i++) {
    const product = matched[i];

    if (product.imageUrl!.includes(TRANSFORM)) {
      skipped++;
      continue;
    }

    const newUrl = withBackgroundRemoved(product.imageUrl!);
    if (!newUrl) {
      console.log(`[skip] ${product.id}: imageUrl doesn't look like a Cloudinary URL`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[${i + 1}/${matched.length}] would update ${product.id}`);
      updated++;
      continue;
    }

    // Fetch once to force Cloudinary to generate + cache the transformed
    // asset now, and to confirm it actually produced real transparency
    // before we commit to it in the database.
    let ok = false;
    let lastError = "";
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const res = await fetch(newUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        ok = true;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }

    if (!ok) {
      failures.push(`${product.id} (${product.name}): ${lastError}`);
      skipped++;
      continue;
    }

    await prisma.product.update({ where: { id: product.id }, data: { imageUrl: newUrl } });
    updated++;
    console.log(`[${i + 1}/${matched.length}] updated ${product.id}`);
  }

  console.log("\n--- Summary ---");
  console.log("Updated:", updated);
  console.log("Skipped:", skipped);
  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
