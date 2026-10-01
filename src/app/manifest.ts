import type { MetadataRoute } from "next";
import { WAREHOUSE_NAME } from "@/lib/branding";

// Lets phones install the shop as a home-screen app with the brand icon and
// name. No service worker: the app always loads the live site.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: WAREHOUSE_NAME,
    short_name: WAREHOUSE_NAME,
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
