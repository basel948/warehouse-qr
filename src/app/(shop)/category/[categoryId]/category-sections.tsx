"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageBackLink } from "@/components/page-back-link";
import { ProductFilterBar } from "@/components/product-filter-bar";
import { useLocale } from "@/components/locale-provider";
import { useCart } from "@/components/storefront-shell";
import { type Product, type ShopCardItem, ShopCard, groupIntoCards } from "@/components/catalog-ui";
import { useProductFilters } from "@/lib/use-product-filters";

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

  const sections = useMemo(() => {
    const bySubcategory = new Map<string, Product[]>();
    for (const product of sorted) {
      const key = product.subcategory?.id ?? OTHER_SECTION_ID;
      if (!bySubcategory.has(key)) bySubcategory.set(key, []);
      bySubcategory.get(key)!.push(product);
    }

    // Options of one card are grouped within their section.
    const ordered: { id: string; name: string; cards: ShopCardItem[] }[] = [];
    for (const subcategory of subcategories) {
      const list = bySubcategory.get(subcategory.id);
      if (list && list.length > 0) {
        ordered.push({ id: subcategory.id, name: subcategory.name, cards: groupIntoCards(list) });
      }
    }
    const otherList = bySubcategory.get(OTHER_SECTION_ID);
    if (otherList && otherList.length > 0) {
      ordered.push({ id: OTHER_SECTION_ID, name: t("catalog.otherCategory"), cards: groupIntoCards(otherList) });
    }
    return ordered;
  }, [sorted, subcategories, t]);

  const hasSectionNav = sections.length > 1;
  const navRef = useRef<HTMLElement | null>(null);
  const chipRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [activeId, setActiveId] = useState<string | null>(null);
  // While a chip-triggered smooth scroll is running, the scroll position
  // passes other sections; this stops their chips flashing on the way.
  const programmaticScroll = useRef(false);
  const releaseScrollLock = useRef<(() => void) | null>(null);

  // Expose the chip bar's height as --section-nav-h, so sections scroll to
  // just below the sticky header + chip bar instead of underneath them.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () =>
      document.documentElement.style.setProperty("--section-nav-h", `${nav.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--section-nav-h");
    };
  }, [hasSectionNav]);

  // Highlight the chip of the section currently at the top of the screen
  // (the last one whose heading has scrolled up past the sticky bars).
  useEffect(() => {
    if (!hasSectionNav) return;
    let frame = 0;
    function update() {
      frame = 0;
      if (programmaticScroll.current) return;
      const offset = (navRef.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let current = sections[0]?.id ?? null;
      for (const section of sections) {
        const element = document.getElementById(`section-${section.id}`);
        if (element && element.getBoundingClientRect().top <= offset) current = section.id;
      }
      setActiveId(current);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [hasSectionNav, sections]);

  // Keep the highlighted chip centered in the sideways-scrolling bar. Only
  // the bar itself scrolls (scrollIntoView would also nudge the page and
  // fight the page's own smooth scroll). A relative scrollBy works the same
  // in RTL and LTR.
  useEffect(() => {
    const nav = navRef.current;
    const chip = activeId ? chipRefs.current.get(activeId) : null;
    if (!nav || !chip) return;
    const navBox = nav.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const delta = chipBox.left + chipBox.width / 2 - (navBox.left + navBox.width / 2);
    if (Math.abs(delta) > 4) nav.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeId]);

  function goToSection(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(`section-${id}`);
    if (!target) return;
    event.preventDefault();
    // A quick second tap replaces the first tap's scroll.
    releaseScrollLock.current?.();
    setActiveId(id);
    history.replaceState(null, "", `#section-${id}`);

    const stickyBottom = navRef.current?.getBoundingClientRect().bottom ?? 0;
    const start = window.scrollY;
    const end = target.getBoundingClientRect().top + start - stickyBottom - 12;
    const distance = end - start;
    if (Math.abs(distance) < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, end);
      return;
    }

    // Our own animation rather than behavior: "smooth", whose speed browsers
    // fix (and which feels rushed on phones): ~0.7s for short jumps, up to
    // ~1.1s for long ones, easing in and out.
    const duration = Math.min(1100, 700 + Math.abs(distance) * 0.15);
    const startedAt = performance.now();
    let frame = 0;
    programmaticScroll.current = true;

    const release = () => {
      programmaticScroll.current = false;
      releaseScrollLock.current = null;
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
    };
    releaseScrollLock.current = release;
    // The buyer scrolling by hand takes over immediately.
    window.addEventListener("wheel", release, { once: true, passive: true });
    window.addEventListener("touchstart", release, { once: true, passive: true });

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      window.scrollTo(0, start + distance * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else release();
    };
    frame = requestAnimationFrame(step);
  }

  return (
    <div>
      <PageBackLink href="/" title={categoryName} />

      {products.length === 0 ? (
        <p className="text-sm text-[#8a8177] py-8 text-center">{t("catalog.noProductsInCategory")}</p>
      ) : (
        <>
          {hasSectionNav && (
            // Pinned just below the shop header while scrolling the category.
            <nav
              ref={navRef}
              className="sticky top-[var(--shop-header-h,0px)] z-[5] -mx-4 px-4 py-2.5 mb-4 bg-[#f7f5f1] flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {sections.map((section) => {
                const active = section.id === activeId;
                return (
                  <a
                    key={section.id}
                    ref={(element) => {
                      if (element) chipRefs.current.set(section.id, element);
                      else chipRefs.current.delete(section.id);
                    }}
                    href={`#section-${section.id}`}
                    onClick={(event) => goToSection(event, section.id)}
                    aria-current={active ? "true" : undefined}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                      active
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                        : "bg-white border-[#e6e0d6] text-[#4a443c]"
                    }`}
                  >
                    {section.name}
                    <span className={`ms-1.5 text-[11px] font-medium ${active ? "text-white/80" : "text-[#a39a8e]"}`}>
                      {section.cards.length}
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
              <section key={section.id} id={`section-${section.id}`} className="scroll-mt-[calc(var(--shop-header-h,0px)+var(--section-nav-h,0px)+0.75rem)] mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-base font-bold text-[#1a1714] whitespace-nowrap">{section.name}</h2>
                  <div className="flex-1 h-px bg-[#eae5dc]" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                  {section.cards.map((card) => (
                    <ShopCard
                      key={card.key}
                      options={card.options}
                      cart={cart}
                      onAdd={addToCart}
                      onSetQuantity={setQuantity}
                      onExpand={openProductDetail}
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
