"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { useCart } from "@/components/storefront-shell";
import { type Product, ProductCard } from "@/components/catalog-ui";
import { getEffectivePrice } from "@/lib/effective-price";

type SortMode = "name-asc" | "name-desc" | "price-asc" | "price-desc";

function startsWithLatinOrDigit(name: string): boolean {
  return /^[A-Za-z0-9]/.test(name.trim());
}

function compareProductNames(a: Product, b: Product): number {
  const aLatin = startsWithLatinOrDigit(a.name);
  const bLatin = startsWithLatinOrDigit(b.name);
  if (aLatin !== bLatin) return aLatin ? 1 : -1;
  return a.name.localeCompare(b.name, "he");
}

function makeComparator(sortMode: SortMode): (a: Product, b: Product) => number {
  switch (sortMode) {
    case "name-desc":
      return (a, b) => -compareProductNames(a, b);
    case "price-asc":
      return (a, b) => getEffectivePrice(a) - getEffectivePrice(b);
    case "price-desc":
      return (a, b) => getEffectivePrice(b) - getEffectivePrice(a);
    case "name-asc":
    default:
      return compareProductNames;
  }
}

export function ProductGrid({ products }: { products: Product[] }) {
  const { t } = useLocale();
  const { cart, addToCart, setQuantity, openProductDetail } = useCart();
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  const filtered = useMemo(() => {
    const min = priceMin === "" ? null : Number(priceMin);
    const max = priceMax === "" ? null : Number(priceMax);
    return products.filter((product) => {
      if (inStockOnly && !product.inStock) return false;
      const effectivePrice = getEffectivePrice(product);
      if (min !== null && !Number.isNaN(min) && effectivePrice < min) return false;
      if (max !== null && !Number.isNaN(max) && effectivePrice > max) return false;
      return true;
    });
  }, [products, priceMin, priceMax, inStockOnly]);

  const sorted = useMemo(
    () => [...filtered].sort(makeComparator(sortMode)),
    [filtered, sortMode]
  );

  const hasActiveFilter = priceMin !== "" || priceMax !== "" || inStockOnly;

  if (products.length === 0) {
    return <p className="text-sm text-[#8a8177] py-8 text-center">{t("catalog.noProductsInCategory")}</p>;
  }

  return (
    <div>
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
              onClick={() => {
                setPriceMin("");
                setPriceMax("");
                setInStockOnly(false);
              }}
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
      {sorted.length === 0 ? (
        <p className="text-sm text-[#8a8177] py-8 text-center">{t("catalog.noProductsMatchFilter")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {sorted.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={cart[product.id] ?? 0}
              onAdd={() => addToCart(product.id)}
              onSetQuantity={(qty) => setQuantity(product.id, qty)}
              onExpand={() => openProductDetail(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
