import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const qrDataUrl = await QRCode.toDataURL(siteUrl, { width: 256 });

  const [productCount, pendingOrderCount] = await Promise.all([
    prisma.product.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <p className="text-sm text-stone-500">Products</p>
          <p className="text-2xl font-extrabold text-stone-900">{productCount}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <p className="text-sm text-stone-500">Pending orders</p>
          <p className="text-2xl font-extrabold text-stone-900">{pendingOrderCount}</p>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h2 className="font-bold text-stone-900 mb-2">Order page QR code</h2>
        <p className="text-sm text-stone-500 mb-4">
          Print this and place it in the warehouse. Customers scan it to open the order page at{" "}
          <code>{siteUrl}</code>.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="Order page QR code"
          width={256}
          height={256}
          className="border border-stone-200 rounded"
        />
      </div>
    </div>
  );
}
