"use client";

import { useEffect, useState } from "react";
import { CheckIcon, TrashIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { Spinner, useToast } from "@/components/toast";
import { ORDER_STATUS } from "@/lib/order-status";
import { calculateOrderTotals } from "@/lib/order-totals";
import { asProductUnit } from "@/lib/product-unit";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  couponCode: string | null;
  discountPercent: number | null;
  product: { name: string; unit: string };
};

type Order = {
  id: string;
  customerName: string;
  businessName: string;
  customerPhone: string;
  paymentMethod: string;
  status: string;
  whatsappSentAt: string | null;
  buyerWhatsappSentAt: string | null;
  emailSentAt: string | null;
  couponCode: string | null;
  discountPercent: number | null;
  vatPercent: number | null;
  createdAt: string;
  items: OrderItem[];
};

const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
const FILTERS = ["ALL", "PENDING", "CONFIRMED", "CANCELLED"] as const;

export default function AdminOrdersPage() {
  const { t } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<(typeof FILTERS)[number]>("ALL");

  const statusLabels: Record<(typeof STATUSES)[number], string> = {
    PENDING: t("admin.orders.statusPending"),
    CONFIRMED: t("admin.orders.statusConfirmed"),
    CANCELLED: t("admin.orders.statusCancelled"),
  };

  const paymentMethodLabels: Record<string, string> = {
    CASH: t("checkout.paymentCash"),
    CREDIT: t("checkout.paymentCredit"),
    PAY_LATER: t("checkout.paymentPayLater"),
  };

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    ALL: t("admin.orders.filterAll"),
    PENDING: t("admin.orders.filterPending"),
    CONFIRMED: t("admin.orders.filterConfirmed"),
    CANCELLED: t("admin.orders.filterCancelled"),
  };

  // `quiet` refreshes in the background after an action instead of swapping
  // the whole list for the "loading..." text.
  async function loadOrders({ quiet = false }: { quiet?: boolean } = {}) {
    if (!quiet) setLoading(true);
    const res = await fetch("/api/orders");
    setOrders(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (res?.ok) await loadOrders({ quiet: true });
    setBusyId(null);
    toast(
      res?.ok ? t("admin.orders.toastStatusUpdated") : t("admin.orders.toastFailed"),
      res?.ok ? "success" : "error"
    );
  }

  async function deleteOrder(order: Order) {
    const ok = await confirm({
      title: t("admin.confirmDialog.orderTitle", { name: order.customerName }),
      message: t("admin.confirmDialog.orderBody"),
    });
    if (!ok) return;
    setBusyId(order.id);
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) await loadOrders({ quiet: true });
    setBusyId(null);
    toast(
      res?.ok ? t("admin.orders.toastDeleted") : t("admin.orders.toastFailed"),
      res?.ok ? "success" : "error"
    );
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
          const { discounts, vatPercent, vatAmount, total } = calculateOrderTotals(order.items, order, order.vatPercent);
          return (
            <li key={order.id} className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px]">
              <div className="flex items-start justify-between gap-4 mb-3.5">
                <div>
                  <p className="font-semibold text-[15px] text-[#1a1714]">{order.customerName}</p>
                  {order.businessName && (
                    <p className="text-[13px] text-[#6b6259]">{order.businessName}</p>
                  )}
                  <p className="text-[13px] text-[#6b6259]">{order.customerPhone}</p>
                  <p className="text-[13px] text-[#6b6259]">
                    {paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#a39a8e]">
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                  {busyId === order.id && <Spinner className="w-4 h-4 text-[#8a8177]" />}
                  <select
                    value={order.status}
                    disabled={busyId === order.id}
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
                  {order.status === ORDER_STATUS.CANCELLED && (
                    <button
                      onClick={() => deleteOrder(order)}
                      disabled={busyId === order.id}
                      title={t("admin.orders.delete")}
                      aria-label={t("admin.orders.delete")}
                      className="w-8 h-8 flex items-center justify-center rounded-[8px] disabled:opacity-60 border border-[#e6e0d6] text-[#b3402e]"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-[#faf8f5] rounded-[10px] px-3.5 py-3 flex flex-col gap-1.5 text-[13px] text-[#4a443c]">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span>
                      {t("admin.orders.itemLine", {
                        qty: item.quantity,
                        unit: t(
                          `catalog.${item.quantity === 1 ? "unitName" : "unitMany"}.${asProductUnit(item.product.unit)}`
                        ),
                        name: item.product.name,
                        price: item.price.toFixed(2),
                        per: t(`catalog.perUnit.${asProductUnit(item.product.unit)}`),
                      })}
                      {item.discountPercent ? (
                        <span className="text-[#2f6b3a]">
                          {" · "}
                          {item.couponCode} ‎-{item.discountPercent}%
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
                {discounts.map((discount) => (
                  <div
                    key={`${discount.code}-${discount.percent}`}
                    className="flex items-center justify-between text-[#2f6b3a]"
                  >
                    <span>{t("admin.orders.couponLine", { code: discount.code, percent: discount.percent })}</span>
                    <span>-₪{discount.amount.toFixed(2)}</span>
                  </div>
                ))}
                {vatPercent ? (
                  <div className="flex items-center justify-between text-[#6b6259]">
                    <span>{t("admin.orders.vatLine", { percent: vatPercent })}</span>
                    <span>+₪{vatAmount.toFixed(2)}</span>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between mt-3.5">
                <div className="flex flex-col gap-0.5">
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${order.whatsappSentAt ? "text-[#2f6b3a]" : "text-[#8a5a06]"}`}
                  >
                    {order.whatsappSentAt && <CheckIcon className="w-3 h-3" />}
                    {order.whatsappSentAt
                      ? t("admin.orders.whatsappSent")
                      : t("admin.orders.whatsappNotSent")}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${order.buyerWhatsappSentAt ? "text-[#2f6b3a]" : "text-[#8a5a06]"}`}
                  >
                    {order.buyerWhatsappSentAt && <CheckIcon className="w-3 h-3" />}
                    {order.buyerWhatsappSentAt
                      ? t("admin.orders.buyerWhatsappSent")
                      : t("admin.orders.buyerWhatsappNotSent")}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${order.emailSentAt ? "text-[#2f6b3a]" : "text-[#8a5a06]"}`}
                  >
                    {order.emailSentAt && <CheckIcon className="w-3 h-3" />}
                    {order.emailSentAt
                      ? t("admin.orders.emailSent")
                      : t("admin.orders.emailNotSent")}
                  </span>
                </div>
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
