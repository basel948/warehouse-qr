"use client";

import { useLocale } from "@/components/locale-provider";
import { type SortMode } from "@/lib/use-product-filters";

export function ProductFilterBar({
  sortMode,
  setSortMode,
  inStockOnly,
  setInStockOnly,
}: {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  inStockOnly: boolean;
  setInStockOnly: (value: boolean) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
      <label className="flex items-center gap-1.5 text-sm text-[#4a443c]">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
          className="w-4 h-4 accent-[var(--accent)]"
        />
        {t("catalog.inStockOnlyFilter")}
      </label>
      <select
        value={sortMode}
        onChange={(e) => setSortMode(e.target.value as SortMode)}
        aria-label={t("catalog.sortLabel")}
        className="border border-[#e6e0d6] rounded-xl px-2.5 py-2 text-sm bg-white text-[#4a443c]"
      >
        <option value="featured">{t("catalog.sortFeatured")}</option>
        <option value="name-asc">{t("catalog.sortNameAsc")}</option>
        <option value="name-desc">{t("catalog.sortNameDesc")}</option>
      </select>
    </div>
  );
}
