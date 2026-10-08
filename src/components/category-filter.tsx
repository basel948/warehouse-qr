"use client";

import { useLocale } from "@/components/locale-provider";

type FilterCategory = { id: string; name: string };
type FilterSubcategory = { id: string; name: string; categoryId: string };

export type CategoryFilterValue = { categoryId: string; subcategoryId: string };

/** True when the product passes the chosen category / subcategory ("" = any). */
export function matchesCategoryFilter(
  product: { categories: { id: string }[]; subcategoryId?: string | null; subcategory?: { id: string } | null },
  { categoryId, subcategoryId }: CategoryFilterValue
): boolean {
  if (categoryId && !product.categories.some((category) => category.id === categoryId)) return false;
  const productSubcategoryId = product.subcategoryId ?? product.subcategory?.id ?? null;
  if (subcategoryId && productSubcategoryId !== subcategoryId) return false;
  return true;
}

// The category and subcategory pickers beside a search box (the admin
// products page). The subcategory picker appears once a category with
// subcategories is chosen; changing the category resets it.
export function CategoryFilter({
  categories,
  subcategories,
  value,
  onChange,
  size = "md",
}: {
  categories: FilterCategory[];
  subcategories: FilterSubcategory[];
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
  size?: "sm" | "md";
}) {
  const { t } = useLocale();
  const ofCategory = subcategories.filter((s) => s.categoryId === value.categoryId);
  const selectClass = `min-w-0 flex-1 border border-[#e6e0d6] rounded-xl bg-white text-[#1a1714] ${
    size === "sm" ? "px-2.5 py-2 text-[13px]" : "px-3 py-2.5 text-sm"
  }`;

  return (
    <div className="flex gap-2">
      <select
        value={value.categoryId}
        onChange={(e) => onChange({ categoryId: e.target.value, subcategoryId: "" })}
        aria-label={t("catalog.filterCategory")}
        className={selectClass}
      >
        <option value="">{t("catalog.allCategories")}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      {value.categoryId && ofCategory.length > 0 && (
        <select
          value={value.subcategoryId}
          onChange={(e) => onChange({ ...value, subcategoryId: e.target.value })}
          aria-label={t("catalog.filterSubcategory")}
          className={selectClass}
        >
          <option value="">{t("catalog.allSubcategories")}</option>
          {ofCategory.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>
              {subcategory.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
