"use client";

import { useLocale } from "@/components/locale-provider";
import { useCart } from "@/components/storefront-shell";
import { type Product, ProductCard } from "@/components/catalog-ui";
import { ProductFilterBar } from "@/components/product-filter-bar";
import { useProductFilters } from "@/lib/use-product-filters";

export function ProductGrid({ products }: { products: Product[] }) {
  const { t } = useLocale();
  const { cart, addToCart, setQuantity, openProductDetail } = useCart();
  const {
    sortMode,
    setSortMode,
    priceMin,
    setPriceMin,
    priceMax,
    setPriceMax,
    inStockOnly,
    setInStockOnly,
    sorted,
    hasActiveFilter,
    clearFilters,
  } = useProductFilters(products);

  if (products.length === 0) {
    return <p className="text-sm text-[#8a8177] py-8 text-center">{t("catalog.noProductsInCategory")}</p>;
  }

  return (
    <div>
      <ProductFilterBar
        sortMode={sortMode}
        setSortMode={setSortMode}
        priceMin={priceMin}
        setPriceMin={setPriceMin}
        priceMax={priceMax}
        setPriceMax={setPriceMax}
        inStockOnly={inStockOnly}
        setInStockOnly={setInStockOnly}
        hasActiveFilter={hasActiveFilter}
        clearFilters={clearFilters}
      />
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
