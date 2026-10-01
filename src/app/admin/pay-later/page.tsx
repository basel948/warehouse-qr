"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { ORDER_STATUS } from "@/lib/order-status";
import { PAYMENT_METHOD } from "@/lib/payment-method";
import { normalizeIsraeliPhone } from "@/lib/phone";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  product: { name: string };
};

type Order = {
  id: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentMethod: string;
  settledAt: string | null;
  couponCode: string | null;
  discountPercent: number | null;
  createdAt: string;
  items: OrderItem[];
};

type CustomerGroup = {
  key: string;
  customerPhone: string;
  customerName: string;
  /** Newest first (the API returns orders by createdAt desc). */
  orders: Order[];
};

const FILTERS = ["OUTSTANDING", "SETTLED", "ALL"] as const;
type Filter = (typeof FILTERS)[number];

function orderTotal(order: Order): number {
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = order.discountPercent ? subtotal * (order.discountPercent / 100) : 0;
  return subtotal - discountAmount;
}

function isCancelled(order: Order): boolean {
  return order.status === ORDER_STATUS.CANCELLED;
}

// Which of a customer's orders a tab shows. Cancelled orders aren't owed, so
// they only appear (crossed out) under "All".
function ordersForFilter(orders: Order[], filter: Filter): Order[] {
  if (filter === "OUTSTANDING") return orders.filter((o) => !o.settledAt && !isCancelled(o));
  if (filter === "SETTLED") return orders.filter((o) => o.settledAt && !isCancelled(o));
  return orders;
}

export default function AdminPayLaterPage() {
  const { t, locale } = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("OUTSTANDING");
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const filterLabels: Record<Filter, string> = {
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

  // One card per customer, across all months. Grouped by the normalized
  // phone so "050-1234567" and "0501234567" land on the same card.
  const groups: CustomerGroup[] = useMemo(() => {
    const byKey = new Map<string, CustomerGroup>();
    for (const order of orders) {
      if (order.paymentMethod !== PAYMENT_METHOD.PAY_LATER) continue;
      const key = normalizeIsraeliPhone(order.customerPhone);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          customerPhone: order.customerPhone,
          customerName: order.customerName,
          orders: [],
        });
      }
      byKey.get(key)!.orders.push(order);
    }
    return Array.from(byKey.values());
  }, [orders]);

  const visibleGroups = groups
    .map((group) => ({ group, shown: ordersForFilter(group.orders, filter) }))
    .filter(({ shown }) => shown.length > 0);

  async function setSettled(key: string, orderIds: string[], settled: boolean) {
    setSettlingKey(key);
    await fetch("/api/orders/pay-later/settle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds, settled }),
    });
    await loadOrders();
    setSettlingKey(null);
  }

  const dateLocale = locale === "ar" ? "ar" : "he-IL";

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
        {visibleGroups.map(({ group, shown }) => {
          const active = shown.filter((o) => !isCancelled(o));
          const unpaid = active.filter((o) => !o.settledAt);
          const owesMoney = unpaid.length > 0;
          // While anything is unpaid, the total and the button are about what's
          // still owed; once everything shown is paid, they're about what was paid.
          const counted = owesMoney ? unpaid : active;
          const total = counted.reduce((sum, o) => sum + orderTotal(o), 0);
          const orderCount = active.length;
          const key = group.key;
          return (
            <li key={key} className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px]">
              <div className="flex items-start justify-between gap-4 mb-3.5">
                <div>
                  <p className="font-semibold text-[15px] text-[#1a1714]">{group.customerPhone}</p>
                  <p className="text-[13px] text-[#6b6259]">{group.customerName}</p>
                  <p className="text-xs text-[#a39a8e] mt-0.5">
                    {orderCount === 1
                      ? t("admin.payLater.ordersCountOne")
                      : t("admin.payLater.ordersCountOther", { count: orderCount })}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 shrink-0 rounded-[9px] px-2.5 py-1.5 text-[13px] font-semibold ${
                    owesMoney
                      ? "bg-[#fdf6e8] border border-[#f0dfba] text-[#8a5a06]"
                      : "bg-[#f1f7f1] border border-[#cfe3cf] text-[#2f6b3a]"
                  }`}
                >
                  {!owesMoney && <CheckIcon className="w-3.5 h-3.5" />}
                  {owesMoney ? t("admin.payLater.statusOutstanding") : t("admin.payLater.statusSettled")}
                </span>
              </div>

              <div className="bg-[#faf8f5] rounded-[10px] px-3.5 py-3 flex flex-col divide-y divide-[#e6e0d6] text-[13px] text-[#4a443c]">
                {shown.map((order) => {
                  const cancelled = isCancelled(order);
                  return (
                    <div key={order.id} className={`py-2.5 first:pt-0 last:pb-0 ${cancelled ? "text-[#a39a8e]" : ""}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">
                          {new Date(order.createdAt).toLocaleDateString(dateLocale)}
                          {order.couponCode ? ` · ${order.couponCode} (-${order.discountPercent}%)` : ""}
                          {cancelled ? ` · ${t("admin.payLater.cancelled")}` : ""}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {filter === "ALL" && order.settledAt && !cancelled && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#2f6b3a]">
                              <CheckIcon className="w-3 h-3" />
                              {t("admin.payLater.statusSettled")}
                            </span>
                          )}
                          <span className={`font-semibold ${cancelled ? "line-through" : ""}`}>
                            ₪{orderTotal(order).toFixed(2)}
                          </span>
                        </span>
                      </div>
                      <ul className={`mt-1 ps-3 border-s-2 border-[#eae5dc] flex flex-col gap-0.5 text-xs ${cancelled ? "" : "text-[#6b6259]"}`}>
                        {order.items.map((item) => (
                          <li key={item.id} className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              {item.quantity} × {item.product.name}
                            </span>
                            <span className="shrink-0 tabular-nums">₪{(item.price * item.quantity).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-3.5">
                {counted.length > 0 ? (
                  <button
                    onClick={() => setSettled(key, counted.map((o) => o.id), owesMoney)}
                    disabled={settlingKey === key}
                    className={`text-[13px] font-semibold rounded-[9px] px-3.5 py-2 border disabled:opacity-50 ${
                      owesMoney
                        ? "border-[var(--accent)] text-white bg-[var(--accent)]"
                        : "border-[#e6e0d6] text-[#6b6259] bg-white"
                    }`}
                  >
                    {owesMoney ? t("admin.payLater.markSettled") : t("admin.payLater.markUnsettled")}
                  </button>
                ) : (
                  <span />
                )}
                <span className="text-base font-bold text-[#1a1714]">
                  {owesMoney ? t("admin.payLater.totalDue") : t("admin.payLater.totalPaid")}: ₪{total.toFixed(2)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
