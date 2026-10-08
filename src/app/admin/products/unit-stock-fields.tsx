"use client";

import { useLocale } from "@/components/locale-provider";
import { PRODUCT_UNITS, asProductUnit } from "@/lib/product-unit";

/** "" = not tracked (null); otherwise a whole number >= 0, or NaN if invalid. */
export function parseStockInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

// The selling unit (יחידה / קרטון) and the warehouse quantity, side by side,
// in the add-product form and the edit window. Leaving the quantity empty
// means the product's stock isn't tracked.
export function UnitStockFields({
  unit,
  onUnitChange,
  stock,
  onStockChange,
}: {
  unit: string;
  onUnitChange: (unit: string) => void;
  stock: string;
  onStockChange: (stock: string) => void;
}) {
  const { t } = useLocale();
  const label = "block text-xs font-semibold text-[#6b6259] mb-1";
  const field = "w-full border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white";
  return (
    <div className="flex gap-2">
      <label className="w-32 shrink-0">
        <span className={label}>{t("admin.products.unitLabel")}</span>
        <select value={asProductUnit(unit)} onChange={(e) => onUnitChange(e.target.value)} className={field}>
          {PRODUCT_UNITS.map((u) => (
            <option key={u} value={u}>
              {t(`catalog.unitName.${u}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex-1 min-w-0">
        <span className={label}>
          {t("admin.products.stockLabel", { unit: t(`catalog.unitMany.${asProductUnit(unit)}`) })}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder={t("admin.products.stockPlaceholder")}
          value={stock}
          onChange={(e) => onStockChange(e.target.value)}
          className={field}
        />
      </label>
    </div>
  );
}
