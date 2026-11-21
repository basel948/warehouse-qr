"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { formatLocalPhone, isValidIsraeliPhone } from "@/lib/phone";

type CustomerType = {
  id: string;
  name: string;
  icon: string;
  _count: { buyers: number; prices: number };
};

type Buyer = {
  id: string;
  phone: string;
  name: string;
  businessName: string;
  lastLoginAt: string;
  customerType: { id: string; name: string } | null;
  _count: { orders: number };
};

// Icons the owner can pick for a type; shown on its card in the shop's login.
const ICON_CHOICES = ["🍽️", "🏫", "🏬", "🏨", "☕", "🍕", "🏥", "🧸", "🏢", "🏭", "🛒", "🚚", "🕌", "⛪", "🧼", "⭐"];

function IconPicker({ value, onChange, label }: { value: string; onChange: (icon: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {ICON_CHOICES.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={icon === value}
          onClick={() => onChange(icon)}
          className={`w-9 h-9 rounded-[9px] text-[19px] leading-none flex items-center justify-center border-2 ${
            icon === value ? "border-[var(--accent)] bg-[#f7f5f1]" : "border-transparent hover:bg-[#f7f5f1]"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// Customer types (each has its own prices, set on the price lists page) and
// everyone who logged in to the shop with the type they chose.
export default function AdminCustomersPage() {
  const { t, locale } = useLocale();
  const confirm = useConfirm();
  const toast = useToast();
  const [types, setTypes] = useState<CustomerType[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(ICON_CHOICES[0]);
  const [renameIcon, setRenameIcon] = useState(ICON_CHOICES[0]);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newBuyer, setNewBuyer] = useState({ phone: "", name: "", businessName: "", customerTypeId: "" });
  const [buyerError, setBuyerError] = useState<string | null>(null);
  const [addingBuyer, setAddingBuyer] = useState(false);

  async function load() {
    const [typesRes, buyersRes] = await Promise.all([fetch("/api/customer-types"), fetch("/api/buyers")]);
    setTypes(await typesRes.json());
    setBuyers(await buyersRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    const res = await fetch("/api/customer-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), icon: newIcon }),
    });
    if (!res.ok) {
      setError(t("admin.customers.addTypeFailed"));
      return;
    }
    setNewName("");
    setNewIcon(ICON_CHOICES[0]);
    toast(t("admin.customers.toastSaved"));
    load();
  }

  async function saveRename(type: CustomerType) {
    const name = renameValue.trim();
    if (!name || (name === type.name && renameIcon === type.icon)) {
      setRenamingId(null);
      return;
    }
    const res = await fetch(`/api/customer-types/${type.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon: renameIcon }),
    });
    setRenamingId(null);
    if (res.ok) toast(t("admin.customers.toastSaved"));
    load();
  }

  async function deleteType(type: CustomerType) {
    const ok = await confirm({
      title: t("admin.customers.deleteTypeTitle", { name: type.name }),
      message: t("admin.customers.deleteTypeBody"),
    });
    if (!ok) return;
    await fetch(`/api/customer-types/${type.id}`, { method: "DELETE" });
    toast(t("admin.customers.toastDeleted"));
    load();
  }

  async function addBuyer(e: React.FormEvent) {
    e.preventDefault();
    setBuyerError(null);
    if (!isValidIsraeliPhone(newBuyer.phone)) {
      setBuyerError(t("admin.customers.invalidPhone"));
      return;
    }
    const customerTypeId = newBuyer.customerTypeId || types[0]?.id;
    if (!customerTypeId) return;
    setAddingBuyer(true);
    const res = await fetch("/api/buyers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newBuyer, customerTypeId }),
    });
    setAddingBuyer(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setBuyerError(
        data.error === "phone_exists"
          ? t("admin.customers.buyerExists")
          : data.error === "invalid_phone"
            ? t("admin.customers.invalidPhone")
            : t("admin.customers.addBuyerFailed")
      );
      return;
    }
    setNewBuyer({ phone: "", name: "", businessName: "", customerTypeId });
    toast(t("admin.customers.toastSaved"));
    load();
  }

  async function changeBuyerType(buyer: Buyer, customerTypeId: string) {
    setBuyers((prev) =>
      prev.map((b) =>
        b.id === buyer.id
          ? { ...b, customerType: types.find((type) => type.id === customerTypeId) ?? b.customerType }
          : b
      )
    );
    const res = await fetch(`/api/buyers/${buyer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerTypeId }),
    });
    if (res.ok) toast(t("admin.customers.toastSaved"));
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-[22px]">
      <section>
        <h2 className="text-base font-bold text-[#1a1714] mb-1">{t("admin.customers.typesTitle")}</h2>
        <p className="text-[13px] text-[#6b6259] mb-3">{t("admin.customers.typesHint")}</p>
        <form
          onSubmit={addType}
          className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px] flex flex-wrap gap-2.5 items-center mb-3"
        >
          <span className="text-[26px] leading-none" aria-hidden>
            {newIcon}
          </span>
          <input
            type="text"
            placeholder={t("admin.customers.typeNamePlaceholder")}
            value={newName}
            maxLength={60}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-0 border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
          />
          <button
            type="submit"
            className="shrink-0 bg-[var(--accent)] text-white rounded-[10px] px-5 py-2.5 text-sm font-semibold"
          >
            {t("admin.customers.addType")}
          </button>
          <div className="basis-full">
            <p className="text-xs font-semibold text-[#6b6259] mb-1">{t("admin.customers.iconLabel")}</p>
            <IconPicker value={newIcon} onChange={setNewIcon} label={t("admin.customers.iconLabel")} />
          </div>
        </form>
        {error && <p className="text-sm text-[#b3402e] mb-2">{error}</p>}

        {loading ? (
          <p className="text-sm text-[#8a8177]">{t("admin.customers.loading")}</p>
        ) : types.length === 0 ? (
          <p className="text-sm text-[#b3402e]">{t("admin.customers.noTypesYet")}</p>
        ) : (
          <ul className="divide-y divide-[#f2efe9] bg-white border border-[#eae5dc] rounded-[14px] overflow-hidden">
            {types.map((type) => (
              <li key={type.id} className="flex items-center justify-between gap-3 px-[18px] py-[13px]">
                {renamingId === type.id ? (
                  <form
                    className="flex-1 flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveRename(type);
                    }}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      maxLength={60}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 min-w-0 border border-[#e6e0d6] rounded-[9px] px-3 py-1.5 text-sm bg-white"
                    />
                    <button type="submit" className="text-[13px] font-semibold text-[var(--accent)]">
                      {t("admin.customers.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="text-[13px] text-[#6b6259]"
                    >
                      {t("admin.customers.cancel")}
                    </button>
                    <div className="basis-full">
                      <IconPicker value={renameIcon} onChange={setRenameIcon} label={t("admin.customers.iconLabel")} />
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="text-[26px] leading-none shrink-0" aria-hidden>
                        {type.icon}
                      </span>
                      <div className="min-w-0">
                      <p className="font-semibold text-[15px] text-[#1a1714]">{type.name}</p>
                      <p className="text-xs text-[#8a8177]">
                        {t("admin.customers.buyersCount", { count: type._count.buyers })} ·{" "}
                        {t("admin.customers.pricesCount", { count: type._count.prices })}
                      </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => {
                          setRenamingId(type.id);
                          setRenameValue(type.name);
                          setRenameIcon(type.icon);
                        }}
                        className="text-[13px] text-[#6b6259] underline"
                      >
                        {t("admin.customers.rename")}
                      </button>
                      <button onClick={() => deleteType(type)} className="text-[13px] text-[#b3402e] underline">
                        {t("admin.customers.delete")}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-[#1a1714] mb-1">{t("admin.customers.buyersTitle")}</h2>
        <p className="text-[13px] text-[#6b6259] mb-3">{t("admin.customers.buyersHint")}</p>
        {types.length > 0 && (
          <form onSubmit={addBuyer} className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px] mb-3">
            <p className="text-sm font-bold text-[#1a1714] mb-2.5">{t("admin.customers.addBuyerTitle")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="tel"
                inputMode="tel"
                placeholder={t("admin.customers.buyerPhone")}
                value={newBuyer.phone}
                maxLength={CHECKOUT_LIMITS.phone}
                onChange={(e) => setNewBuyer((prev) => ({ ...prev, phone: e.target.value }))}
                className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
              <select
                value={newBuyer.customerTypeId || types[0]?.id}
                onChange={(e) => setNewBuyer((prev) => ({ ...prev, customerTypeId: e.target.value }))}
                aria-label={t("admin.customers.chooseType")}
                className="border border-[#e6e0d6] rounded-[10px] px-3 py-2.5 bg-[#f7f5f1]"
              >
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t("admin.customers.buyerName")}
                value={newBuyer.name}
                maxLength={CHECKOUT_LIMITS.name}
                onChange={(e) => setNewBuyer((prev) => ({ ...prev, name: e.target.value }))}
                className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
              <input
                type="text"
                placeholder={t("admin.customers.buyerBusiness")}
                value={newBuyer.businessName}
                maxLength={CHECKOUT_LIMITS.businessName}
                onChange={(e) => setNewBuyer((prev) => ({ ...prev, businessName: e.target.value }))}
                className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="submit"
                disabled={addingBuyer}
                className="bg-[var(--accent)] text-white rounded-[10px] px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {t("admin.customers.addBuyer")}
              </button>
              {buyerError && <p className="text-sm text-[#b3402e]">{buyerError}</p>}
            </div>
          </form>
        )}
        {loading ? null : buyers.length === 0 ? (
          <p className="text-sm text-[#8a8177]">{t("admin.customers.noBuyersYet")}</p>
        ) : (
          <ul className="divide-y divide-[#f2efe9] bg-white border border-[#eae5dc] rounded-[14px] overflow-hidden">
            {buyers.map((buyer) => (
              <li key={buyer.id} className="flex items-start justify-between gap-3 px-[18px] py-[13px]">
                <div className="min-w-0">
                  <p className="font-semibold text-[15px] text-[#1a1714]">
                    <span dir="ltr">{formatLocalPhone(buyer.phone)}</span>
                    {(buyer.businessName || buyer.name) && (
                      <span className="font-normal text-[#4a443c]">
                        {" · "}
                        {[buyer.businessName, buyer.name].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#8a8177] mt-1 flex flex-wrap items-center gap-x-1">
                    {/* The owner can change the type (= the prices this buyer sees). */}
                    <select
                      value={buyer.customerType?.id ?? ""}
                      onChange={(e) => changeBuyerType(buyer, e.target.value)}
                      aria-label={t("admin.customers.changeType", { phone: formatLocalPhone(buyer.phone) })}
                      className="font-semibold text-[var(--secondary)] bg-[#f7f5f1] border border-[#e6e0d6] rounded-[8px] px-1.5 py-0.5"
                    >
                      {!buyer.customerType && <option value="">{t("admin.customers.noType")}</option>}
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    {" · "}
                    {t("admin.customers.lastLogin", { date: dateFormat.format(new Date(buyer.lastLoginAt)) })}
                    {" · "}
                    {t("admin.customers.ordersCount", { count: buyer._count.orders })}
                  </p>
                </div>
                <button
                  onClick={() => deleteBuyer(buyer)}
                  className="shrink-0 text-[13px] text-[#b3402e] underline"
                >
                  {t("admin.customers.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
