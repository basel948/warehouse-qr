"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

const CARD =
  "group relative block bg-white border border-[#eae5dc] rounded-[14px] p-[18px] outline-none transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[0_10px_24px_-10px_rgba(26,23,20,0.25)] focus-visible:border-[var(--accent)] active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

// "Go to page" arrow in the card's corner; points left in RTL.
function Arrow() {
  return (
    <span
      aria-hidden
      className="absolute top-[18px] end-[18px] text-lg leading-none text-[#c9c1b5] transition-[color,transform] duration-200 group-hover:text-[var(--accent)] rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1"
    >
      <span className="inline-block rtl:rotate-180">→</span>
    </span>
  );
}

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
        {/* Each count card opens its page. */}
        <Link href="/admin/products" className={CARD}>
          <p className="text-[13px] text-[#8a8177] mb-1.5">{t("admin.dashboard.products")}</p>
          <p className="text-[28px] font-bold text-[#1a1714]">{productCount}</p>
          <Arrow />
        </Link>
        <Link href="/admin/orders" className={CARD}>
          <p className="text-[13px] text-[#8a8177] mb-1.5">{t("admin.dashboard.pendingOrders")}</p>
          <p className="text-[28px] font-bold text-[var(--accent)]">{pendingOrderCount}</p>
          <Arrow />
        </Link>
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
