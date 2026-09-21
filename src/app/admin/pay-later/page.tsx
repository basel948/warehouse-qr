"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { PAYMENT_METHOD } from "@/lib/payment-method";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: string;
  settledAt: string | null;
  couponCode: string | null;
  discountPercent: number | null;
  createdAt: string;
  items: OrderItem[];
};

type MonthGroup = {
  customerPhone: string;
  customerName: string;
  month: string; // "YYYY-MM"
  orders: Order[];
  total: number;
  settled: boolean;
};

const FILTERS = ["OUTSTANDING", "SETTLED", "ALL"] as const;

function orderTotal(order: Order): number {
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = order.discountPercent ? subtotal * (order.discountPercent / 100) : 0;
  return subtotal - discountAmount;
}

export default function AdminPayLaterPage() {
  const { t, locale } = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("OUTSTANDING");
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    ALL: t("admin.payLater.filterAll"),
    OUTSTANDING: t("admin.payLater.filterOutstanding"),
    SETTLED: t("admin.payLater.filterSettled"),
  };

  async function loadOrders() {
    setLoading(true);
    const res = await fetch("/api/orders");
    setOrders(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const groups: MonthGroup[] = useMemo(() => {
    const byKey = new Map<string, MonthGroup>();
    for (const order of orders) {
      if (order.paymentMethod !== PAYMENT_METHOD.PAY_LATER) continue;
      const month = order.createdAt.slice(0, 7); // "YYYY-MM"
      const key = `${order.customerPhone}__${month}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          customerPhone: order.customerPhone,
          customerName: order.customerName,
          month,
          orders: [],
          total: 0,
          settled: true,
        });
      }
      const group = byKey.get(key)!;
      group.orders.push(order);
      group.total += orderTotal(order);
      if (!order.settledAt) group.settled = false;
    }
    return Array.from(byKey.values()).sort((a, b) => {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      return a.customerPhone.localeCompare(b.customerPhone);
    });
  }, [orders]);

  const visibleGroups = groups.filter((group) => {
    if (filter === "ALL") return true;
    if (filter === "SETTLED") return group.settled;
    return !group.settled;
  });

  async function toggleSettled(group: MonthGroup) {
    const key = `${group.customerPhone}__${group.month}`;
    setSettlingKey(key);
    await fetch("/api/orders/pay-later/settle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerPhone: group.customerPhone,
        month: group.month,
        settled: !group.settled,
      }),
    });
    await loadOrders();
    setSettlingKey(null);
  }

  function formatMonth(month: string): string {
    const [year, monthNum] = month.split("-").map(Number);
    const date = new Date(year, monthNum - 1, 1);
    return date.toLocaleDateString(locale === "ar" ? "ar" : "he-IL", {
      year: "numeric",
      month: "long",
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <p className="text-sm text-[#8a8177]">{t("admin.payLater.loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-[#1a1714]">{t("admin.payLater.title")}</h1>
        <div className="flex gap-1 text-[13px] font-semibold">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 border transition-colors ${
                filter === f
                  ? "bg-[#1a1714] text-white border-[#1a1714]"
                  : "bg-white border-[#e6e0d6] text-[#4a443c]"
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {visibleGroups.length === 0 && (
        <p className="text-sm text-[#8a8177]">{t("admin.payLater.noneYet")}</p>
      )}

      <ul className="space-y-3.5">
        {visibleGroups.map((group) => {
          const key = `${group.customerPhone}__${group.month}`;
          const orderCount = group.orders.length;
          return (
            <li key={key} className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px]">
              <div className="flex items-start justify-between gap-4 mb-3.5">
                <div>
                  <p className="font-semibold text-[15px] text-[#1a1714]">{group.customerPhone}</p>
                  <p className="text-[13px] text-[#6b6259]">{group.customerName}</p>
                  <p className="text-[13px] text-[#6b6259]">{formatMonth(group.month)}</p>
                  <p className="text-xs text-[#a39a8e] mt-0.5">
                    {orderCount === 1
                      ? t("admin.payLater.ordersCountOne")
                      : t("admin.payLater.ordersCountOther", { count: orderCount })}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 shrink-0 rounded-[9px] px-2.5 py-1.5 text-[13px] font-semibold ${
                    group.settled
                      ? "bg-[#f1f7f1] border border-[#cfe3cf] text-[#2f6b3a]"
                      : "bg-[#fdf6e8] border border-[#f0dfba] text-[#8a5a06]"
                  }`}
                >
                  {group.settled && <CheckIcon className="w-3.5 h-3.5" />}
                  {group.settled ? t("admin.payLater.statusSettled") : t("admin.payLater.statusOutstanding")}
                </span>
              </div>

              <div className="bg-[#faf8f5] rounded-[10px] px-3.5 py-3 flex flex-col gap-1.5 text-[13px] text-[#4a443c]">
                {group.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <span>
                      {new Date(order.createdAt).toLocaleDateString(locale === "ar" ? "ar" : "he-IL")}
                      {order.couponCode ? ` · ${order.couponCode}` : ""}
                    </span>
                    <span className="font-semibold">₪{orderTotal(order).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3.5">
                <button
                  onClick={() => toggleSettled(group)}
                  disabled={settlingKey === key}
                  className={`text-[13px] font-semibold rounded-[9px] px-3.5 py-2 border disabled:opacity-50 ${
                    group.settled
                      ? "border-[#e6e0d6] text-[#6b6259] bg-white"
                      : "border-[var(--accent)] text-white bg-[var(--accent)]"
                  }`}
                >
                  {group.settled ? t("admin.payLater.markUnsettled") : t("admin.payLater.markSettled")}
                </button>
                <span className="text-base font-bold text-[#1a1714]">
                  {t("admin.payLater.totalDue")}: ₪{group.total.toFixed(2)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
