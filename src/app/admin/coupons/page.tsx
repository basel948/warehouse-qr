"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

type Coupon = {
  id: string;
  code: string;
  discountPercent: number;
  active: boolean;
  createdAt: string;
};

export default function AdminCouponsPage() {
  const { t } = useLocale();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [error, setError] = useState<string | null>(null);

  async function loadCoupons() {
    setLoading(true);
    const res = await fetch("/api/coupons");
    setCoupons(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  async function addCoupon(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedPercent = Number(discountPercent);
    if (!code.trim()) {
      setError(t("admin.coupons.emptyCodeError"));
      return;
    }
    if (!Number.isInteger(parsedPercent) || parsedPercent < 1 || parsedPercent > 100) {
      setError(t("admin.coupons.invalidPercentError"));
      return;
    }

    const res = await fetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), discountPercent: parsedPercent }),
    });

    if (!res.ok) {
      setError(t("admin.coupons.addFailedError"));
      return;
    }

    setCode("");
    setDiscountPercent("10");
    loadCoupons();
  }

  async function toggleActive(coupon: Coupon) {
    await fetch(`/api/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !coupon.active }),
    });
    loadCoupons();
  }

  async function deleteCoupon(id: string) {
    await fetch(`/api/coupons/${id}`, { method: "DELETE" });
    loadCoupons();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-[22px]">
      <div>
        <h1 className="text-xl font-bold text-[#1a1714] mb-4">{t("admin.coupons.title")}</h1>

        <form
          onSubmit={addCoupon}
          className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px] flex flex-col sm:flex-row gap-2.5 sm:items-center mb-6"
        >
          <input
            type="text"
            placeholder={t("admin.coupons.codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="flex-1 border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-[#f7f5f1] uppercase font-mono placeholder:normal-case placeholder:font-sans placeholder:text-[#a39a8e]"
          />
          <select
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className="w-full sm:w-32 border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-[#f7f5f1]"
          >
            <option value="10">10%</option>
            <option value="15">15%</option>
            <option value="20">20%</option>
          </select>
          <button
            type="submit"
            className="bg-[var(--accent)] text-white rounded-[10px] px-5 py-2.5 text-sm font-semibold"
          >
            {t("admin.coupons.addCoupon")}
          </button>
          {error && <p className="text-sm text-[#b3402e] sm:basis-full">{error}</p>}
        </form>

        {loading ? (
          <p className="text-sm text-[#8a8177]">{t("admin.coupons.loading")}</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-[#8a8177]">{t("admin.coupons.noCouponsYet")}</p>
        ) : (
          <ul className="divide-y divide-[#f2efe9] bg-white border border-[#eae5dc] rounded-[14px] overflow-hidden">
            {coupons.map((coupon) => (
              <li key={coupon.id} className="flex items-center justify-between gap-4 px-[18px] py-[15px]">
                <div className="flex items-center gap-3.5 flex-wrap">
                  <span className="font-mono font-semibold text-[15px] text-[#1a1714]">
                    {coupon.code}
                  </span>
                  <span className="text-[13px] text-[#6b6259]">
                    {t("admin.coupons.percentOff", { percent: coupon.discountPercent })}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      coupon.active ? "bg-[#f1f7f1] text-[#2f6b3a]" : "bg-[#f2efe9] text-[#6b6259]"
                    }`}
                  >
                    {coupon.active ? t("admin.coupons.active") : t("admin.coupons.inactive")}
                  </span>
                  <button
                    onClick={() => toggleActive(coupon)}
                    className="text-[13px] text-[#6b6259] underline"
                  >
                    {coupon.active ? t("admin.coupons.deactivate") : t("admin.coupons.activate")}
                  </button>
                  <button
                    onClick={() => deleteCoupon(coupon.id)}
                    className="text-[13px] text-[#b3402e] underline"
                  >
                    {t("admin.coupons.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
