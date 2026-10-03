// Client-side: shrinks a photo in the browser before it's uploaded, so
// full-size phone photos (often 5-15 MB, over the upload route's 5 MB limit)
// go up as a few hundred KB. ImageKit caps stored originals at 1600px anyway
// (src/lib/imagekit.ts), so shrinking to the same size loses nothing on the site.

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
// Under this size a photo is already cheap to upload, so it's only shrunk if
// it's larger than MAX_SIDE.
const SMALL_ENOUGH_BYTES = 1.5 * 1024 * 1024;

export async function shrinkImage(file: File): Promise<File> {
  // GIFs may be animated; a canvas would keep only the first frame.
  if (file.type === "image/gif") return file;

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    // Can't decode it here (e.g. HEIC outside Safari): send it as-is and let
    // the server accept or reject it.
    return file;
  }

  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (longestSide <= MAX_SIDE && file.size <= SMALL_ENOUGH_BYTES) return file;

  const scale = Math.min(1, MAX_SIDE / longestSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // PNGs stay PNG so transparent backgrounds (category images) survive;
  // everything else becomes JPEG, which is far smaller for photos.
  const keepPng = file.type === "image/png";
  const type = keepPng ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, keepPng ? undefined : JPEG_QUALITY)
  );
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.${keepPng ? "png" : "jpg"}`, { type });
}

// An <img> applies the photo's EXIF rotation when decoding, so phone photos
// taken sideways come out the right way up once drawn to the canvas.
function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    image.src = url;
  });
}
