import { NextResponse } from "next/server";
import { WAREHOUSE_NAME } from "@/lib/branding";

// Shop install manifest, linked via metadata in the root layout. A route
// handler rather than the app/manifest.ts file convention, because that
// convention always wins over a layout's metadata.manifest - which stopped
// admin/layout.tsx from linking its own manifest (admin-manifest.webmanifest).
// No service worker: an installed shortcut always loads the live site.
export function GET() {
  return NextResponse.json(
    {
      id: "/",
      name: WAREHOUSE_NAME,
      short_name: WAREHOUSE_NAME,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#FFFFFF",
      theme_color: "#FFFFFF",
      icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
