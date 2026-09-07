"use client";

import { useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";

type Category = {
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
};

type Section = {
  key: string;
  name: string;
  order: number;
  products: Product[];
};

const UNCATEGORIZED_KEY = "__uncategorized";

export function OrderCatalog({ products }: { products: Product[] }) {
  const { t } = useLocale();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>("all");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sections: Section[] = useMemo(() => {
    const byKey = new Map<string, Section>();

    for (const product of products) {
      const key = product.category?.id ?? UNCATEGORIZED_KEY;
      const name = product.category?.name ?? t("catalog.otherCategory");
      const order = product.category?.order ?? Number.MAX_SAFE_INTEGER;
      if (!byKey.has(key)) byKey.set(key, { key, name, order, products: [] });
      byKey.get(key)!.products.push(product);
    }

    return Array.from(byKey.values()).sort((a, b) => a.order - b.order);
  }, [products, t]);

  const isSearching = searchQuery.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => product.name.toLowerCase().includes(query));
  }, [products, searchQuery, isSearching]);

  const visibleSections =
    activeTab === "all" ? sections : sections.filter((section) => section.key === activeTab);

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

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <header className="sticky top-0 z-10 bg-white border-b border-stone-200">
        <div className="h-1.5 bg-amber-600" aria-hidden />
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <BrandLogo />
            <LanguageSwitcher />
          </div>
          <div className="relative">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              placeholder={t("catalog.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-stone-300 rounded-lg ps-9 pe-3 py-2 text-sm bg-white"
            />
          </div>
        </div>
        {!isSearching && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
              {t("catalog.all")}
            </TabButton>
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

      <main className="px-4 pt-4">
        {isSearching ? (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {searchResults.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart[product.id] ?? 0}
                  onAdd={() => addToCart(product.id)}
                  onSetQuantity={(qty) => setQuantity(product.id, qty)}
                />
              ))}
            </div>
            {searchResults.length === 0 && (
              <p className="text-sm text-stone-500 py-8 text-center">
                {t("catalog.noProductsMatch", { query: searchQuery })}
              </p>
            )}
          </>
        ) : (
          <>
            {visibleSections.map((section) => (
              <section key={section.key} className="mb-8">
                {activeTab === "all" && (
                  <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-stone-900 mb-3">
                    <span className="inline-block h-3.5 w-1.5 bg-amber-600 rounded-sm" aria-hidden />
                    {section.name}
                  </h2>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {section.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      quantity={cart[product.id] ?? 0}
                      onAdd={() => addToCart(product.id)}
                      onSetQuantity={(qty) => setQuantity(product.id, qty)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {visibleSections.every((s) => s.products.length === 0) && (
              <p className="text-sm text-stone-500 py-8 text-center">
                {t("catalog.noProductsInCategory")}
              </p>
            )}
          </>
        )}
      </main>

      {cartCount > 0 && !checkoutOpen && (
        <button
          onClick={() => setCheckoutOpen(true)}
          className="fixed bottom-0 inset-x-0 z-20 bg-stone-900 text-white px-4 py-4 flex items-center justify-between font-semibold shadow-lg"
        >
          <span>
            {cartCount === 1
              ? t("catalog.cartItemsOne")
              : t("catalog.cartItemsOther", { count: cartCount })}
          </span>
          <span className="text-amber-400">
            ${cartTotal.toFixed(2)} · {t("catalog.checkout")}
          </span>
        </button>
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
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
        active
          ? "bg-amber-600 text-white border-amber-600"
          : "bg-white text-stone-700 border-stone-300"
      }`}
    >
      {children}
    </button>
  );
}

function ProductCard({
  product,
  quantity,
  onAdd,
  onSetQuantity,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden flex flex-col bg-white">
      <div className="aspect-square bg-stone-100 flex items-center justify-center">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xl" aria-hidden>
            📦
          </span>
        )}
      </div>

      <div className="p-1.5 flex flex-col gap-0.5 flex-1">
        <p className="text-xs font-semibold text-stone-900 line-clamp-2 min-h-[2rem] leading-tight">
          {product.name}
        </p>
        <p className="text-sm font-bold text-stone-900">${product.price.toFixed(2)}</p>

        {!product.inStock ? (
          <p className="mt-auto text-[10px] font-semibold text-red-600 py-1.5">
            {t("catalog.outOfStock")}
          </p>
        ) : quantity === 0 ? (
          <button
            onClick={onAdd}
            className="mt-auto bg-amber-600 text-white text-xs font-semibold rounded-md py-1.5"
          >
            {t("catalog.addToCart")}
          </button>
        ) : (
          <div className="mt-auto flex items-center justify-between bg-stone-900 rounded-md text-white">
            <button
              onClick={() => onSetQuantity(quantity - 1)}
              aria-label="Decrease quantity"
              className="w-6 h-6 text-sm font-bold"
            >
              −
            </button>
            <span className="text-xs font-semibold">{quantity}</span>
            <button
              onClick={() => onSetQuantity(quantity + 1)}
              aria-label="Increase quantity"
              className="w-6 h-6 text-sm font-bold"
            >
              +
            </button>
          </div>
        )}
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
    <div className="fixed inset-0 z-30 flex items-end sm:items-center sm:justify-center bg-stone-900/60">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        {success ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-2xl">✅</p>
            <p className="font-semibold text-stone-900">{t("checkout.successTitle")}</p>
            {success.couponCode && (
              <p className="text-sm text-green-700 font-medium">
                {t("checkout.successCouponSaved", {
                  code: success.couponCode,
                  amount: success.discountAmount.toFixed(2),
                })}
              </p>
            )}
            <p className="text-sm text-stone-600">
              {success.whatsappError
                ? t("checkout.whatsappPending")
                : t("checkout.whatsappSent")}
            </p>
            <button
              onClick={onOrdered}
              className="w-full bg-amber-600 text-white rounded-lg py-3 font-semibold mt-4"
            >
              {t("checkout.done")}
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-900">{t("checkout.title")}</h2>
              <button
                onClick={onClose}
                aria-label={t("checkout.close")}
                className="w-8 h-8 text-xl text-stone-500"
              >
                ×
              </button>
            </div>

            <ul className="divide-y divide-stone-200 mb-4">
              {lines.map((line) => (
                <li key={line.product.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-stone-800">
                    {line.quantity}x {line.product.name}
                  </span>
                  <span className="font-semibold text-stone-900">
                    ${(line.product.price * line.quantity).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mb-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-semibold text-green-700">
                    {t("checkout.couponApplied", {
                      code: appliedCoupon.code,
                      percent: appliedCoupon.discountPercent,
                    })}
                  </span>
                  <button
                    onClick={removeCoupon}
                    className="text-sm text-green-700 underline"
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
                    className="flex-1 border border-stone-300 rounded-lg px-3 py-2 uppercase"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={validatingCoupon}
                    className="shrink-0 border border-stone-900 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {validatingCoupon ? t("checkout.checking") : t("checkout.apply")}
                  </button>
                </div>
              )}
              {couponError && <p className="text-sm text-red-600 mt-1">{couponError}</p>}
            </div>

            <div className="mb-4 space-y-1">
              {appliedCoupon && (
                <>
                  <div className="flex items-center justify-between text-sm text-stone-600">
                    <span>{t("checkout.subtotal")}</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-green-700">
                    <span>{t("checkout.discount", { percent: appliedCoupon.discountPercent })}</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between font-bold text-stone-900">
                <span>{t("checkout.total")}</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <input
                type="text"
                placeholder={t("checkout.namePlaceholder")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-3"
              />
              <input
                type="tel"
                placeholder={t("checkout.phonePlaceholder")}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-3"
              />
            </div>

            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full bg-amber-600 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
            >
              {submitting ? t("checkout.placingOrder") : t("checkout.placeOrder")}
            </button>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
