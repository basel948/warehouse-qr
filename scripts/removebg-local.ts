/**
 * Runs a specific, budget-limited set of local images through the remove.bg
 * API and saves the results (transparent PNGs) into a new output folder.
 * Deliberately takes an explicit filename list rather than "all files in a
 * folder" — remove.bg credits are limited and billed per image.
 *
 * Usage:
 *   npx tsx scripts/removebg-local.ts <source-folder> <output-folder> <filename1> [filename2] ...
 *   npx tsx scripts/removebg-local.ts <source-folder> <output-folder> --file=<list.txt>
 *
 * Reads REMOVEBG_API_KEY from .env. Prints remaining account credits before
 * starting and after each call so usage is always visible.
 */
import fs from "node:fs";
import path from "node:path";

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

async function main() {
  loadEnv();
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) {
    console.error("REMOVEBG_API_KEY not set in .env");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const [sourceDir, outputDir, ...rest] = args;
  if (!sourceDir || !outputDir || rest.length === 0) {
    console.error(
      "Usage: npx tsx scripts/removebg-local.ts <source-folder> <output-folder> <filename1> [filename2] ... | --file=<list.txt>"
    );
    process.exit(1);
  }

  let filenames: string[];
  const fileFlag = rest.find((a) => a.startsWith("--file="));
  if (fileFlag) {
    const listPath = fileFlag.slice("--file=".length);
    filenames = fs
      .readFileSync(listPath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } else {
    filenames = rest;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const accountRes = await fetch("https://api.remove.bg/v1.0/account", {
    headers: { "X-Api-Key": apiKey },
  });
  const account = await accountRes.json();
  const totalCredits = account?.data?.attributes?.credits?.total ?? "?";
  const freeCalls = account?.data?.attributes?.api?.free_calls ?? "?";
  console.log(`Account: ${totalCredits} paid credit(s), ${freeCalls} free call(s) remaining`);
  console.log(`Processing ${filenames.length} image(s) -> ${outputDir}\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i];
    const srcPath = path.join(sourceDir, filename);
    if (!fs.existsSync(srcPath)) {
      console.log(`[${i + 1}/${filenames.length}] SKIP (not found): ${filename}`);
      failed++;
      continue;
    }

    const outName = filename.replace(/\.[^.]+$/, "") + ".png";
    const outPath = path.join(outputDir, outName);

    try {
      const buffer = fs.readFileSync(srcPath);
      const form = new FormData();
      form.append("image_file", new Blob([buffer]), filename);
      form.append("size", "auto");

      const res = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": apiKey },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.log(
          `[${i + 1}/${filenames.length}] FAILED: ${filename} -> ${res.status} ${errText.slice(0, 200)}`
        );
        failed++;
        continue;
      }

      const charged = res.headers.get("x-credits-charged");
      const outBuffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outPath, outBuffer);
      succeeded++;
      console.log(`[${i + 1}/${filenames.length}] OK: ${filename} -> ${outName} (charged: ${charged ?? "?"})`);
    } catch (err) {
      console.log(
        `[${i + 1}/${filenames.length}] ERROR: ${filename} -> ${err instanceof Error ? err.message : String(err)}`
      );
      failed++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Output folder: ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
