// Server-only: uploads go through ImageKit's REST upload API, authenticated
// with the private key (never expose it to the browser).
const UPLOAD_ENDPOINT = "https://upload.imagekit.io/api/v1/files/upload";

// Applied by ImageKit before storing ("pre" transformation): caps the stored
// original at 1600px on its longest side, so full-size phone photos (often
// 3-5 MB) don't eat the free plan's storage. c-at_max only ever shrinks and
// keeps the original format (PNG transparency survives).
const UPLOAD_TRANSFORMATION = { pre: "w-1600,h-1600,c-at_max" };

export async function uploadImageBuffer(buffer: Buffer, fileName: string, folder = "warehouse-products"): Promise<string> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) throw new Error("IMAGEKIT_PRIVATE_KEY is not set");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), fileName);
  form.append("fileName", fileName);
  form.append("folder", folder);
  form.append("useUniqueFileName", "true");
  form.append("transformation", JSON.stringify(UPLOAD_TRANSFORMATION));

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
      body: form,
    });
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      return data.url;
    }
    const message = `ImageKit upload failed (${res.status}): ${await res.text()}`;
    if (attempt >= 3 || (res.status < 500 && res.status !== 429)) throw new Error(message);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

export async function uploadProductImage(file: { arrayBuffer(): Promise<ArrayBuffer>; name?: string }): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadImageBuffer(buffer, file.name || "product-image");
}
