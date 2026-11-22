"use client";

import { useMemo, useState } from "react";
import { type Product } from "@/components/catalog-ui";

// "featured" keeps the order the products arrive in, which is the admin's
// arrangement (Product.sortOrder) on category pages.
export type SortMode = "featured" | "name-asc" | "name-desc";

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
    case "featured":
      return () => 0;
    case "name-desc":
      return (a, b) => -compareProductNames(a, b);
    case "name-asc":
    default:
      return compareProductNames;
  }
}

export function useProductFilters(products: Product[]) {
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);

  const filtered = useMemo(
    () => (inStockOnly ? products.filter((product) => product.inStock) : products),
    [products, inStockOnly]
  );

  const sorted = useMemo(
    () => [...filtered].sort(makeComparator(sortMode)),
    [filtered, sortMode]
  );


  return {
    sortMode,
    setSortMode,
    inStockOnly,
    setInStockOnly,
    filtered,
    sorted,
  };
}
