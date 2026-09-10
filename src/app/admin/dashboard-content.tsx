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
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-[22px]">
      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px]">
          <p className="text-[13px] text-[#8a8177] mb-1.5">{t("admin.dashboard.products")}</p>
          <p className="text-[28px] font-bold text-[#1a1714]">{productCount}</p>
        </div>
        <div className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px]">
          <p className="text-[13px] text-[#8a8177] mb-1.5">{t("admin.dashboard.pendingOrders")}</p>
          <p className="text-[28px] font-bold text-[var(--accent)]">{pendingOrderCount}</p>
        </div>
      </div>

      <div className="bg-white border border-[#eae5dc] rounded-[14px] p-5 flex flex-col sm:flex-row gap-[22px] items-start">
        <div className="flex-1">
          <h2 className="text-base font-bold text-[#1a1714] mb-1.5">{t("admin.dashboard.qrTitle")}</h2>
          <p className="text-[13px] leading-[1.7] text-[#6b6259] mb-3">
            {t("admin.dashboard.qrDescription")}
          </p>
          <code className="inline-block text-xs bg-[#f2efe9] text-[#4a443c] px-2.5 py-1.5 rounded-lg">
            {siteUrl}
          </code>
          <div className="flex gap-2 mt-4">
            <a
              href={qrDataUrl}
              download="warehouse-qr-code.png"
              className="bg-[#1a1714] text-white rounded-[10px] px-4 py-[9px] text-sm font-semibold"
            >
              {t("admin.dashboard.downloadPng")}
            </a>
            <button
              onClick={() => window.print()}
              className="bg-white text-[#1a1714] border border-[#ddd6cb] rounded-[10px] px-4 py-[9px] text-sm font-semibold"
            >
              {t("admin.dashboard.print")}
            </button>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt={t("admin.dashboard.qrTitle")}
          width={196}
          height={196}
          className="border border-[#eae5dc] rounded-xl shrink-0"
        />
      </div>
    </div>
  );
}
