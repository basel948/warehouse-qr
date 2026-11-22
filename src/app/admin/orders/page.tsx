"use client";

import { useEffect, useState } from "react";
import { CheckIcon, TrashIcon, WhatsAppIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { Spinner, useToast } from "@/components/toast";
import { WAREHOUSE_NAME } from "@/lib/branding";
import { ORDER_STATUS } from "@/lib/order-status";
import { VAT_PERCENT, calculateOrderTotals } from "@/lib/order-totals";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { asProductUnit } from "@/lib/product-unit";

type OrderItem = {
  id: string;
  quantity: number;
  /** Null until the owner prices the order. */
  price: number | null;
  couponCode: string | null;
  discountPercent: number | null;
  product: { name: string; unit: string };
};

type Order = {
  id: string;
  customerName: string;
  businessName: string;
  businessId: string;
  customerPhone: string;
  status: string;
  emailSentAt: string | null;
  couponCode: string | null;
  discountPercent: number | null;
  vatPercent: number | null;
  pricedAt: string | null;
  sentToBuyerAt: string | null;
  shareToken: string | null;
  createdAt: string;
  items: OrderItem[];
};

const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
const FILTERS = ["ALL", "TO_PRICE", "PENDING", "CONFIRMED", "CANCELLED"] as const;

const needsPricing = (order: Order) => !order.pricedAt && order.status !== ORDER_STATUS.CANCELLED;

/** "12.5" / "12,5" -> 12.5; anything else (empty, negative, text) -> null. */
function parsePrice(value: string): number | null {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
}

// Orders arrive as requests without prices. The owner prices each one here
// ("price the order"), then sends the buyer a WhatsApp message with a link to
// the priced PDF (/q/<token>).
export default function AdminOrdersPage() {
  const { t } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<(typeof FILTERS)[number]>("ALL");
  // The order being priced, and the typed prices by item id.
  const [pricingId, setPricingId] = useState<string | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  const statusLabels: Record<(typeof STATUSES)[number], string> = {
    PENDING: t("admin.orders.statusPending"),
    CONFIRMED: t("admin.orders.statusConfirmed"),
    CANCELLED: t("admin.orders.statusCancelled"),
  };

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    ALL: t("admin.orders.filterAll"),
    TO_PRICE: t("admin.orders.filterToPrice"),
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

  async function patchOrder(id: string, body: object): Promise<boolean> {
    setBusyId(id);
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) await loadOrders({ quiet: true });
    setBusyId(null);
    return Boolean(res?.ok);
  }

  async function updateStatus(id: string, status: string) {
    const ok = await patchOrder(id, { status });
    toast(ok ? t("admin.orders.toastStatusUpdated") : t("admin.orders.toastFailed"), ok ? "success" : "error");
  }

  function startPricing(order: Order) {
    setPricingId(order.id);
    setPriceInputs(
      Object.fromEntries(order.items.map((item) => [item.id, item.price != null ? String(item.price) : ""]))
    );
  }

  async function savePrices(order: Order) {
    const prices = order.items.map((item) => ({ itemId: item.id, price: parsePrice(priceInputs[item.id] ?? "") }));
    if (prices.some((p) => p.price == null)) {
      toast(t("admin.orders.missingPrices"), "error");
      return;
    }
    const ok = await patchOrder(order.id, { prices });
    if (ok) setPricingId(null);
    toast(ok ? t("admin.orders.toastPricesSaved") : t("admin.orders.toastFailed"), ok ? "success" : "error");
  }

  // Opens WhatsApp to the buyer with a ready message and the PDF link, then
  // records that it was sent. window.open runs first, straight from the tap,
  // so phones don't block it as a pop-up.
  function sendToBuyer(order: Order, total: number) {
    if (!order.shareToken) return;
    const link = `${window.location.origin}/q/${order.shareToken}`;
    const message = [
      `שלום ${order.customerName},`,
      `ההזמנה שלך מ${WAREHOUSE_NAME} (מס' ${order.id.slice(-6)}) מוכנה.`,
      `סה"כ לתשלום: ₪${total.toFixed(2)} (כולל מע"מ)`,
      "לצפייה בהזמנה עם המחירים:",
      link,
    ].join("\n");
    window.open(
      `https://wa.me/${normalizeIsraeliPhone(order.customerPhone)}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
    patchOrder(order.id, { markSent: true });
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

  const toPriceCount = orders.filter(needsPricing).length;
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const visibleOrders =
    filterStatus === "ALL"
      ? orders
      : filterStatus === "TO_PRICE"
        ? orders.filter(needsPricing)
        : orders.filter((o) => o.status === filterStatus);

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
        <div className="flex gap-1 text-[13px] font-semibold flex-wrap">
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
              {filter === "TO_PRICE" && toPriceCount > 0 ? ` ${toPriceCount}` : ""}
              {filter === "PENDING" && pendingCount > 0 ? ` ${pendingCount}` : ""}
            </button>
          ))}
        </div>
      </div>

      {visibleOrders.length === 0 && <p className="text-sm text-[#8a8177]">{t("admin.orders.noOrdersYet")}</p>}

      <ul className="space-y-3.5">
        {visibleOrders.map((order) => {
          const pricing = pricingId === order.id;
          const priced = order.pricedAt != null && order.items.every((item) => item.price != null);
          // While pricing: the typed prices (empty = 0) with VAT, as a live preview.
          const lines = order.items.map((item) => ({
            ...item,
            price: pricing ? parsePrice(priceInputs[item.id] ?? "") ?? 0 : item.price ?? 0,
          }));
          const { discounts, totalBeforeVat, vatPercent, vatAmount, total } = calculateOrderTotals(
            lines,
            order,
            pricing ? order.vatPercent ?? VAT_PERCENT : order.vatPercent
          );
          const showTotals = priced || pricing;
          const busy = busyId === order.id;
          return (
            <li key={order.id} className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px]">
              <div className="flex items-start justify-between gap-4 mb-3.5">
                <div className="min-w-0">
                  <p className="font-semibold text-[15px] text-[#1a1714]">
                    {order.businessName || order.customerName}
                  </p>
                  {order.businessName && <p className="text-[13px] text-[#6b6259]">{order.customerName}</p>}
                  {order.businessId && (
                    <p className="text-[13px] text-[#6b6259]">{t("admin.orders.businessId", { id: order.businessId })}</p>
                  )}
                  <p className="text-[13px] text-[#6b6259]" dir="ltr" style={{ textAlign: "end" }}>
                    {order.customerPhone}
                  </p>
                  {needsPricing(order) && !pricing && (
                    <span className="inline-block mt-1.5 text-xs font-bold bg-[#fdf6e8] border border-[#f0dfba] text-[#8a5a06] rounded-full px-2.5 py-0.5">
                      {t("admin.orders.awaitingPrice")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <span className="text-xs text-[#a39a8e]">{new Date(order.createdAt).toLocaleString()}</span>
                  {busy && <Spinner className="w-4 h-4 text-[#8a8177]" />}
                  <select
                    value={order.status}
                    disabled={busy}
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
                      disabled={busy}
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
                {pricing && (
                  <p className="text-xs text-[#6b6259] mb-1">
                    {t("admin.orders.pricesHint", { percent: order.vatPercent ?? VAT_PERCENT })}
                  </p>
                )}
                {order.items.map((item) => {
                  const unit = asProductUnit(item.product.unit);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        {t("admin.orders.itemLine", {
                          qty: item.quantity,
                          unit: t(`catalog.${item.quantity === 1 ? "unitName" : "unitMany"}.${unit}`),
                          name: item.product.name,
                        })}
                        {item.discountPercent ? (
                          <span className="text-[#2f6b3a]">
                            {" · "}
                            {item.couponCode} ‎-{item.discountPercent}%
                          </span>
                        ) : null}
                      </span>
                      {pricing ? (
                        <span className="shrink-0 flex items-center gap-1">
                          <span className="text-[#8a8177]">₪</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            dir="ltr"
                            value={priceInputs[item.id] ?? ""}
                            placeholder={t("admin.orders.pricePlaceholder")}
                            aria-label={t("admin.orders.priceFor", { name: item.product.name })}
                            onChange={(e) => setPriceInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className={`w-[84px] border rounded-[8px] px-2 py-1 text-sm bg-white ${
                              priceInputs[item.id] && parsePrice(priceInputs[item.id]) == null
                                ? "border-[#b3402e]"
                                : "border-[#e6e0d6]"
                            }`}
                          />
                          <span className="text-xs text-[#8a8177] w-12">{t(`catalog.perUnit.${unit}`)}</span>
                        </span>
                      ) : item.price != null ? (
                        <span className="shrink-0 text-[#6b6259]">
                          {t("admin.orders.itemPrice", { price: item.price.toFixed(2), per: t(`catalog.perUnit.${unit}`) })}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {showTotals && (
                  <>
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
                      <>
                        <div className="flex items-center justify-between text-[#6b6259] border-t border-[#eee8de] pt-1.5 mt-0.5">
                          <span>{t("admin.orders.totalBeforeVat")}</span>
                          <span>₪{totalBeforeVat.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#6b6259]">
                          <span>{t("admin.orders.vatLine", { percent: vatPercent })}</span>
                          <span>+₪{vatAmount.toFixed(2)}</span>
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </div>

              {pricing ? (
                <div className="flex items-center justify-between gap-3 mt-3.5 flex-wrap">
                  <span className="text-base font-bold text-[#1a1714]">
                    {t("admin.orders.total", { amount: total.toFixed(2) })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPricingId(null)}
                      disabled={busy}
                      className="text-[13px] font-semibold text-[#6b6259] px-3 py-2"
                    >
                      {t("admin.orders.cancel")}
                    </button>
                    <button
                      onClick={() => savePrices(order)}
                      disabled={busy}
                      className="bg-[var(--accent)] text-white rounded-[10px] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {t("admin.orders.savePrices")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-end justify-between gap-3 mt-3.5 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${order.emailSentAt ? "text-[#2f6b3a]" : "text-[#8a5a06]"}`}
                    >
                      {order.emailSentAt && <CheckIcon className="w-3 h-3" />}
                      {order.emailSentAt ? t("admin.orders.emailSent") : t("admin.orders.emailNotSent")}
                    </span>
                    {priced && order.shareToken && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs ${order.sentToBuyerAt ? "text-[#2f6b3a]" : "text-[#8a5a06]"}`}
                      >
                        {order.sentToBuyerAt && <CheckIcon className="w-3 h-3" />}
                        {order.sentToBuyerAt ? t("admin.orders.sentToBuyer") : t("admin.orders.notSentToBuyer")}
                      </span>
                    )}
                    {priced && (
                      <span className="text-base font-bold text-[#1a1714] mt-1">
                        {t("admin.orders.total", { amount: total.toFixed(2) })}
                      </span>
                    )}
                  </div>
                  {order.status !== ORDER_STATUS.CANCELLED && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {priced && order.shareToken && (
                        <a
                          href={`/q/${order.shareToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] font-semibold text-[#4a443c] border border-[#e6e0d6] rounded-[10px] px-3 py-2"
                        >
                          {t("admin.orders.viewPdf")}
                        </a>
                      )}
                      <button
                        onClick={() => startPricing(order)}
                        disabled={busy}
                        className={
                          priced
                            ? "text-[13px] font-semibold text-[#4a443c] border border-[#e6e0d6] rounded-[10px] px-3 py-2"
                            : "bg-[var(--accent)] text-white rounded-[10px] px-4 py-2 text-sm font-semibold"
                        }
                      >
                        {priced ? t("admin.orders.editPrices") : t("admin.orders.setPrices")}
                      </button>
                      {priced && order.shareToken && (
                        <button
                          onClick={() => sendToBuyer(order, total)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 bg-[#25D366] text-white rounded-[10px] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          <WhatsAppIcon className="w-4 h-4" />
                          {order.sentToBuyerAt ? t("admin.orders.resendWhatsapp") : t("admin.orders.sendWhatsapp")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
