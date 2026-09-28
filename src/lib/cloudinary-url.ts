// Client-safe helper: inserts a Cloudinary delivery transformation into an
// existing secure_url without needing the SDK or API credentials. Falls back
// to the original URL untouched if it doesn't look like a Cloudinary upload URL.
export function withCloudinaryTransform(url: string, transformation: string): string {
  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return url;
  const insertAt = index + marker.length;
  return `${url.slice(0, insertAt)}${transformation}/${url.slice(insertAt)}`;
}

// Delivery presets for images shown in the browser. Always pair f_auto
// (WebP/AVIF where supported, keeping PNG transparency) with a width cap sized
// to the largest the image is displayed at (~3x its CSS size for high-DPI
// phones) - originals are often 1-2 MB PNGs, and sending them unresized was
// most of the Cloudinary free-plan bandwidth. c_limit only ever shrinks.
// Not for the order PDF: react-pdf can't decode WebP/AVIF.
export const IMAGE_PRESET = {
  /** Admin list thumbnails and upload previews (~40-56px). */
  THUMB: "f_auto,q_auto,w_160,c_limit",
  /** Category page section-nav circles (80px). */
  SMALL: "f_auto,q_auto,w_240,c_limit",
  /** Product cards in grids, sale carousel product shots. */
  CARD: "f_auto,q_auto,w_500,c_limit",
  /** Home page category circles. */
  TILE: "f_auto,q_auto,w_600,c_limit",
  /** Product detail modal (largest view of a product). */
  DETAIL: "f_auto,q_auto:best,e_sharpen:60,w_1200,c_limit",
  /** Full-width sale banners. */
  BANNER: "f_auto,q_auto,w_1400,c_limit",
} as const;

export function cloudinaryImage(url: string, preset: keyof typeof IMAGE_PRESET): string {
  return withCloudinaryTransform(url, IMAGE_PRESET[preset]);
}
