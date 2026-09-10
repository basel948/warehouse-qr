"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  product: { name: string };
};

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  status: string;
  whatsappSentAt: string | null;
  couponCode: string | null;
  discountPercent: number | null;
  createdAt: string;
  items: OrderItem[];
};

const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
const FILTERS = ["ALL", "PENDING", "CONFIRMED"] as const;

export default function AdminOrdersPage() {
  const { t } = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<(typeof FILTERS)[number]>("ALL");

  const statusLabels: Record<(typeof STATUSES)[number], string> = {
    PENDING: t("admin.orders.statusPending"),
    CONFIRMED: t("admin.orders.statusConfirmed"),
    CANCELLED: t("admin.orders.statusCancelled"),
  };

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    ALL: t("admin.orders.filterAll"),
    PENDING: t("admin.orders.filterPending"),
    CONFIRMED: t("admin.orders.filterConfirmed"),
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

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadOrders();
  }

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const visibleOrders =
    filterStatus === "ALL" ? orders : orders.filter((o) => o.status === filterStatus);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <p className="text-sm text-[#8a8177]">{t("admin.orders.loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-[#1a1714]">{t("admin.orders.title")}</h1>
        <div className="flex gap-1 text-[13px] font-semibold">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`rounded-full px-3.5 py-1.5 border transition-colors ${
                filterStatus === filter
                  ? "bg-[#1a1714] text-white border-[#1a1714]"
                  : "bg-white border-[#e6e0d6] text-[#4a443c]"
              }`}
            >
              {filterLabels[filter]}
              {filter === "PENDING" && pendingCount > 0 ? ` ${pendingCount}` : ""}
            </button>
          ))}
        </div>
      </div>

      {visibleOrders.length === 0 && (
        <p className="text-sm text-[#8a8177]">{t("admin.orders.noOrdersYet")}</p>
      )}

      <ul className="space-y-3.5">
        {visibleOrders.map((order) => {
          const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const discountAmount = order.discountPercent ? subtotal * (order.discountPercent / 100) : 0;
          const total = subtotal - discountAmount;
          return (
            <li key={order.id} className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px]">
              <div className="flex items-start justify-between gap-4 mb-3.5">
                <div>
                  <p className="font-semibold text-[15px] text-[#1a1714]">{order.customerName}</p>
                  <p className="text-[13px] text-[#6b6259]">{order.customerPhone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#a39a8e]">
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className={`border rounded-[9px] px-2.5 py-1.5 text-[13px] font-semibold ${
                      order.status === "PENDING"
                        ? "bg-[#fdf6e8] border-[#f0dfba] text-[#8a5a06]"
                        : order.status === "CONFIRMED"
                          ? "bg-[#f1f7f1] border-[#cfe3cf] text-[#2f6b3a]"
                          : "bg-[#f2efe9] border-[#e6e0d6] text-[#6b6259]"
                    }`}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-[#faf8f5] rounded-[10px] px-3.5 py-3 flex flex-col gap-1.5 text-[13px] text-[#4a443c]">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span>
                      {t("admin.orders.itemLine", {
                        qty: item.quantity,
                        name: item.product.name,
                        price: item.price.toFixed(2),
                      })}
                    </span>
                  </div>
                ))}
                {order.couponCode && (
                  <div className="flex items-center justify-between text-[#2f6b3a]">
                    <span>
                      {t("admin.orders.couponLine", {
                        code: order.couponCode,
                        percent: order.discountPercent ?? 0,
                      })}
                    </span>
                    <span>-₪{discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-3.5">
                <span className={`text-xs ${order.whatsappSentAt ? "text-[#2f6b3a]" : "text-[#8a5a06]"}`}>
                  {order.whatsappSentAt
                    ? `✓ ${t("admin.orders.whatsappSent")}`
                    : t("admin.orders.whatsappNotSent")}
                </span>
                <span className="text-base font-bold text-[#1a1714]">
                  {t("admin.orders.total", { amount: total.toFixed(2) })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
