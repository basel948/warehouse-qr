"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { withCloudinaryTransform } from "@/lib/cloudinary-url";

type Category = {
  id: string;
  name: string;
  order: number;
};

type Subcategory = {
  id: string;
  name: string;
  order: number;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
  category: Category | null;
  subcategory: Subcategory | null;
};

type SubSection = {
  key: string;
  name: string | null;
  order: number;
  products: Product[];
};

type Section = {
  key: string;
  name: string;
  order: number;
  subSections: SubSection[];
};

const UNCATEGORIZED_KEY = "__uncategorized";
const SANO_KEY = "__sano";
const SANO_BRAND_MATCH = "סנו";

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

function makeProductComparator(sortMode: SortMode): (a: Product, b: Product) => number {
  switch (sortMode) {
    case "name-desc":
      return (a, b) => -compareProductNames(a, b);
    case "price-asc":
      return (a, b) => a.price - b.price;
    case "price-desc":
      return (a, b) => b.price - a.price;
    case "name-asc":
    default:
      return compareProductNames;
  }
}

export function OrderCatalog({ products }: { products: Product[] }) {
  const { t } = useLocale();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>("all");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [priceFilterOpen, setPriceFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const subSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const compareProducts = useMemo(() => makeProductComparator(sortMode), [sortMode]);

  const priceFilterActive = minPrice.trim() !== "" || maxPrice.trim() !== "";

  // Cart/checkout always operate on the full product list — filtering only
  // changes what's displayed, never what's already in the cart.
  const displayedProducts = useMemo(() => {
    if (!priceFilterActive) return products;
    const min = minPrice.trim() !== "" ? Number(minPrice) : -Infinity;
    const max = maxPrice.trim() !== "" ? Number(maxPrice) : Infinity;
    return products.filter((product) => product.price >= min && product.price <= max);
  }, [products, minPrice, maxPrice, priceFilterActive]);

  function clearPriceFilter() {
    setMinPrice("");
    setMaxPrice("");
  }

  const sections: Section[] = useMemo(() => {
    const byKey = new Map<
      string,
      { key: string; name: string; order: number; subMap: Map<string, SubSection> }
    >();

    for (const product of displayedProducts) {
      const key = product.category?.id ?? UNCATEGORIZED_KEY;
      const name = product.category?.name ?? t("catalog.otherCategory");
      const order = product.category?.order ?? Number.MAX_SAFE_INTEGER;
      if (!byKey.has(key)) byKey.set(key, { key, name, order, subMap: new Map() });
      const category = byKey.get(key)!;

      const subKey = product.subcategory?.id ?? UNCATEGORIZED_KEY;
      const subName = product.subcategory?.name ?? null;
      const subOrder = product.subcategory?.order ?? Number.MAX_SAFE_INTEGER;
      if (!category.subMap.has(subKey)) {
        category.subMap.set(subKey, { key: subKey, name: subName, order: subOrder, products: [] });
      }
      category.subMap.get(subKey)!.products.push(product);
    }

    return Array.from(byKey.values())
      .map((category) => {
        const subSections = Array.from(category.subMap.values());
        for (const subSection of subSections) subSection.products.sort(compareProducts);
        subSections.sort((a, b) => a.order - b.order);

        // Only label the "no subcategory" bucket when this category actually
        // uses subcategories elsewhere; otherwise leave it header-less so
        // categories that don't use subcategories render as before.
        const hasNamedSubSection = subSections.some((sub) => sub.name !== null);
        if (hasNamedSubSection) {
          for (const sub of subSections) {
            if (sub.name === null) sub.name = t("catalog.otherCategory");
          }
        }

        return { key: category.key, name: category.name, order: category.order, subSections };
      })
      .sort((a, b) => a.order - b.order);
  }, [displayedProducts, t, compareProducts]);

  const sanoSection: Section = useMemo(() => {
    const sanoProducts = displayedProducts
      .filter((product) => product.name.includes(SANO_BRAND_MATCH))
      .sort(compareProducts);
    return {
      key: SANO_KEY,
      name: SANO_BRAND_MATCH,
      order: -1,
      subSections: [{ key: "all", name: null, order: 0, products: sanoProducts }],
    };
  }, [displayedProducts, compareProducts]);

  const isSearching = searchQuery.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const query = searchQuery.trim().toLowerCase();
    return displayedProducts
      .filter((product) => product.name.toLowerCase().includes(query))
      .sort(compareProducts);
  }, [displayedProducts, searchQuery, isSearching, compareProducts]);

  const visibleSections =
    activeTab === "all"
      ? sections
      : activeTab === SANO_KEY
        ? [sanoSection]
        : sections.filter((section) => section.key === activeTab);

  // Only offer quick-jump shortcuts when viewing a single category that's
  // actually broken into more than one named subcategory.
  const quickJumpSubSections =
    activeTab !== "all" && activeTab !== SANO_KEY && visibleSections[0]?.subSections.some((s) => s.name)
      ? visibleSections[0].subSections
      : [];

  function scrollToSubSection(key: string) {
    subSectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = products.reduce(
    (sum, product) => sum + (cart[product.id] ?? 0) * product.price,
    0
  );

  function addToCart(productId: string) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  const expandedProduct = products.find((p) => p.id === expandedProductId) ?? null;

  return (
    <div className="min-h-screen bg-[#f7f5f1] pb-28">
      <header className="sticky top-0 z-10 bg-white border-b border-[#eae5dc]">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <BrandLogo />
            <LanguageSwitcher />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[#a39a8e]" aria-hidden>
                🔍
              </span>
              <input
                type="search"
                placeholder={t("catalog.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-xl ps-9 pe-3 py-2.5 text-sm bg-[#f4f1ec] placeholder:text-[#a39a8e]"
              />
            </div>
            <button
              onClick={() => setPriceFilterOpen((open) => !open)}
              aria-label={t("catalog.priceFilter")}
              className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold border ${
                priceFilterOpen || priceFilterActive
                  ? "bg-[#1a1714] text-white border-[#1a1714]"
                  : "bg-[#f4f1ec] text-[#4a443c] border-[#e6e0d6]"
              }`}
            >
              ₪{priceFilterActive ? " •" : ""}
            </button>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label={t("catalog.sortLabel")}
              className="shrink-0 max-w-[104px] border border-[#e6e0d6] rounded-xl px-2.5 py-2.5 text-sm bg-[#f4f1ec] text-[#4a443c]"
            >
              <option value="name-asc">{t("catalog.sortNameAsc")}</option>
              <option value="name-desc">{t("catalog.sortNameDesc")}</option>
              <option value="price-asc">{t("catalog.sortPriceAsc")}</option>
              <option value="price-desc">{t("catalog.sortPriceDesc")}</option>
            </select>
          </div>
          {priceFilterOpen && (
            <div className="flex items-center gap-2 mt-2.5">
              <input
                type="number"
                inputMode="decimal"
                placeholder={t("catalog.priceMinPlaceholder")}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-0 flex-1 border border-[#e6e0d6] rounded-xl px-3 py-2 text-sm bg-[#f4f1ec] placeholder:text-[#a39a8e]"
              />
              <span className="text-[#a39a8e] text-sm shrink-0">—</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder={t("catalog.priceMaxPlaceholder")}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-0 flex-1 border border-[#e6e0d6] rounded-xl px-3 py-2 text-sm bg-[#f4f1ec] placeholder:text-[#a39a8e]"
              />
              {priceFilterActive && (
                <button
                  onClick={clearPriceFilter}
                  className="shrink-0 text-[13px] text-[#6b6259] underline"
                >
                  {t("catalog.priceClear")}
                </button>
              )}
            </div>
          )}
        </div>
        {!isSearching && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
              {t("catalog.all")}
            </TabButton>
            {sanoSection.subSections[0].products.length > 0 && (
              <TabButton
                active={activeTab === SANO_KEY}
                special
                onClick={() => setActiveTab(SANO_KEY)}
              >
                ⭐ {sanoSection.name}
              </TabButton>
            )}
            {sections.map((section) => (
              <TabButton
                key={section.key}
                active={activeTab === section.key}
                onClick={() => setActiveTab(section.key)}
              >
                {section.name}
              </TabButton>
            ))}
          </div>
        )}
      </header>

      <main className="px-4 pt-5">
        {isSearching ? (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
              {searchResults.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart[product.id] ?? 0}
                  onAdd={() => addToCart(product.id)}
                  onSetQuantity={(qty) => setQuantity(product.id, qty)}
                  onExpand={() => setExpandedProductId(product.id)}
                />
              ))}
            </div>
            {searchResults.length === 0 && (
              <p className="text-sm text-[#8a8177] py-8 text-center">
                {t("catalog.noProductsMatch", { query: searchQuery })}
              </p>
            )}
          </>
        ) : (
          <>
            {quickJumpSubSections.length > 0 && (
              <div className="flex gap-3.5 overflow-x-auto pb-5 mb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {quickJumpSubSections.map((subSection) => (
                  <button
                    key={subSection.key}
                    onClick={() => scrollToSubSection(subSection.key)}
                    className="shrink-0 flex flex-col items-center gap-2 w-20"
                  >
                    <span className="w-[76px] h-[76px] rounded-full border border-[#eae5dc] bg-white overflow-hidden flex items-center justify-center shrink-0">
                      {subSection.products[0]?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={withCloudinaryTransform(subSection.products[0].imageUrl, "q_auto")}
                          alt=""
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-2xl" aria-hidden>
                          📦
                        </span>
                      )}
                    </span>
                    <span className="text-[12px] text-center leading-tight text-[#4a443c] line-clamp-2">
                      {subSection.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {visibleSections.map((section) => (
              <section key={section.key} className="mb-7">
                {activeTab === "all" && (
                  <h2 className="flex items-baseline justify-between text-[15px] font-bold text-[#1a1714] mb-3">
                    {section.name}
                  </h2>
                )}
                {section.subSections.map((subSection) => (
                  <div
                    key={subSection.key}
                    ref={(el) => {
                      subSectionRefs.current[subSection.key] = el;
                    }}
                    className="mb-5 last:mb-0 scroll-mt-36"
                  >
                    {subSection.name && (
                      <div className="flex items-center gap-2.5 mb-2">
                        <h3 className="text-[13px] font-semibold text-[#6b6259] shrink-0">
                          {subSection.name}
                        </h3>
                        <div className="flex-1 h-px bg-[#c9c1b6]" aria-hidden />
                      </div>
                    )}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                      {subSection.products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          quantity={cart[product.id] ?? 0}
                          onAdd={() => addToCart(product.id)}
                          onSetQuantity={(qty) => setQuantity(product.id, qty)}
                          onExpand={() => setExpandedProductId(product.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}

            {visibleSections.every((s) => s.subSections.every((sub) => sub.products.length === 0)) && (
              <p className="text-sm text-[#8a8177] py-8 text-center">
                {t("catalog.noProductsInCategory")}
              </p>
            )}
          </>
        )}
      </main>

      {cartCount > 0 && !checkoutOpen && (
        <div className="fixed bottom-0 inset-x-0 z-20 px-3.5 pt-4 pb-4 bg-gradient-to-t from-[#f7f5f1] from-[62%] to-transparent">
          <button
            onClick={() => setCheckoutOpen(true)}
            className="w-full bg-[#1a1714] text-white rounded-2xl px-4 py-[13px] flex items-center justify-between font-semibold shadow-[0_12px_24px_-12px_rgba(26,23,20,0.7)]"
          >
            <span className="text-[13px] text-[#c9c1b6]">
              {cartCount === 1
                ? t("catalog.cartItemsOne")
                : t("catalog.cartItemsOther", { count: cartCount })}
            </span>
            <span className="text-[14px] font-semibold text-[var(--accent)]">
              ₪{cartTotal.toFixed(2)} · {t("catalog.checkout")}
            </span>
          </button>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutSheet
          products={products}
          cart={cart}
          subtotal={cartTotal}
          onClose={() => setCheckoutOpen(false)}
          onOrdered={() => {
            setCart({});
            setCheckoutOpen(false);
          }}
        />
      )}

      {expandedProduct && (
        <ProductDetailModal
          product={expandedProduct}
          quantity={cart[expandedProduct.id] ?? 0}
          onAdd={() => addToCart(expandedProduct.id)}
          onSetQuantity={(qty) => setQuantity(expandedProduct.id, qty)}
          onClose={() => setExpandedProductId(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  special,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  special?: boolean;
}) {
  const inactiveClass = special
    ? "bg-amber-100 text-amber-900 border border-amber-300"
    : "bg-[#f2efe9] text-[#4a443c]";
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
        active ? "bg-[#1a1714] text-white" : inactiveClass
      }`}
    >
      {children}
    </button>
  );
}

function AddToCartControl({
  product,
  quantity,
  onAdd,
  onSetQuantity,
  size = "sm",
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  size?: "sm" | "lg";
}) {
  const { t } = useLocale();
  const [quantityInput, setQuantityInput] = useState(String(quantity));

  useEffect(() => {
    setQuantityInput(String(quantity));
  }, [quantity]);

  function commitQuantityInput() {
    const parsed = parseInt(quantityInput, 10);
    const clamped = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
    onSetQuantity(clamped);
    setQuantityInput(String(clamped));
  }

  if (!product.inStock) {
    return (
      <p
        className={`text-center font-semibold text-[#8a8177] bg-[#f2efe9] rounded-[9px] ${
          size === "lg" ? "text-sm py-3" : "text-[11px] py-2"
        }`}
      >
        {t("catalog.outOfStock")}
      </p>
    );
  }

  if (quantity === 0) {
    return (
      <button
        onClick={onAdd}
        className={`bg-[var(--accent)] text-white font-semibold rounded-[9px] ${
          size === "lg" ? "w-full text-sm py-3" : "w-full text-xs py-2"
        }`}
      >
        {t("catalog.addToCart")}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center justify-between bg-[#1a1714] rounded-[9px] text-white p-[2px] ${
        size === "lg" ? "w-full" : ""
      }`}
    >
      <button
        onClick={() => onSetQuantity(quantity - 1)}
        aria-label="Decrease quantity"
        className={`shrink-0 font-bold leading-none ${
          size === "lg" ? "w-10 h-10 text-lg" : "w-[26px] h-[26px] text-base"
        }`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={quantityInput}
        onChange={(e) => setQuantityInput(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commitQuantityInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label="Quantity"
        className={`min-w-0 bg-transparent text-center font-semibold outline-none ${
          size === "lg" ? "w-12 text-base" : "w-8 text-[13px]"
        }`}
      />
      <button
        onClick={() => onSetQuantity(quantity + 1)}
        aria-label="Increase quantity"
        className={`shrink-0 font-bold leading-none ${
          size === "lg" ? "w-10 h-10 text-lg" : "w-[26px] h-[26px] text-base"
        }`}
      >
        +
      </button>
    </div>
  );
}

function ProductCard({
  product,
  quantity,
  onAdd,
  onSetQuantity,
  onExpand,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  onExpand: () => void;
}) {
  return (
    <div
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onExpand();
      }}
      className={`border border-[#eae5dc] rounded-[14px] overflow-hidden flex flex-col bg-white cursor-pointer ${
        !product.inStock ? "opacity-[.55]" : ""
      }`}
    >
      <div
        className={`aspect-square flex items-center justify-center overflow-hidden p-2 ${
          product.imageUrl ? "bg-white" : "bg-[#f2efe9]"
        }`}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withCloudinaryTransform(product.imageUrl, "q_auto")}
            alt={product.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-xl" aria-hidden>
            📦
          </span>
        )}
      </div>

      <div className="p-[9px] pb-2.5 flex flex-col gap-[5px] flex-1">
        <p className="text-xs font-medium text-[#2b2620] line-clamp-2 min-h-[33px] leading-tight">
          {product.name}
        </p>
        <p className="text-sm font-bold text-[#1a1714]">₪{product.price.toFixed(2)}</p>

        <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
          <AddToCartControl
            product={product}
            quantity={quantity}
            onAdd={onAdd}
            onSetQuantity={onSetQuantity}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

function ProductDetailModal({
  product,
  quantity,
  onAdd,
  onSetQuantity,
  onClose,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center bg-[#1a1714]/55"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-[22px] sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div
            className={`aspect-square flex items-center justify-center overflow-hidden p-6 sm:rounded-t-2xl ${
              product.imageUrl ? "bg-white" : "bg-[#f2efe9]"
            }`}
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={withCloudinaryTransform(product.imageUrl, "q_auto:best,e_sharpen:60")}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-5xl" aria-hidden>
                📦
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("checkout.close")}
            className="absolute top-3 end-3 w-9 h-9 rounded-full bg-white/95 text-[#6b6259] flex items-center justify-center text-lg shadow-sm"
          >
            ×
          </button>
        </div>

        <div className="p-[18px] pb-[22px]">
          <h2 className="text-lg font-bold text-[#1a1714] mb-1">{product.name}</h2>
          <p className="text-xl font-bold text-[#1a1714] mb-2">₪{product.price.toFixed(2)}</p>
          {product.category && (
            <p className="text-xs text-[#8a8177] mb-2">
              {product.category.name}
              {product.subcategory ? ` · ${product.subcategory.name}` : ""}
            </p>
          )}
          {product.description && (
            <p className="text-sm text-[#6b6259] leading-relaxed mb-4">{product.description}</p>
          )}

          <AddToCartControl
            product={product}
            quantity={quantity}
            onAdd={onAdd}
            onSetQuantity={onSetQuantity}
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}

type AppliedCoupon = { code: string; discountPercent: number };

function CheckoutSheet({
  products,
  cart,
  subtotal,
  onClose,
  onOrdered,
}: {
  products: Product[];
  cart: Record<string, number>;
  subtotal: number;
  onClose: () => void;
  onOrdered: () => void;
}) {
  const { t } = useLocale();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    whatsappError: string | null;
    discountAmount: number;
    couponCode: string | null;
  } | null>(null);

  const lines = products
    .filter((product) => cart[product.id] > 0)
    .map((product) => ({ product, quantity: cart[product.id] }));

  const discountAmount = appliedCoupon ? subtotal * (appliedCoupon.discountPercent / 100) : 0;
  const total = subtotal - discountAmount;

  async function applyCoupon() {
    setCouponError(null);
    if (!couponInput.trim()) {
      setCouponError(t("checkout.couponErrorEmpty"));
      return;
    }

    setValidatingCoupon(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAppliedCoupon(null);
        setCouponError(t("checkout.couponErrorInvalid"));
        return;
      }
      setAppliedCoupon({ code: data.code, discountPercent: data.discountPercent });
    } catch {
      setCouponError(t("checkout.couponErrorNetwork"));
    } finally {
      setValidatingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  async function submitOrder() {
    setError(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setError(t("checkout.errorMissingInfo"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          couponCode: appliedCoupon?.code,
          items: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(t("checkout.errorFailed"));
        return;
      }

      setSuccess({
        whatsappError: data.whatsappError,
        discountAmount: data.discountAmount ?? 0,
        couponCode: data.order.couponCode,
      });
    } catch {
      setError(t("checkout.errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center sm:justify-center bg-[#1a1714]/55">
      <div className="w-full sm:max-w-md bg-white rounded-t-[22px] sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {success ? (
          <div className="p-8 text-center">
            <div className="w-[52px] h-[52px] rounded-full bg-[#f1f7f1] text-[#2f6b3a] flex items-center justify-center text-2xl mx-auto mb-3.5">
              ✓
            </div>
            <p className="font-bold text-[18px] text-[#1a1714] mb-2">{t("checkout.successTitle")}</p>
            <p className="text-sm text-[#6b6259] mb-1.5">
              {success.whatsappError
                ? t("checkout.whatsappPending")
                : t("checkout.whatsappSent")}
            </p>
            {success.couponCode && (
              <p className="text-[13px] font-semibold text-[#2f6b3a] mb-2">
                {t("checkout.successCouponSaved", {
                  code: success.couponCode,
                  amount: success.discountAmount.toFixed(2),
                })}
              </p>
            )}
            <button
              onClick={onOrdered}
              className="w-full bg-[#1a1714] text-white rounded-xl py-[15px] font-semibold text-base mt-4"
            >
              {t("checkout.done")}
            </button>
          </div>
        ) : (
          <div className="p-[18px] pb-[22px]">
            <div className="w-[38px] h-1 rounded-full bg-[#e0d9cf] mx-auto mb-4 sm:hidden" aria-hidden />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[19px] font-bold text-[#1a1714]">{t("checkout.title")}</h2>
              <button
                onClick={onClose}
                aria-label={t("checkout.close")}
                className="w-[30px] h-[30px] rounded-full bg-[#f2efe9] text-[#6b6259] flex items-center justify-center text-base"
              >
                ×
              </button>
            </div>

            <ul className="divide-y divide-[#f0ece5] mb-4">
              {lines.map((line) => (
                <li key={line.product.id} className="py-[11px] flex items-center justify-between text-sm">
                  <span className="text-[#2b2620]">
                    {line.quantity}x {line.product.name}
                  </span>
                  <span className="font-semibold text-[#1a1714]">
                    ₪{(line.product.price * line.quantity).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mb-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-[#f1f7f1] border border-[#cfe3cf] rounded-xl px-3.5 py-[11px]">
                  <span className="text-sm font-semibold text-[#2f6b3a]">
                    {t("checkout.couponApplied", {
                      code: appliedCoupon.code,
                      percent: appliedCoupon.discountPercent,
                    })}
                  </span>
                  <button
                    onClick={removeCoupon}
                    className="text-sm text-[#2f6b3a] underline"
                  >
                    {t("checkout.remove")}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t("checkout.couponPlaceholder")}
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="flex-1 border border-[#e6e0d6] rounded-xl px-3.5 py-[11px] bg-[#f7f5f1] uppercase placeholder:normal-case placeholder:text-[#a39a8e]"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={validatingCoupon}
                    className="shrink-0 border border-[#1a1714] text-[#1a1714] rounded-xl px-[18px] py-[11px] text-sm font-semibold disabled:opacity-50"
                  >
                    {validatingCoupon ? t("checkout.checking") : t("checkout.apply")}
                  </button>
                </div>
              )}
              {couponError && <p className="text-[13px] text-[#b3402e] mt-1">{couponError}</p>}
            </div>

            <div className="mb-4 space-y-[7px] text-sm">
              {appliedCoupon && (
                <>
                  <div className="flex items-center justify-between text-[#6b6259]">
                    <span>{t("checkout.subtotal")}</span>
                    <span>₪{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#2f6b3a]">
                    <span>{t("checkout.discount", { percent: appliedCoupon.discountPercent })}</span>
                    <span>-₪{discountAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-[17px] font-bold text-[#1a1714] pt-[7px] border-t border-[#f0ece5]">
                <span>{t("checkout.total")}</span>
                <span>₪{total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              <input
                type="text"
                placeholder={t("checkout.namePlaceholder")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-[13px] bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
              <input
                type="tel"
                placeholder={t("checkout.phonePlaceholder")}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-[13px] bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
            </div>

            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full bg-[var(--accent)] text-white rounded-xl py-[15px] font-semibold text-base disabled:opacity-50"
            >
              {submitting ? t("checkout.placingOrder") : t("checkout.placeOrder")}
            </button>
            {error && <p className="text-sm text-[#b3402e] mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
