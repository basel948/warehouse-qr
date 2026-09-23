"use client";

import { useLocale } from "@/components/locale-provider";
import { type SortMode } from "@/lib/use-product-filters";

export function ProductFilterBar({
  sortMode,
  setSortMode,
  priceMin,
  setPriceMin,
  priceMax,
  setPriceMax,
  inStockOnly,
  setInStockOnly,
  hasActiveFilter,
  clearFilters,
}: {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  priceMin: string;
  setPriceMin: (value: string) => void;
  priceMax: string;
  setPriceMax: (value: string) => void;
  inStockOnly: boolean;
  setInStockOnly: (value: boolean) => void;
  hasActiveFilter: boolean;
  clearFilters: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
      <label className="flex items-center gap-1.5 text-sm text-[#4a443c]">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
          className="w-4 h-4 accent-[var(--accent)]"
        />
        {t("catalog.inStockOnlyFilter")}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          value={priceMin}
          onChange={(e) => setPriceMin(e.target.value)}
          placeholder={t("catalog.priceMinPlaceholder")}
          aria-label={t("catalog.priceMinPlaceholder")}
          className="w-[70px] border border-[#e6e0d6] rounded-xl px-2 py-2 text-sm bg-white text-[#4a443c]"
        />
        <span className="text-[#8a8177]">–</span>
        <input
          type="number"
          inputMode="numeric"
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          placeholder={t("catalog.priceMaxPlaceholder")}
          aria-label={t("catalog.priceMaxPlaceholder")}
          className="w-[70px] border border-[#e6e0d6] rounded-xl px-2 py-2 text-sm bg-white text-[#4a443c]"
        />
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="text-sm text-[var(--secondary)] font-semibold px-1"
          >
            {t("catalog.priceClear")}
          </button>
        )}
      </div>
      <select
        value={sortMode}
        onChange={(e) => setSortMode(e.target.value as SortMode)}
        aria-label={t("catalog.sortLabel")}
        className="border border-[#e6e0d6] rounded-xl px-2.5 py-2 text-sm bg-white text-[#4a443c]"
      >
        <option value="name-asc">{t("catalog.sortNameAsc")}</option>
        <option value="name-desc">{t("catalog.sortNameDesc")}</option>
        <option value="price-asc">{t("catalog.sortPriceAsc")}</option>
        <option value="price-desc">{t("catalog.sortPriceDesc")}</option>
      </select>
    </div>
  );
}
