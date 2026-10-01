/**
 * One-time move of product images from Cloudinary (account disabled for
 * exceeding the free plan, 2026-10) to ImageKit.
 *
 * Cloudinary refuses downloads while disabled, so images are re-uploaded from
 * the local originals in warehouse_products/ instead, using the keep/swap
 * decisions in tools/quality_batch_*.json (swap = enhanced copy, keep =
 * original). Each file is uploaded once, capped at 1600px by ImageKit before
 * storing. Old URLs are backed up to backups/ before any product is changed.
 *
 * Also deletes one duplicate product (same name/price, no orders).
 *
 * Usage:
 *   npx tsx scripts/migrate-to-imagekit.ts --dry-run
 *   npx tsx scripts/migrate-to-imagekit.ts [--limit=N]
 *
 * Safe to re-run: products already on ImageKit are skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { uploadImageBuffer } from "../src/lib/imagekit";

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

const IMAGES_ROOT = "C:/Users/basel/Desktop/warehouse_products";
const ORIGINAL_DIR = path.join(IMAGES_ROOT, "חומרי ניקוי");
const ENHANCED_DIR = path.join(IMAGES_ROOT, "חומרי ניקוי משופר");

// Duplicate of cmu01ydfm000jue29eofw9ojt (same name and price); has no orders.
const DUPLICATE_PRODUCT_ID = "cmu01lbgl002r7cixkbatjpb7";

type Match = { productId: string; localFilename: string; decision: "keep" | "swap" };

// Finds a file by stem, ignoring extension and case (some originals were
// replaced by background-removed .png copies after the batches were written).
function findByStem(dir: string, filename: string, preferExt?: string): string | null {
  const stem = path.parse(filename).name.toLowerCase();
  const candidates = fs.readdirSync(dir).filter((f) => path.parse(f).name.toLowerCase() === stem);
  if (candidates.length === 0) return null;
  const exact = candidates.find((f) => f === filename);
  const preferred = preferExt && candidates.find((f) => path.extname(f).toLowerCase() === preferExt);
  return path.join(dir, exact ?? preferred ?? candidates[0]);
}

function sourceFile(match: Match): string | null {
  return match.decision === "swap"
    ? findByStem(ENHANCED_DIR, match.localFilename, ".png")
    : findByStem(ORIGINAL_DIR, match.localFilename);
}

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

  const batches: Match[] = [1, 2, 3].flatMap((i) =>
    JSON.parse(fs.readFileSync(`tools/quality_batch_${i}.json`, "utf-8"))
  );
  // A product with two candidate photos (the duplicate's) keeps only the first.
  const matchByProduct = new Map<string, Match>();
  for (const m of batches) {
    if (!matchByProduct.has(m.productId)) matchByProduct.set(m.productId, m);
  }

  const products = await prisma.product.findMany({ select: { id: true, name: true, imageUrl: true } });

  const plan: Array<{ id: string; name: string; oldUrl: string | null; file: string }> = [];
  const noLocalImage: string[] = [];
  let alreadyMigrated = 0;
  for (const product of products) {
    if (product.id === DUPLICATE_PRODUCT_ID) continue;
    if (product.imageUrl?.includes("ik.imagekit.io")) {
      alreadyMigrated++;
      continue;
    }
    const match = matchByProduct.get(product.id);
    const file = match && sourceFile(match);
    if (!file) {
      noLocalImage.push(`${product.name} (${product.id})`);
      continue;
    }
    plan.push({ id: product.id, name: product.name, oldUrl: product.imageUrl, file });
  }

  const uniqueFiles = new Set(plan.map((p) => p.file)).size;
  console.log(`To migrate: ${plan.length} products, ${uniqueFiles} unique files. Already on ImageKit: ${alreadyMigrated}.`);
  const fromEnhanced = plan.filter((p) => path.dirname(p.file) === ENHANCED_DIR).length;
  console.log(`From enhanced folder: ${fromEnhanced}, from originals: ${plan.length - fromEnhanced}`);
  console.log(`No local image (re-upload in /admin):\n  ${noLocalImage.join("\n  ") || "none"}`);

  const duplicate = await prisma.product.findUnique({
    where: { id: DUPLICATE_PRODUCT_ID },
    include: { _count: { select: { orderItems: true } } },
  });
  console.log(duplicate ? `Duplicate to delete: ${duplicate.name} (orders: ${duplicate._count.orderItems})` : "Duplicate already deleted.");

  if (dryRun) return;

  const toProcess = plan.slice(0, limit);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `backups/imagekit-migration-${stamp}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(toProcess.map(({ id, name, oldUrl }) => ({ id, name, oldUrl })), null, 2));
  console.log(`Old URLs backed up to ${backupPath}`);

  const uploaded = new Map<string, Promise<string>>();
  const failures: string[] = [];
  let done = 0;

  // Small worker pool: a few uploads at a time is much faster than one by one
  // without hammering the API.
  const queue = [...toProcess];
  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        if (!uploaded.has(item.file)) {
          uploaded.set(item.file, uploadImageBuffer(fs.readFileSync(item.file), path.basename(item.file)));
        }
        const url = await uploaded.get(item.file)!;
        await prisma.product.update({ where: { id: item.id }, data: { imageUrl: url } });
        console.log(`[${++done}/${toProcess.length}] OK ${item.name}`);
      } catch (err) {
        uploaded.delete(item.file);
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${item.name} (${item.id}): ${msg}`);
        console.log(`[${++done}/${toProcess.length}] FAILED ${item.name}: ${msg}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  if (duplicate && limit === Infinity) {
    if (duplicate._count.orderItems === 0) {
      await prisma.product.delete({ where: { id: DUPLICATE_PRODUCT_ID } });
      console.log(`Deleted duplicate product ${duplicate.name}`);
    } else {
      console.log("Duplicate now has orders - not deleting it.");
    }
  }

  console.log(`\nDone. ${toProcess.length - failures.length} succeeded, ${failures.length} failed.`);
  if (failures.length) console.log(failures.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
