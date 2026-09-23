"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageBackLink } from "@/components/page-back-link";
import { ProductFilterBar } from "@/components/product-filter-bar";
import { useLocale } from "@/components/locale-provider";
import { useCart } from "@/components/storefront-shell";
import { type Product, ProductCard } from "@/components/catalog-ui";
import { useProductFilters } from "@/lib/use-product-filters";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCloudinaryTransform } from "@/lib/cloudinary-url";
import { ChevronDownIcon } from "@/components/icons";

const OTHER_SECTION_ID = "other";

type SubcategoryInfo = {
  id: string;
  name: string;
};

export function CategorySections({
  categoryName,
  subcategories,
  products,
}: {
  categoryName: string;
  subcategories: SubcategoryInfo[];
  products: Product[];
}) {
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

  // Show the back-to-top bar once the section circles have scrolled out of view.
  const navRef = useRef<HTMLElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const sections = useMemo(() => {
    const bySubcategory = new Map<string, Product[]>();
    for (const product of sorted) {
      const key = product.subcategory?.id ?? OTHER_SECTION_ID;
      if (!bySubcategory.has(key)) bySubcategory.set(key, []);
      bySubcategory.get(key)!.push(product);
    }

    const ordered: { id: string; name: string; products: Product[] }[] = [];
    for (const subcategory of subcategories) {
      const list = bySubcategory.get(subcategory.id);
      if (list && list.length > 0) {
        ordered.push({ id: subcategory.id, name: subcategory.name, products: list });
      }
    }
    const otherList = bySubcategory.get(OTHER_SECTION_ID);
    if (otherList && otherList.length > 0) {
      ordered.push({ id: OTHER_SECTION_ID, name: t("catalog.otherCategory"), products: otherList });
    }
    return ordered;
  }, [sorted, subcategories, t]);

  const hasSectionNav = sections.length > 1;
  // The storefront shell pins a checkout bar to the bottom while the cart has items;
  // sit just above it instead of underneath.
  const cartHasItems = Object.values(cart).some((qty) => qty > 0);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      setShowBackToTop(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setShowBackToTop(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    );
    observer.observe(nav);
    return () => observer.disconnect();
  }, [hasSectionNav]);

  return (
    <div>
      <div
        className={`fixed inset-x-0 z-[15] bg-white/50 backdrop-blur-sm shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.15)] transition-all duration-200 ${
          cartHasItems ? "bottom-[5.25rem]" : "bottom-0"
        } ${showBackToTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t("catalog.backToTop")}
          className="w-full h-10 flex items-center justify-center text-[#4a443c]"
        >
          <ChevronDownIcon className="w-5 h-5 rotate-180" />
        </button>
      </div>

      <PageBackLink href="/" title={categoryName} />

      {products.length === 0 ? (
        <p className="text-sm text-[#8a8177] py-8 text-center">{t("catalog.noProductsInCategory")}</p>
      ) : (
        <>
          {hasSectionNav && (
            <nav ref={navRef} className="flex gap-3 overflow-x-auto pb-2 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
              {sections.map((section) => {
                const Icon = getCategoryIcon(section.name);
                const imageUrl = section.products.find((p) => p.imageUrl)?.imageUrl;
                return (
                  <a
                    key={section.id}
                    href={`#section-${section.id}`}
                    className="flex flex-col items-center gap-1.5 shrink-0 w-20"
                  >
                    <span className="w-20 h-20 rounded-full border border-[#eae5dc] bg-white flex items-center justify-center overflow-hidden shadow-[0_2px_8px_-4px_rgba(0,0,0,0.15)]">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={withCloudinaryTransform(imageUrl, "q_auto")}
                          alt=""
                          className="w-full h-full object-contain p-2.5"
                        />
                      ) : (
                        <Icon className="w-8 h-8 text-[var(--accent)]" />
                      )}
                    </span>
                    <span className="text-xs font-medium text-[#4a443c] text-center leading-tight line-clamp-2 w-full">
                      {section.name}
                    </span>
                  </a>
                );
              })}
            </nav>
          )}

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

          {sections.length === 0 ? (
            <p className="text-sm text-[#8a8177] py-8 text-center">{t("catalog.noProductsMatchFilter")}</p>
          ) : (
            sections.map((section) => (
              <section key={section.id} id={`section-${section.id}`} className="scroll-mt-[calc(var(--shop-header-h,0px)+1rem)] mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-base font-bold text-[#1a1714] whitespace-nowrap">{section.name}</h2>
                  <div className="flex-1 h-px bg-[#eae5dc]" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                  {section.products.map((product) => (
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
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
