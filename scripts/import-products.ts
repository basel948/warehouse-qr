/**
 * Bulk-import products from an Excel file into the database.
 *
 * The Excel file must have a header row with these columns (any order):
 *   filename, suggested_name (or name), category, description, price
 * "filename" is looked up in the given images folder and uploaded to
 * Cloudinary; a cell with multiple comma-separated filenames uses the first.
 *
 * Usage:
 *   npx tsx scripts/import-products.ts <excel-file> <images-folder> [options]
 *
 * Options:
 *   --dry-run     Don't upload to Cloudinary or write to the database; just
 *                 report what would happen.
 *   --limit=N     Only process the first N data rows (for testing).
 *
 * Rows with no price get created with price 0 and inStock:false (hidden
 * from ordering until a real price is set in /admin/products).
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

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

type Row = {
  filename?: string;
  suggested_name?: string;
  name?: string;
  category?: string;
  description?: string;
  price?: number | string;
};

async function main() {
  loadEnv();

  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const dryRun = flags.includes("--dry-run");
  const limitFlag = flags.find((f) => f.startsWith("--limit="));
  const limit = limitFlag ? parseInt(limitFlag.split("=")[1], 10) : undefined;
  const onlyFlag = flags.find((f) => f.startsWith("--only="));
  const onlyFilenames = onlyFlag
    ? new Set(onlyFlag.slice("--only=".length).split(",").map((f) => f.trim()))
    : undefined;

  const [excelPath, imagesDir] = args;
  if (!excelPath || !imagesDir) {
    console.error("Usage: npx tsx scripts/import-products.ts <excel-file> <images-folder> [--dry-run] [--limit=N]");
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  function uploadOnce(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "warehouse-products" },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Cloudinary upload returned no result"));
            return;
          }
          resolve(result.secure_url);
        }
      );
      stream.end(buffer);
    });
  }

  async function uploadImage(buffer: Buffer, attempts = 3): Promise<string> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await uploadOnce(buffer);
      } catch (err) {
        if (attempt === attempts) throw err;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    throw new Error("unreachable");
  }

  const prisma = new PrismaClient();

  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  let rows: Row[] = XLSX.utils.sheet_to_json(sheet);
  if (limit) rows = rows.slice(0, limit);

  console.log(`Loaded ${rows.length} row(s) from ${path.basename(excelPath)}${dryRun ? " [DRY RUN]" : ""}`);

  const categoryIdByName = new Map<string, string>();
  let nextOrder = 1000;

  let created = 0;
  let skipped = 0;
  let placeholderPriceCount = 0;
  const missingImageFiles: string[] = [];
  const failures: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `row ${i + 2}`; // +2: 1-indexed + header row

    const name = (row.suggested_name ?? row.name ?? "").trim();
    if (!name) {
      console.log(`[skip] ${rowLabel}: no name`);
      skipped++;
      continue;
    }

    const filenameCell = (row.filename ?? "").trim();
    const primaryFilename = filenameCell.split(",")[0]?.trim();
    if (!primaryFilename) {
      console.log(`[skip] ${rowLabel}: no filename`);
      skipped++;
      continue;
    }

    if (onlyFilenames && !onlyFilenames.has(primaryFilename)) {
      continue;
    }

    const imagePath = path.join(imagesDir, primaryFilename);
    if (!fs.existsSync(imagePath)) {
      missingImageFiles.push(primaryFilename);
      skipped++;
      continue;
    }

    const categoryName = (row.category ?? "").trim();
    let categoryId: string | undefined;
    if (categoryName) {
      if (categoryIdByName.has(categoryName)) {
        categoryId = categoryIdByName.get(categoryName);
      } else if (dryRun) {
        categoryId = `dry-run-${categoryName}`;
        categoryIdByName.set(categoryName, categoryId);
      } else {
        const category = await prisma.category.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName, order: nextOrder++ },
        });
        categoryIdByName.set(categoryName, category.id);
        categoryId = category.id;
      }
    }

    const rawPrice = row.price;
    const parsedPrice = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice ?? ""));
    const hasPrice = Number.isFinite(parsedPrice) && parsedPrice > 0;
    const price = hasPrice ? parsedPrice : 0;
    if (!hasPrice) placeholderPriceCount++;

    if (dryRun) {
      console.log(
        `[${i + 1}/${rows.length}] would create "${primaryFilename}" -> category="${categoryName}" price=${price}${hasPrice ? "" : " [placeholder]"}`
      );
      created++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(imagePath);
      const imageUrl = await uploadImage(buffer);

      await prisma.product.create({
        data: {
          name,
          description: row.description || undefined,
          price,
          imageUrl,
          categories: categoryId ? { connect: [{ id: categoryId }] } : undefined,
          inStock: hasPrice,
        },
      });

      created++;
      console.log(`[${i + 1}/${rows.length}] created (${primaryFilename})${hasPrice ? "" : " [placeholder price]"}`);
    } catch (err) {
      failures.push(`${rowLabel} (${primaryFilename}): ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Placeholder-price products (₪0, marked out of stock): ${placeholderPriceCount}`);
  if (missingImageFiles.length) {
    console.log(`\nMissing image files (${missingImageFiles.length}):`);
    for (const f of missingImageFiles) console.log(`  - ${f}`);
  }
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
