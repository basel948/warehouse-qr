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
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-stone-900 mb-4">{t("admin.coupons.title")}</h1>

        <form onSubmit={addCoupon} className="bg-white border border-stone-200 rounded-lg p-4 space-y-2 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("admin.coupons.codePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 border border-stone-300 rounded px-3 py-2 uppercase"
            />
            <select
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              className="w-28 border border-stone-300 rounded px-3 py-2"
            >
              <option value="10">10%</option>
              <option value="15">15%</option>
              <option value="20">20%</option>
            </select>
          </div>
          <button type="submit" className="bg-amber-600 text-white rounded px-4 py-2">
            {t("admin.coupons.addCoupon")}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {loading ? (
          <p className="text-sm text-stone-500">{t("admin.coupons.loading")}</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-stone-500">{t("admin.coupons.noCouponsYet")}</p>
        ) : (
          <ul className="divide-y divide-stone-200 bg-white border border-stone-200 rounded-lg overflow-hidden">
            {coupons.map((coupon) => (
              <li key={coupon.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-mono font-medium">{coupon.code}</p>
                  <p className="text-sm text-stone-500">
                    {t("admin.coupons.percentOff", { percent: coupon.discountPercent })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      coupon.active ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {coupon.active ? t("admin.coupons.active") : t("admin.coupons.inactive")}
                  </span>
                  <button
                    onClick={() => toggleActive(coupon)}
                    className="text-sm text-stone-600 underline"
                  >
                    {coupon.active ? t("admin.coupons.deactivate") : t("admin.coupons.activate")}
                  </button>
                  <button
                    onClick={() => deleteCoupon(coupon.id)}
                    className="text-sm text-red-600 underline"
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
