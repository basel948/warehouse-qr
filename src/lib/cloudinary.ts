import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Applied by Cloudinary before storing ("incoming transformation"): caps the
// stored original at 1600px on its longest side, so full-size phone photos
// (often 3-5 MB) don't eat the free plan's storage. Only ever shrinks, and
// keeps the original format (PNG transparency survives).
export const UPLOAD_TRANSFORMATION = [{ width: 1600, height: 1600, crop: "limit" }];

export async function uploadProductImage(file: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "warehouse-products", transformation: UPLOAD_TRANSFORMATION },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload returned no result"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}
