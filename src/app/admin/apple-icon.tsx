import { renderAppIcon } from "@/lib/app-icon";

// iPhone/iPad "Add to Home Screen" icon for the admin app (black version).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(size.width, "dark");
}
