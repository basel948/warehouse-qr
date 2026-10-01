import { renderAppIcon } from "@/lib/app-icon";

// Browser tab icon and Android home-screen icon (also listed in manifest.ts).
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return renderAppIcon(size.width);
}
