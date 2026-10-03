import { renderAppIcon } from "@/lib/app-icon";

// Admin tab icon and admin home-screen app icon (also listed in
// admin-manifest.webmanifest): the shop icon on black, so the two installed
// apps are easy to tell apart. Overrides the root icon for every /admin page.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return renderAppIcon(size.width, "dark");
}
