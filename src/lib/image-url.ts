// Client-safe helper: adds an ImageKit delivery transformation (?tr=...) to an
// image URL without needing API credentials. Leaves any non-ImageKit URL (an
// old Cloudinary link, an external logo) untouched.
export function withImageTransform(url: string, transformation: string): string {
  if (!url.includes("ik.imagekit.io")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}tr=${transformation}`;
}

// Delivery presets for images shown in the browser, each a width cap sized to
// the largest the image is displayed at (~3x its CSS size for high-DPI
// phones). ImageKit picks WebP/AVIF automatically (keeping PNG transparency)
// and c-at_max only ever shrinks. Sending originals unresized is what used up
// the old Cloudinary free plan's bandwidth.
// Not for the order PDF: react-pdf can't decode WebP/AVIF.
export const IMAGE_PRESET = {
  /** Admin list thumbnails and upload previews (~40-56px). */
  THUMB: "w-160,c-at_max",
  /** Category page section-nav circles (80px). */
  SMALL: "w-240,c-at_max",
  /** Product cards in grids, sale carousel product shots. */
  CARD: "w-500,c-at_max",
  /** Home page category tiles (up to ~700px wide on desktop). */
  TILE: "w-1400,c-at_max",
  /** Product detail modal (largest view of a product). */
  DETAIL: "w-1200,c-at_max,q-90,e-sharpen-60",
  /** Header/login logo (shown 32-40px tall). */
  LOGO: "h-120,c-at_max",
  /** Full-width sale banners. */
  BANNER: "w-1400,c-at_max",
} as const;

export function optimizedImage(url: string, preset: keyof typeof IMAGE_PRESET): string {
  return withImageTransform(url, IMAGE_PRESET[preset]);
}
