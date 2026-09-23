"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  CashIcon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  PhoneIcon,
  SearchIcon,
} from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { WAREHOUSE_CONTACT_PHONE, WAREHOUSE_NAME } from "@/lib/branding";
import { PAYMENT_METHOD, type PaymentMethod } from "@/lib/payment-method";
import { type Product, ProductCard, ProductDetailModal } from "@/components/catalog-ui";
import { getEffectivePrice } from "@/lib/effective-price";

const CART_STORAGE_KEY = "warehouse-cart";

type CartContextValue = {
  cart: Record<string, number>;
  addToCart: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  openProductDetail: (product: Product) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within StorefrontShell");
  return ctx;
}

function startsWithLatinOrDigit(name: string): boolean {
  return /^[A-Za-z0-9]/.test(name.trim());
}

function compareProductNames(a: Product, b: Product): number {
  const aLatin = startsWithLatinOrDigit(a.name);
  const bLatin = startsWithLatinOrDigit(b.name);
  if (aLatin !== bLatin) return aLatin ? 1 : -1;
  return a.name.localeCompare(b.name, "he");
}

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState<Product[] | null>(null);
  const contactFooterRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  // Expose the sticky header's height as --shop-header-h so other sticky
  // elements (e.g. the category section nav) can pin directly below it.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () =>
      document.documentElement.style.setProperty("--shop-header-h", `${header.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const [cartHydrated, setCartHydrated] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Object.keys(parsed).length > 0) {
          setCart(parsed);
          setResumePromptOpen(true);
        }
      }
    } catch {
      // Private browsing / storage disabled - just start with an empty cart.
    }
    setCartHydrated(true);
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore - cart still works for this session, just won't persist.
    }
  }, [cart, cartHydrated]);

  // Loaded once, lazily, the first time something needs to search or check
  // out across the whole catalog rather than just the current page's slice.
  async function ensureAllProducts(): Promise<Product[]> {
    if (allProducts) return allProducts;
    const res = await fetch("/api/products");
    const data: Product[] = await res.json();
    setAllProducts(data);
    return data;
  }

  // Loaded once in the background on mount - the floating cart bar's total
  // and the checkout sheet both need full product details (price, name...)
  // for cart items regardless of which page's grid added them.
  useEffect(() => {
    ensureAllProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function continueSavedOrder() {
    setResumePromptOpen(false);
  }

  function discardSavedOrder() {
    setCart({});
    setResumePromptOpen(false);
  }

  function scrollToContact() {
    contactFooterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function openCheckout() {
    await ensureAllProducts();
    setCheckoutOpen(true);
  }

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartTotal = (allProducts ?? []).reduce(
    (sum, product) => sum + (cart[product.id] ?? 0) * getEffectivePrice(product),
    0
  );

  const isSearching = searchQuery.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching || !allProducts) return [];
    const query = searchQuery.trim().toLowerCase();
    return allProducts
      .filter((product) => product.name.toLowerCase().includes(query))
      .sort(compareProductNames);
  }, [allProducts, searchQuery, isSearching]);

  const contextValue: CartContextValue = {
    cart,
    addToCart,
    setQuantity,
    openProductDetail: setExpandedProduct,
  };

  return (
    <CartContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#f7f5f1] pb-28">
        <header ref={headerRef} className="sticky top-0 z-10 bg-white border-b border-[#eae5dc]">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <Link href="/">
                <BrandLogo />
              </Link>
              <div className="flex items-center gap-3">
                <button onClick={scrollToContact} className="text-[13px] font-semibold text-[#6b6259]">
                  {t("catalog.contactUs")}
                </button>
                <LanguageSwitcher />
              </div>
            </div>
            <div className="relative">
              <SearchIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a39a8e]" />
              <input
                type="search"
                placeholder={t("catalog.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-xl ps-9 pe-3 py-2.5 text-sm bg-[#f4f1ec] placeholder:text-[#a39a8e]"
              />
            </div>
          </div>
        </header>

        <main className="px-4 pt-5">
          {isSearching ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                {searchResults.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={cart[product.id] ?? 0}
                    onAdd={() => addToCart(product.id)}
                    onSetQuantity={(qty) => setQuantity(product.id, qty)}
                    onExpand={() => setExpandedProduct(product)}
                  />
                ))}
              </div>
              {allProducts && searchResults.length === 0 && (
                <p className="text-sm text-[#8a8177] py-8 text-center">
                  {t("catalog.noProductsMatch", { query: searchQuery })}
                </p>
              )}
            </>
          ) : (
            children
          )}
        </main>

        {WAREHOUSE_CONTACT_PHONE && (
          <footer
            ref={contactFooterRef}
            className="border-t border-[#eae5dc] bg-white px-4 py-7 mt-4 text-center scroll-mt-24"
          >
            <p className="text-sm font-semibold text-[#1a1714] mb-1">{WAREHOUSE_NAME}</p>
            <p className="text-[13px] text-[#6b6259] mb-3.5">{t("catalog.contactQuestion")}</p>
            <div className="flex items-center justify-center gap-2.5">
              <a
                href={`tel:+${WAREHOUSE_CONTACT_PHONE}`}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1a1714] border border-[#e6e0d6] rounded-full px-4 py-2"
              >
                <PhoneIcon className="w-3.5 h-3.5" />
                {WAREHOUSE_CONTACT_PHONE}
              </a>
              <a
                href={`https://wa.me/${WAREHOUSE_CONTACT_PHONE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-semibold text-white bg-[#25D366] rounded-full px-4 py-2"
              >
                WhatsApp
              </a>
            </div>
          </footer>
        )}

        {cartCount > 0 && !checkoutOpen && (
          <div className="fixed bottom-0 inset-x-0 z-20 px-3.5 pt-4 pb-4 bg-gradient-to-t from-[#f7f5f1] from-[62%] to-transparent flex justify-center">
            <button
              onClick={openCheckout}
              className="w-1/2 min-w-[220px] bg-[var(--accent)] text-white rounded-full px-6 py-3.5 flex items-center justify-between font-bold text-base shadow-[0_10px_20px_-8px_rgba(0,0,0,0.45)]"
            >
              <span>₪{cartTotal.toFixed(2)}</span>
              <span className="flex items-center gap-2">
                {t("catalog.checkout")}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M19 12H5" />
                  <path d="M11 18l-6-6 6-6" />
                </svg>
              </span>
            </button>
          </div>
        )}

        {checkoutOpen && allProducts && (
          <CheckoutSheet
            products={allProducts}
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
            onClose={() => setExpandedProduct(null)}
          />
        )}

        {resumePromptOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-[#1a1714]/55">
            <div className="w-full sm:max-w-sm bg-white rounded-t-[22px] sm:rounded-2xl p-[22px] text-center">
              <div className="w-[38px] h-1 rounded-full bg-[#e0d9cf] mx-auto mb-4 sm:hidden" aria-hidden />
              <p className="font-bold text-[17px] text-[#1a1714] mb-1.5">
                {t("catalog.resumeOrderTitle")}
              </p>
              <p className="text-sm text-[#6b6259] mb-5">{t("catalog.resumeOrderBody")}</p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={continueSavedOrder}
                  className="w-full bg-[#1a1714] text-white rounded-xl py-[13px] font-semibold text-sm"
                >
                  {t("catalog.resumeOrderContinue")}
                </button>
                <button
                  onClick={discardSavedOrder}
                  className="w-full text-sm text-[#b3402e] font-semibold py-1.5"
                >
                  {t("catalog.resumeOrderDiscard")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CartContext.Provider>
  );
}

type AppliedCoupon = { code: string; discountPercent: number };

function formatCardNumber(value: string): string {
  return value
    .replace(/[^0-9]/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatCardExpiry(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

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
  const [businessName, setBusinessName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    emailError: string | null;
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

    if (!customerName.trim() || !businessName.trim() || !customerPhone.trim()) {
      setError(t("checkout.errorMissingInfo"));
      return;
    }

    if (!paymentMethod) {
      setError(t("checkout.errorMissingPaymentMethod"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          businessName,
          customerPhone,
          paymentMethod,
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
        emailError: data.emailError,
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
            <div className="w-[52px] h-[52px] rounded-full bg-[#f1f7f1] text-[#2f6b3a] flex items-center justify-center mx-auto mb-3.5">
              <CheckIcon className="w-6 h-6" />
            </div>
            <p className="font-bold text-[18px] text-[#1a1714] mb-2">{t("checkout.successTitle")}</p>
            <p className="text-sm text-[#6b6259] mb-1.5">
              {success.emailError ? t("checkout.emailPending") : t("checkout.emailSent")}
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
                    ₪{(getEffectivePrice(line.product) * line.quantity).toFixed(2)}
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
                type="text"
                placeholder={t("checkout.businessNamePlaceholder")}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
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

            <div className="mb-4">
              <p className="text-[13px] font-semibold text-[#6b6259] mb-2">
                {t("checkout.paymentMethodLabel")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <PaymentMethodButton
                  active={paymentMethod === PAYMENT_METHOD.CASH}
                  icon={<CashIcon className="w-5 h-5" />}
                  label={t("checkout.paymentCash")}
                  onClick={() => setPaymentMethod(PAYMENT_METHOD.CASH)}
                />
                <PaymentMethodButton
                  active={paymentMethod === PAYMENT_METHOD.CREDIT}
                  icon={<CreditCardIcon className="w-5 h-5" />}
                  label={t("checkout.paymentCredit")}
                  onClick={() => setPaymentMethod(PAYMENT_METHOD.CREDIT)}
                />
                <PaymentMethodButton
                  active={paymentMethod === PAYMENT_METHOD.PAY_LATER}
                  icon={<ClockIcon className="w-5 h-5" />}
                  label={t("checkout.paymentPayLater")}
                  onClick={() => setPaymentMethod(PAYMENT_METHOD.PAY_LATER)}
                />
              </div>

              {paymentMethod === PAYMENT_METHOD.CREDIT && (
                <div className="mt-3 border border-[#e6e0d6] rounded-xl p-3.5 bg-[#f7f5f1] space-y-2.5">
                  <div className="flex items-center gap-2 text-[#6b6259]">
                    <CreditCardIcon className="w-4 h-4" />
                    <span className="text-[12px] font-semibold">{t("checkout.paymentCredit")}</span>
                  </div>
                  <input
                    type="text"
                    placeholder={t("checkout.creditCardholderPlaceholder")}
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-[11px] bg-white placeholder:text-[#a39a8e] text-sm"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={t("checkout.creditCardNumberPlaceholder")}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-[11px] bg-white placeholder:text-[#a39a8e] text-sm tracking-wider"
                  />
                  <div className="flex gap-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={t("checkout.creditExpiryPlaceholder")}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
                      className="w-1/2 border border-[#e6e0d6] rounded-xl px-3.5 py-[11px] bg-white placeholder:text-[#a39a8e] text-sm"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={t("checkout.creditCvvPlaceholder")}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      className="w-1/2 border border-[#e6e0d6] rounded-xl px-3.5 py-[11px] bg-white placeholder:text-[#a39a8e] text-sm"
                    />
                  </div>
                </div>
              )}
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

function PaymentMethodButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 px-1.5 text-[11.5px] font-semibold leading-tight text-center text-[#4a443c] transition-colors ${
        active ? "border-[var(--secondary)]" : "border-[#e6e0d6]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
