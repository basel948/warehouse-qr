"use client";

import { useMemo, useState } from "react";
import { type Product } from "@/components/catalog-ui";
import { getEffectivePrice } from "@/lib/effective-price";

export type SortMode = "name-asc" | "name-desc" | "price-asc" | "price-desc";

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

export function useProductFilters(products: Product[]) {
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

  function clearFilters() {
    setPriceMin("");
    setPriceMax("");
    setInStockOnly(false);
  }

  return {
    sortMode,
    setSortMode,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    inStockOnly,
    setInStockOnly,
    filtered,
    sorted,
    hasActiveFilter,
    clearFilters,
  };
}
