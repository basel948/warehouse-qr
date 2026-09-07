"use client";

import { useLocale } from "@/components/locale-provider";

export function DashboardContent({
  productCount,
  pendingOrderCount,
  qrDataUrl,
  siteUrl,
}: {
  productCount: number;
  pendingOrderCount: number;
  qrDataUrl: string;
  siteUrl: string;
}) {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <p className="text-sm text-stone-500">{t("admin.dashboard.products")}</p>
          <p className="text-2xl font-extrabold text-stone-900">{productCount}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <p className="text-sm text-stone-500">{t("admin.dashboard.pendingOrders")}</p>
          <p className="text-2xl font-extrabold text-stone-900">{pendingOrderCount}</p>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h2 className="font-bold text-stone-900 mb-2">{t("admin.dashboard.qrTitle")}</h2>
        <p className="text-sm text-stone-500 mb-1">{t("admin.dashboard.qrDescription")}</p>
        <p className="text-sm text-stone-500 mb-4">
          <code>{siteUrl}</code>
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt={t("admin.dashboard.qrTitle")}
          width={256}
          height={256}
          className="border border-stone-200 rounded"
        />
      </div>
    </div>
  );
}
