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

export default function AdminOrdersPage() {
  const { t } = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const statusLabels: Record<(typeof STATUSES)[number], string> = {
    PENDING: t("admin.orders.statusPending"),
    CONFIRMED: t("admin.orders.statusConfirmed"),
    CANCELLED: t("admin.orders.statusCancelled"),
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

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <p className="text-sm text-stone-500">{t("admin.orders.loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold text-stone-900">{t("admin.orders.title")}</h1>

      {orders.length === 0 && (
        <p className="text-sm text-stone-500">{t("admin.orders.noOrdersYet")}</p>
      )}

      <ul className="space-y-4">
        {orders.map((order) => {
          const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const discountAmount = order.discountPercent ? subtotal * (order.discountPercent / 100) : 0;
          const total = subtotal - discountAmount;
          return (
            <li key={order.id} className="bg-white border border-stone-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-sm text-stone-500">{order.customerPhone}</p>
                  <p className="text-xs text-stone-400">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <select
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                  className="border border-stone-300 rounded px-2 py-1 text-sm"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>

              <ul className="mt-3 text-sm text-stone-700 space-y-1">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {t("admin.orders.itemLine", {
                      qty: item.quantity,
                      name: item.product.name,
                      price: item.price.toFixed(2),
                    })}
                  </li>
                ))}
              </ul>

              {order.couponCode && (
                <div className="mt-3 flex items-center justify-between text-sm text-green-700">
                  <span>
                    {t("admin.orders.couponLine", {
                      code: order.couponCode,
                      percent: order.discountPercent ?? 0,
                    })}
                  </span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-medium">
                  {t("admin.orders.total", { amount: total.toFixed(2) })}
                </span>
                <span className={order.whatsappSentAt ? "text-green-700" : "text-amber-700"}>
                  {order.whatsappSentAt
                    ? t("admin.orders.whatsappSent")
                    : t("admin.orders.whatsappNotSent")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
