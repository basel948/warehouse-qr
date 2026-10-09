"use client";

import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";

export type VariantProduct = {
  id: string;
  name: string;
  inStock: boolean;
  variantGroup: { id: string; name: string } | null;
  variantLabel: string | null;
  variantOrder: number;
};

// The "options" part of the product edit window: shows the card this product
// is an option of (its name, the other options to jump to, this option's
// label), and adds a new option - a copy of this product with another label,
// creating the card first if needed. Also takes this option off the card, or
// splits the whole card back into separate products.
export function VariantOptionsSection<P extends VariantProduct>({
  product,
  allProducts,
  label,
  onLabelChange,
  onChanged,
  onOpenProduct,
}: {
  product: P;
  allProducts: P[];
  /** This option's label, saved with the rest of the edit window. */
  label: string;
  onLabelChange: (label: string) => void;
  /** Reloads the products; resolves when done. */
  onChanged: () => Promise<void>;
  /** Switches the edit window to another product (by id, after reload). */
  onOpenProduct: (productId: string) => void;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const group = product.variantGroup;
  const siblings = group
    ? allProducts.filter((p) => p.variantGroup?.id === group.id).sort((a, b) => a.variantOrder - b.variantOrder)
    : [];

  const [adding, setAdding] = useState(false);
  const [cardName, setCardName] = useState(group?.name ?? product.name);
  const [sourceLabel, setSourceLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const field = "w-full border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white";
  const labelClass = "block text-xs font-semibold text-[#6b6259] mb-1";

  async function addOption() {
    setError(null);
    if (!newLabel.trim() || (!group && (!cardName.trim() || !sourceLabel.trim()))) {
      setError(t("admin.variants.fillAll"));
      return;
    }
    setBusy(true);
    const res = await fetch("/api/variant-groups/add-option", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceProductId: product.id,
        label: newLabel.trim(),
        ...(group ? {} : { groupName: cardName.trim(), sourceLabel: sourceLabel.trim() }),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("admin.variants.failed"));
      return;
    }
    const created: { id: string } = await res.json();
    toast(t("admin.variants.optionAdded", { label: newLabel.trim() }));
    setNewLabel("");
    setAdding(false);
    await onChanged();
    // Straight to the new option, to set its price / photo / stock.
    onOpenProduct(created.id);
  }

  async function renameCard() {
    if (!group || !cardName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/variant-groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cardName.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      toast(t("admin.variants.failed"), "error");
      return;
    }
    setRenaming(false);
    toast(t("admin.variants.renamed"));
    await onChanged();
  }

  async function removeFromCard() {
    const ok = await confirm({
      title: t("admin.variants.removeTitle", { name: product.name }),
      message: t("admin.variants.removeBody"),
      confirmLabel: t("admin.variants.remove"),
      tone: "normal",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantGroupId: null }),
    });
    setBusy(false);
    if (!res.ok) {
      toast(t("admin.variants.failed"), "error");
      return;
    }
    toast(t("admin.variants.removed"));
    await onChanged();
  }

  async function splitCard() {
    if (!group) return;
    const ok = await confirm({
      title: t("admin.variants.splitTitle", { name: group.name }),
      message: t("admin.variants.splitBody", { count: siblings.length }),
      confirmLabel: t("admin.variants.split"),
      tone: "normal",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/variant-groups/${group.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast(t("admin.variants.failed"), "error");
      return;
    }
    toast(t("admin.variants.splitDone"));
    await onChanged();
  }

  return (
    <div className="border border-[#eae5dc] rounded-[12px] p-3 bg-[#faf8f5] flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-[#1a1714]">{t("admin.variants.title")}</p>
        {group && (
          <span className="text-[11px] text-[#8a8177]">{t("admin.variants.optionsCount", { count: siblings.length })}</span>
        )}
      </div>

      {group ? (
        <>
          {renaming ? (
            <div className="flex gap-2">
              <input value={cardName} onChange={(e) => setCardName(e.target.value)} className={field} />
              <button
                type="button"
                disabled={busy}
                onClick={renameCard}
                className="shrink-0 bg-[#1a1714] text-white rounded-[9px] px-3 text-[13px] font-semibold disabled:opacity-50"
              >
                {t("admin.variants.save")}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[#4a443c]">
              {t("admin.variants.cardName")}: <span className="font-semibold">{group.name}</span>{" "}
              <button type="button" onClick={() => setRenaming(true)} className="text-[12px] text-[#6b6259] underline">
                {t("admin.variants.rename")}
              </button>
            </p>
          )}

          <label>
            <span className={labelClass}>{t("admin.variants.thisOptionLabel")}</span>
            <input value={label} onChange={(e) => onLabelChange(e.target.value)} className={field} />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {siblings.map((sibling) => (
              <button
                key={sibling.id}
                type="button"
                onClick={() => sibling.id !== product.id && onOpenProduct(sibling.id)}
                className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${
                  sibling.id === product.id
                    ? "bg-[#1a1714] border-[#1a1714] text-white"
                    : "bg-white border-[#e6e0d6] text-[#4a443c]"
                } ${sibling.inStock ? "" : "line-through opacity-70"}`}
              >
                {sibling.variantLabel || sibling.name}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#8a8177]">{t("admin.variants.tapToEdit")}</p>
        </>
      ) : (
        <p className="text-[12px] text-[#6b6259]">{t("admin.variants.explain")}</p>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 border-t border-[#eae5dc] pt-2.5">
          {!group && (
            <>
              <label>
                <span className={labelClass}>{t("admin.variants.cardName")}</span>
                <input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder={t("admin.variants.cardNamePlaceholder")}
                  className={field}
                />
              </label>
              <label>
                <span className={labelClass}>{t("admin.variants.thisOptionLabel")}</span>
                <input
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                  placeholder={t("admin.variants.labelPlaceholder")}
                  className={field}
                />
              </label>
            </>
          )}
          <label>
            <span className={labelClass}>{t("admin.variants.newOptionLabel")}</span>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t("admin.variants.labelPlaceholder")}
              className={field}
            />
          </label>
          <p className="text-[11px] text-[#8a8177]">{t("admin.variants.copyNote")}</p>
          {error && <p className="text-[12px] text-[#b3402e]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={addOption}
              className="flex-1 bg-[var(--accent)] text-white rounded-[9px] py-2 text-[13px] font-semibold disabled:opacity-50"
            >
              {t("admin.variants.addOption")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-[13px] font-semibold text-[#4a443c]"
            >
              {t("admin.variants.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[13px] font-semibold text-[var(--accent)] border border-[var(--accent)] rounded-[9px] px-3 py-1.5"
          >
            + {t("admin.variants.addOption")}
          </button>
          {group && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={removeFromCard}
                className="text-[13px] font-medium text-[#6b6259] underline px-1 disabled:opacity-50"
              >
                {t("admin.variants.remove")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={splitCard}
                className="text-[13px] font-medium text-[#6b6259] underline px-1 disabled:opacity-50"
              >
                {t("admin.variants.split")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
