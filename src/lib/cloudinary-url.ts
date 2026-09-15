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
