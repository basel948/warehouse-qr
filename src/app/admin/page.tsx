import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const qrDataUrl = await QRCode.toDataURL(siteUrl, { width: 256 });

  const [productCount, pendingOrderCount] = await Promise.all([
    prisma.product.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <DashboardContent
      productCount={productCount}
      pendingOrderCount={pendingOrderCount}
      qrDataUrl={qrDataUrl}
      siteUrl={siteUrl}
    />
  );
}
