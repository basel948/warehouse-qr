"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { isValidBusinessId } from "@/lib/business-id";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { formatLocalPhone } from "@/lib/phone";

type Buyer = {
  id: string;
  phone: string;
  name: string;
  businessName: string;
  businessId: string;
  lastLoginAt: string;
  _count: { orders: number };
};

type BuyerEdit = { name: string; businessName: string; businessId: string };

// Everyone who signed up in the shop (first name, business name, ח.פ, phone).
// Buyers sign up themselves; the owner can fix their details or remove them.
export default function AdminCustomersPage() {
  const { t, locale } = useLocale();
  const confirm = useConfirm();
  const toast = useToast();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<BuyerEdit>({ name: "", businessName: "", businessId: "" });

  async function load() {
    const res = await fetch("/api/buyers");
    setBuyers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveEdit(buyer: Buyer) {
    if (!edit.name.trim() || !edit.businessName.trim() || !edit.businessId.trim()) {
      toast(t("admin.customers.missingInfo"), "error");
      return;
    }
    if (!isValidBusinessId(edit.businessId)) {
      toast(t("admin.customers.invalidBusinessId"), "error");
      return;
    }
    const res = await fetch(`/api/buyers/${buyer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (!res.ok) {
      toast(t("admin.customers.missingInfo"), "error");
      return;
    }
    setEditingId(null);
    toast(t("admin.customers.toastSaved"));
    load();
  }

  async function deleteBuyer(buyer: Buyer) {
    const phone = formatLocalPhone(buyer.phone);
    const ok = await confirm({
      title: t("admin.customers.deleteBuyerTitle", { phone }),
      message: t("admin.customers.deleteBuyerBody"),
    });
    if (!ok) return;
    await fetch(`/api/buyers/${buyer.id}`, { method: "DELETE" });
    toast(t("admin.customers.toastDeleted"));
    load();
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "he", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const inputClass = "flex-1 min-w-[120px] border border-[#e6e0d6] rounded-[9px] px-3 py-1.5 text-sm bg-white";

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <h1 className="text-xl font-bold text-[#1a1714] mb-1">{t("admin.customers.title")}</h1>
      <p className="text-[13px] text-[#6b6259] mb-3">{t("admin.customers.hint")}</p>

      {loading ? (
        <p className="text-sm text-[#8a8177]">{t("admin.customers.loading")}</p>
      ) : buyers.length === 0 ? (
        <p className="text-sm text-[#8a8177]">{t("admin.customers.noBuyersYet")}</p>
      ) : (
        <ul className="divide-y divide-[#f2efe9] bg-white border border-[#eae5dc] rounded-[14px] overflow-hidden">
          {buyers.map((buyer) => (
            <li key={buyer.id} className="flex items-start justify-between gap-3 px-[18px] py-[13px]">
              <div className="min-w-0 flex-1">
                {editingId === buyer.id ? (
                  <form
                    className="flex flex-wrap items-center gap-2 mb-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveEdit(buyer);
                    }}
                  >
                    <input
                      autoFocus
                      value={edit.name}
                      maxLength={CHECKOUT_LIMITS.name}
                      placeholder={t("admin.customers.firstName")}
                      aria-label={t("admin.customers.firstName")}
                      onChange={(e) => setEdit((prev) => ({ ...prev, name: e.target.value }))}
                      className={inputClass}
                    />
                    <input
                      value={edit.businessName}
                      maxLength={CHECKOUT_LIMITS.businessName}
                      placeholder={t("admin.customers.businessName")}
                      aria-label={t("admin.customers.businessName")}
                      onChange={(e) => setEdit((prev) => ({ ...prev, businessName: e.target.value }))}
                      className={inputClass}
                    />
                    <input
                      value={edit.businessId}
                      inputMode="numeric"
                      maxLength={CHECKOUT_LIMITS.businessId}
                      placeholder={t("admin.customers.businessId")}
                      aria-label={t("admin.customers.businessId")}
                      onChange={(e) => setEdit((prev) => ({ ...prev, businessId: e.target.value }))}
                      className={inputClass}
                    />
                    <button type="submit" className="text-[13px] font-semibold text-[var(--accent)]">
                      {t("admin.customers.save")}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-[13px] text-[#6b6259]">
                      {t("admin.customers.cancel")}
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="font-semibold text-[15px] text-[#1a1714]">
                      {buyer.businessName || "-"}
                      {buyer.name && <span className="font-normal text-[#4a443c]"> · {buyer.name}</span>}
                    </p>
                    <p className="text-[13px] text-[#4a443c]">
                      <span dir="ltr">{formatLocalPhone(buyer.phone)}</span>
                      {buyer.businessId && <> · {t("admin.customers.businessIdLine", { id: buyer.businessId })}</>}
                    </p>
                  </>
                )}
                <p className="text-xs text-[#8a8177] mt-1">
                  {t("admin.customers.lastLogin", { date: dateFormat.format(new Date(buyer.lastLoginAt)) })}
                  {" · "}
                  {t("admin.customers.ordersCount", { count: buyer._count.orders })}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditingId(buyer.id);
                    setEdit({ name: buyer.name, businessName: buyer.businessName, businessId: buyer.businessId });
                  }}
                  className="text-[13px] text-[#6b6259] underline"
                >
                  {t("admin.customers.edit")}
                </button>
                <button onClick={() => deleteBuyer(buyer)} className="text-[13px] text-[#b3402e] underline">
                  {t("admin.customers.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
