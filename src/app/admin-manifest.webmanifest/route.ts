import { NextResponse } from "next/server";
import { WAREHOUSE_NAME } from "@/lib/branding";

// Separate install manifest for the admin area, linked from admin/layout.tsx.
// With only the shop manifest (start_url "/"), a home-screen shortcut saved
// from /admin opened the buyer catalog instead. Lives outside /admin so the
// auth middleware doesn't redirect the browser's manifest request to login.
export function GET() {
  return NextResponse.json(
    {
      id: "/admin",
      name: `${WAREHOUSE_NAME} Admin`,
      short_name: `${WAREHOUSE_NAME} Admin`,
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#111111",
      theme_color: "#111111",
      icons: [{ src: "/admin/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
