"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { MergeOptionsDialog, type MergeProduct } from "./merge-options-dialog";

// The product edit window's note about cards (several products shown as one
// shop card). Cards are made and undone only from the arrange list's black
// bar (tick -> merge / unmerge); here the owner sees which card the product
// is on and can edit the card's names and option order.
export function VariantOptionsSection({
  product,
  allProducts,
  onChanged,
}: {
  product: MergeProduct;
  allProducts: MergeProduct[];
  /** Reloads the products; resolves when done. */
  onChanged: () => Promise<void>;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const [editingNames, setEditingNames] = useState(false);
  const group = product.variantGroup;
  const siblings = group
    ? allProducts.filter((p) => p.variantGroup?.id === group.id).sort((a, b) => a.variantOrder - b.variantOrder)
    : [];

  if (!group) {
    return <p className="text-[12px] text-[#8a8177]">{t("admin.variants.howToMerge")}</p>;
  }

  return (
    <div className="border border-[#c9d4ee] rounded-[12px] p-3 bg-[#f5f8fe] flex flex-col gap-2">
      <p className="text-[13px] text-[#33508f]">
        {t("admin.variants.onCard", { card: group.name, count: siblings.length })}
        <span className="block text-[12px] text-[#5a6b8f]">
          {siblings.map((s) => s.variantLabel || s.name).join(" · ")}
        </span>
      </p>
      <button
        type="button"
        onClick={() => setEditingNames(true)}
        className="self-start text-[13px] font-semibold text-[#33508f] border border-[#c9d4ee] bg-white rounded-[9px] px-3 py-1.5"
      >
        {t("admin.variants.editNames")}
      </button>
      {editingNames && (
        <MergeOptionsDialog
          products={siblings}
          allProducts={allProducts}
          onClose={() => setEditingNames(false)}
          onMerged={async () => {
            setEditingNames(false);
            toast(t("admin.variants.namesSaved"));
            await onChanged();
          }}
        />
      )}
    </div>
  );
}
