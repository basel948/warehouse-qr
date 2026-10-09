"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

// Labels suggested for merged products: each name without the words all the
// names start with ("מזלג פלסטיק שחור", "מזלג פלסטיק קרם" -> "שחור", "קרם").
export function suggestLabels(names: string[]): { cardName: string; labels: string[] } {
  // Nothing to compare (and `every` on an empty list would never stop the loop).
  if (names.length < 2) return { cardName: names[0] ?? "", labels: names };
  const words = names.map((n) => n.trim().split(/\s+/));
  let common = 0;
  while (
    words.every((w) => w.length > common + 1) &&
    words.every((w) => w[common] === words[0][common])
  ) {
    common++;
  }
  if (common === 0) return { cardName: names[0], labels: names };
  return {
    cardName: words[0].slice(0, common).join(" "),
    labels: words.map((w) => w.slice(common).join(" ")),
  };
}

export type MergeProduct = {
  id: string;
  name: string;
  variantGroup: { id: string; name: string } | null;
  variantLabel: string | null;
  variantOrder: number;
};

// "Merge into one card": names the card and each product's option label, in
// the order the options will show (up / down to change it). If a ticked
// product is already on a card, the others are added to that card: all its
// options are listed (names kept), new ones last. Opened from the edit window
// with a card's options, it's "edit names and order" for that card.
export function MergeOptionsDialog({
  products,
  allProducts,
  onClose,
  onMerged,
}: {
  products: MergeProduct[];
  allProducts: MergeProduct[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const { t } = useLocale();
  // The card to add to: the one most ticked products are already on.
  const [target] = useState(() => {
    const counts = new Map<string, { group: { id: string; name: string }; count: number }>();
    for (const p of products) {
      if (!p.variantGroup) continue;
      const entry = counts.get(p.variantGroup.id) ?? { group: p.variantGroup, count: 0 };
      entry.count++;
      counts.set(p.variantGroup.id, entry);
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count)[0]?.group ?? null;
  });
  const [items, setItems] = useState(() => {
    const existing = target
      ? allProducts.filter((p) => p.variantGroup?.id === target.id).sort((a, b) => a.variantOrder - b.variantOrder)
      : [];
    const added = products.filter((p) => !existing.some((e) => e.id === p.id));
    const { labels } = suggestLabels(added.map((p) => p.name));
    return [
      ...existing.map((p) => ({ id: p.id, name: p.name, label: p.variantLabel || p.name })),
      ...added.map((p, i) => ({ id: p.id, name: p.name, label: added.length > 1 ? labels[i] : p.name })),
    ];
  });
  const [cardName, setCardName] = useState(
    () => target?.name ?? suggestLabels(products.map((p) => p.name)).cardName
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function move(index: number, delta: number) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setItems(next);
  }

  async function save() {
    setError(null);
    if (!cardName.trim() || items.some((i) => !i.label.trim())) {
      setError(t("admin.variants.fillAll"));
      return;
    }
    setBusy(true);
    const body = JSON.stringify({
      name: cardName.trim(),
      options: items.map((i) => ({ productId: i.id, label: i.label.trim() })),
    });
    const headers = { "Content-Type": "application/json" };
    const res = target
      ? await fetch(`/api/variant-groups/${target.id}`, { method: "PATCH", headers, body })
      : await fetch("/api/variant-groups", { method: "POST", headers, body });
    setBusy(false);
    if (!res.ok) {
      setError(t("admin.variants.failed"));
      return;
    }
    onMerged();
  }

  const field = "w-full border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#1a1714]/55 !mt-0" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={target ? t("admin.variants.editNamesTitle") : t("admin.variants.mergeTitle")}
        className="w-full max-w-md bg-white rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain shadow-xl p-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-bold text-[#1a1714] mb-1">
          {target ? t("admin.variants.editNamesTitle") : t("admin.variants.mergeTitle")}
        </h2>
        <p className="text-[13px] text-[#6b6259] mb-3.5">
          {target ? t("admin.variants.editNamesBody") : t("admin.variants.mergeBody")}
        </p>

        <label className="block mb-3">
          <span className="block text-xs font-semibold text-[#6b6259] mb-1">{t("admin.variants.cardName")}</span>
          <input value={cardName} onChange={(e) => setCardName(e.target.value)} className={field} />
        </label>

        <p className="text-xs font-semibold text-[#6b6259] mb-1.5">{t("admin.variants.optionLabels")}</p>
        <ul className="flex flex-col gap-2 mb-3">
          {items.map((item, index) => (
            <li key={item.id} className="border border-[#eae5dc] rounded-[10px] p-2.5">
              <p className="text-[12px] text-[#8a8177] mb-1 truncate">{item.name}</p>
              <div className="flex gap-1.5">
                <input
                  value={item.label}
                  onChange={(e) =>
                    setItems(items.map((it) => (it.id === item.id ? { ...it, label: e.target.value } : it)))
                  }
                  className={field}
                />
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t("admin.variants.moveUp")}
                  className="shrink-0 w-9 border border-[#e6e0d6] rounded-[9px] text-[#4a443c] disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t("admin.variants.moveDown")}
                  className="shrink-0 w-9 border border-[#e6e0d6] rounded-[9px] text-[#4a443c] disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-[#b3402e] mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="flex-1 bg-[var(--accent)] text-white rounded-[10px] py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {target ? t("admin.variants.save") : t("admin.variants.merge")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-[#e6e0d6] rounded-[10px] py-2.5 text-sm font-semibold text-[#4a443c]"
          >
            {t("admin.variants.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
