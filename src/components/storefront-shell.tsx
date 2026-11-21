"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { formatLocalPhone, isValidIsraeliPhone } from "@/lib/phone";
import { BuyerContext, type ShopBuyer } from "@/components/buyer-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { BackToTop } from "@/components/back-to-top";
import { BrandLogo } from "@/components/brand-logo";
import {
  CashIcon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  PhoneIcon,
  LogOutIcon,
  StoreIcon,
  ChevronDownIcon,
  SearchIcon,
} from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { WAREHOUSE_CONTACT_PHONE, WAREHOUSE_NAME } from "@/lib/branding";
import { PAYMENT_METHOD, type PaymentMethod } from "@/lib/payment-method";
import { type Product, ProductDetailModal, ShopCard, groupIntoCards } from "@/components/catalog-ui";
import { getEffectivePrice } from "@/lib/effective-price";
import { VAT_PERCENT, bestCouponFor, calculateOrderTotals, type CouponRule } from "@/lib/order-totals";
import { backdropCloseProps } from "@/lib/backdrop-close";

const CART_STORAGE_KEY = "warehouse-cart";

// 12345.5 -> "12,345.50": thousands separators keep big totals readable.
function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type CartContextValue = {
  cart: Record<string, number>;
  addToCart: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  openProductDetail: (product: Product) => void;
  /** Every product (null until loaded), for showing cart items from any page. */
  allProducts: Product[] | null;
  cartTotal: number;
  /** Opens the payment (checkout) window. */
  openCheckout: () => void;
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

export function StorefrontShell({
  children,
  buyer,
  customerTypes,
}: {
  children: React.ReactNode;
  /** The logged-in buyer (from the server), or null for a guest. */
  buyer: ShopBuyer | null;
  customerTypes: { id: string; name: string; icon: string }[];
}) {
  const { t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
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

  // After logging in or out the prices change: re-render the server pages
  // and reload the product list used by search, the cart and checkout.
  async function afterLoginChange() {
    router.refresh();
    const res = await fetch("/api/products");
    setAllProducts(await res.json());
  }

  async function logout() {
    await fetch("/api/buyer/logout", { method: "POST" });
    await afterLoginChange();
  }

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
    (sum, product) => sum + (cart[product.id] ?? 0) * (getEffectivePrice(product) ?? 0),
    0
  );

  const isSearching = searchQuery.trim().length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching || !allProducts) return [];
    const query = searchQuery.trim().toLowerCase();
    return allProducts
      // A card's options also match on the card's name ("מזלג" finds every colour).
      .filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          (product.variantGroup?.name.toLowerCase().includes(query) ?? false)
      )
      .sort(compareProductNames);
  }, [allProducts, searchQuery, isSearching]);

  const contextValue: CartContextValue = {
    cart,
    addToCart,
    setQuantity,
    openProductDetail: setExpandedProduct,
    allProducts,
    cartTotal,
    openCheckout,
  };

  return (
    <BuyerContext.Provider value={{ buyer, openLogin: () => setLoginOpen(true) }}>
    <CartContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#f7f5f1] pb-28">
        <header ref={headerRef} className="sticky top-0 z-10 bg-white border-b border-[#eae5dc]">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <Link href="/">
                <BrandLogo />
              </Link>
              <div className="flex items-center gap-3">
                {/* Guests see no prices; logging in shows their type's prices. */}
                {/* Logged in: "contact us" moves into the account menu. */}
                {buyer ? (
                  <AccountMenu buyer={buyer} onContact={scrollToContact} onLogout={logout} />
                ) : (
                  <>
                    <button
                      onClick={() => setLoginOpen(true)}
                      className="text-[13px] font-semibold text-[var(--accent)] border border-[var(--accent)] rounded-full px-3.5 py-1.5"
                    >
                      {t("buyer.login")}
                    </button>
                    <button onClick={scrollToContact} className="text-[13px] font-semibold text-[#6b6259]">
                      {t("catalog.contactUs")}
                    </button>
                  </>
                )}
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
                {groupIntoCards(searchResults).map((card) => (
                  <ShopCard
                    key={card.key}
                    options={card.options}
                    cart={cart}
                    onAdd={addToCart}
                    onSetQuantity={setQuantity}
                    onExpand={setExpandedProduct}
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
            {/* Developer credit: always English, left-to-right, on every locale. */}
            <p dir="ltr" lang="en" className="text-[13px] text-[#6b6259] mb-3.5">
              Developed By Funoon
            </p>
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

        {/* Floating "to cart" bar on every shop page except the cart itself,
            which has its own "continue to payment" button. */}
        {buyer && cartCount > 0 && !checkoutOpen && pathname !== "/cart" && (
          <div className="fixed bottom-0 inset-x-0 z-20 px-3.5 pt-4 pb-4 bg-gradient-to-t from-[#f7f5f1] from-[62%] to-transparent flex justify-center">
            <Link
              href="/cart"
              // Sized by its content (at least 220px, at most the screen width)
              // so both ₪9.90 and ₪12,345.00 fit on one line.
              className="min-w-[220px] max-w-full bg-[var(--accent)] text-white rounded-full px-6 py-3.5 flex items-center justify-between gap-6 font-bold text-base whitespace-nowrap shadow-[0_10px_20px_-8px_rgba(0,0,0,0.45)]"
            >
              <span className="tabular-nums" dir="ltr">₪{formatPrice(cartTotal)}</span>
              <span className="flex items-center gap-2 shrink-0">
                {t("catalog.viewCart")}
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
            </Link>
          </div>
        )}

        {/* Raised above the floating cart bar (and the cart page's pay bar). */}
        <BackToTop bottomClass={cartCount > 0 ? "bottom-24" : "bottom-5"} />
        <BackButton homeHref="/" bottomClass={cartCount > 0 ? "bottom-24" : "bottom-5"} />

        {checkoutOpen && allProducts && buyer && (
          <CheckoutSheet
            buyer={buyer}
            onLoginNeeded={() => {
              setCheckoutOpen(false);
              setLoginOpen(true);
            }}
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
            options={
              expandedProduct.variantGroup
                ? (allProducts ?? [])
                    .filter((p) => p.variantGroup?.id === expandedProduct.variantGroup?.id)
                    .sort((a, b) => a.variantOrder - b.variantOrder)
                : []
            }
            onSelectOption={setExpandedProduct}
          />
        )}

        {loginOpen && (
          <LoginDialog
            customerTypes={customerTypes}
            initialPhone={buyer ? formatLocalPhone(buyer.phone) : ""}
            initialTypeId={buyer?.customerType.id ?? ""}
            onClose={() => setLoginOpen(false)}
            onLoggedIn={afterLoginChange}
          />
        )}

        {/* Only for buyers: a guest can't see prices or order anyway. */}
        {buyer && resumePromptOpen && (
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
    </BuyerContext.Provider>
  );
}

// Logged-in buyer: a pill with their name; tapping it
// opens a small menu with their name, phone, contact us and log out.
function AccountMenu({
  buyer,
  onContact,
  onLogout,
}: {
  buyer: ShopBuyer;
  onContact: () => void;
  onLogout: () => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  // Kept on screen briefly after closing so the menu can animate out.
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  function close() {
    setOpen(false);
    setClosing(true);
  }

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setClosing(false), 130);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayName = buyer.name || buyer.businessName;
  const items = [
    { label: t("catalog.contactUs"), icon: PhoneIcon, onClick: onContact, danger: false },
    { label: t("buyer.logout"), icon: LogOutIcon, onClick: onLogout, danger: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : (setClosing(false), setOpen(true)))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("buyer.accountMenu")}
        className={`flex items-center gap-1 text-[13px] font-semibold border border-[var(--accent)] rounded-full ps-3.5 pe-2.5 py-1.5 transition-colors duration-150 active:scale-95 ${
          open ? "bg-[var(--accent)] text-white" : "text-[var(--accent)]"
        }`}
      >
        {/* Their name (remembered from their last order); before a first order: business or phone. */}
        <span className="block max-w-[110px] truncate" dir={displayName ? undefined : "ltr"}>
          {displayName || formatLocalPhone(buyer.phone)}
        </span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {(open || closing) && (
        <div
          role="menu"
          data-closing={closing || undefined}
          className="menu-pop absolute top-full mt-2.5 end-0 z-20 w-64 bg-white border border-[var(--accent)] rounded-2xl shadow-[0_12px_32px_-8px_rgba(26,23,20,0.28)]"
        >
          {/* The little arrow pointing up at the button. */}
          <span
            aria-hidden
            className="absolute -top-[6px] end-6 w-3 h-3 rotate-45 bg-white border-t border-s border-[var(--accent)]"
          />
          <div className="relative flex items-center gap-3 px-4 pt-4 pb-3.5">
            <span
              aria-hidden
              className="w-10 h-10 shrink-0 rounded-full bg-[var(--accent)] text-white flex items-center justify-center"
            >
              <StoreIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              {displayName && <p className="font-bold text-[15px] text-[#1a1714] truncate">{displayName}</p>}
              <p dir="ltr" className="text-[13px] text-[#8a8177] text-end">
                {formatLocalPhone(buyer.phone)}
              </p>
            </div>
          </div>
          <div className="border-t border-[#f2efe9] p-1.5">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    item.onClick();
                  }}
                  style={{ animationDelay: `${60 + i * 50}ms` }}
                  className={`menu-item w-full flex items-center gap-2.5 text-start rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-colors active:scale-[0.98] ${
                    item.danger ? "text-[#b3402e] hover:bg-[#fbf1ef]" : "text-[#1a1714] hover:bg-[#f7f5f1]"
                  }`}
                >
                  <span
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                      item.danger ? "bg-[#fbf1ef]" : "bg-[#f7f5f1] text-[var(--accent)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Shop login: phone + what kind of business (the customer type decides the
// prices). No code or verification yet, by the owner's choice. The types are
// big cards with the icon the owner picked in the admin.
const WELCOME_MS = 1400;

function LoginDialog({
  customerTypes,
  initialPhone,
  initialTypeId,
  onClose,
  onLoggedIn,
}: {
  customerTypes: { id: string; name: string; icon: string }[];
  initialPhone: string;
  initialTypeId: string;
  onClose: () => void;
  /** Reloads the prices; the window then shows a short welcome and closes itself. */
  onLoggedIn: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [phone, setPhone] = useState(initialPhone);
  const [typeId, setTypeId] = useState(initialTypeId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcomeType, setWelcomeType] = useState<string | null>(null);
  // Plays the closing animation, then really closes.
  const [closing, setClosing] = useState(false);
  const requestClose = () => setClosing(true);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, 160);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  useEffect(() => {
    if (!welcomeType) return;
    const timer = setTimeout(requestClose, WELCOME_MS);
    return () => clearTimeout(timer);
    // Only when the welcome appears: onClose is a new function on every
    // parent render (the price reload re-renders it), which would restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidIsraeliPhone(phone)) {
      setError(t("checkout.errorInvalidPhone"));
      return;
    }
    if (!typeId) {
      setError(t("buyer.errorMissingType"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/buyer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, customerTypeId: typeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "invalid_phone") setError(t("checkout.errorInvalidPhone"));
        else if (data.error === "too_many_attempts") setError(t("buyer.errorTooMany"));
        else setError(t("buyer.errorFailed"));
        return;
      }
      setWelcomeType(customerTypes.find((type) => type.id === typeId)?.name ?? "");
      await onLoggedIn();
    } catch {
      setError(t("buyer.errorFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-closing={closing || undefined}
      className="dialog-backdrop fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#1a1714]/55"
      onClick={requestClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t("buyer.loginTitle")}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="dialog-pop relative w-full max-w-sm bg-white border-2 border-[var(--accent)] rounded-3xl p-[22px] shadow-[0_24px_60px_-12px_rgba(26,23,20,0.45)] max-h-[90dvh] overflow-y-auto overscroll-contain"
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label={t("checkout.close")}
          className="absolute top-3.5 end-3.5 w-[30px] h-[30px] rounded-full bg-[#f2efe9] text-[#6b6259] flex items-center justify-center text-base transition-transform hover:rotate-90 active:scale-90"
        >
          ×
        </button>

        {welcomeType != null ? (
          <div className="py-6 text-center" role="status">
            <div className="tick-pop w-[52px] h-[52px] rounded-full bg-[#f1f7f1] text-[#2f6b3a] flex items-center justify-center mx-auto mb-3.5">
              <CheckIcon className="w-6 h-6" />
            </div>
            <p className="menu-item font-bold text-[17px] text-[#1a1714]" style={{ animationDelay: "150ms" }}>
              {t("buyer.welcome", { type: welcomeType })}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-3 mt-1">
              <BrandLogo />
            </div>
            <h2 className="text-[19px] font-bold text-[#1a1714] text-center mb-5">{t("buyer.loginTitle")}</h2>

            {customerTypes.length === 0 ? (
              <p className="text-sm text-[#b3402e] text-center">{t("buyer.noTypesYet")}</p>
            ) : (
              <>
                <div className="relative mb-4">
                  <PhoneIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)]" />
                  <input
                    type="tel"
                    placeholder={t("checkout.phonePlaceholder")}
                    value={phone}
                    maxLength={CHECKOUT_LIMITS.phone}
                    inputMode="tel"
                    autoComplete="tel"
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border-2 border-[color-mix(in_srgb,var(--accent)_55%,white)] rounded-xl ps-10 pe-3.5 py-3 bg-white placeholder:text-[#a39a8e] outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                  />
                </div>

                <p className="text-[13px] font-semibold text-[#6b6259] mb-2">{t("buyer.typeLabel")}</p>
                <div role="radiogroup" aria-label={t("buyer.typeLabel")} className="grid grid-cols-3 gap-2 mb-4">
                  {customerTypes.map((type, i) => {
                    const selected = type.id === typeId;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTypeId(type.id)}
                        style={{ animationDelay: `${120 + i * 45}ms` }}
                        className={`menu-item flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-1.5 py-3 text-[12.5px] font-semibold leading-tight text-center transition-[color,background-color,border-color,transform] active:scale-95 ${
                          selected
                            ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,white)] text-[#1a1714]"
                            : "border-[color-mix(in_srgb,var(--accent)_55%,white)] bg-white text-[#4a443c] hover:border-[var(--accent)]"
                        }`}
                      >
                        <span className="text-[26px] leading-none" aria-hidden>
                          {type.icon}
                        </span>
                        {type.name}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[var(--accent)] text-white rounded-xl py-[14px] font-semibold text-base transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? t("buyer.loggingIn") : t("buyer.login")}
                </button>
                {error && <p className="text-sm text-[#b3402e] mt-2">{error}</p>}
                <p className="text-xs text-[#8a8177] text-center mt-3">{t("buyer.rememberedNote")}</p>
              </>
            )}
          </>
        )}
      </form>
    </div>
  );
}

// categoryNames: for the tag and messages; empty = a whole-order coupon.
type AppliedCoupon = CouponRule & { categoryNames: string[] };

function CheckoutSheet({
  buyer,
  onLoginNeeded,
  products,
  cart,
  subtotal,
  onClose,
  onOrdered,
}: {
  buyer: ShopBuyer;
  onLoginNeeded: () => void;
  products: Product[];
  cart: Record<string, number>;
  subtotal: number;
  onClose: () => void;
  onOrdered: () => void;
}) {
  const { t } = useLocale();

  // Freeze the page behind the checkout window so it can't scroll while open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Filled in from the login (phone) and the buyer's last order (name, business).
  const [customerName, setCustomerName] = useState(buyer.name);
  const [businessName, setBusinessName] = useState(buyer.businessName);
  const [customerPhone, setCustomerPhone] = useState(formatLocalPhone(buyer.phone));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  // Card payment isn't connected to a payment provider yet: tapping "credit"
  // only shows a notice and never selects it (the orders API rejects it too).
  const [creditNoticeShown, setCreditNoticeShown] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupons, setAppliedCoupons] = useState<AppliedCoupon[]>([]);
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

  // Each item gets the biggest applied coupon covering it (the orders API
  // re-derives the same server-side). Prices are before VAT; the buyer pays
  // the total including VAT.
  function totalsWith(coupons: CouponRule[]) {
    return calculateOrderTotals(
      lines.map(({ product, quantity }) => {
        const coupon = bestCouponFor(
          product.categories.map((c) => c.id),
          coupons
        );
        return {
          price: getEffectivePrice(product) ?? 0,
          quantity,
          couponCode: coupon?.code,
          discountPercent: coupon?.discountPercent,
        };
      }),
      null,
      VAT_PERCENT
    );
  }
  const { discounts, totalBeforeVat, vatAmount, total } = totalsWith(appliedCoupons);

  async function applyCoupon() {
    setCouponError(null);
    if (!couponInput.trim()) {
      setCouponError(t("checkout.couponErrorEmpty"));
      return;
    }

    if (appliedCoupons.some((c) => c.code === couponInput.trim().toUpperCase())) {
      setCouponError(t("checkout.couponErrorDuplicate"));
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
        setCouponError(t("checkout.couponErrorInvalid"));
        return;
      }
      const coupon: AppliedCoupon = {
        code: data.code,
        discountPercent: data.discountPercent,
        categoryIds: data.categoryIds ?? [],
        categoryNames: data.categoryNames ?? [],
      };
      if (!totalsWith([coupon]).discounts.length) {
        // A category coupon with none of its categories in the cart.
        setCouponError(t("checkout.couponErrorNoItems", { categories: coupon.categoryNames.join(", ") }));
        return;
      }
      if (!totalsWith([...appliedCoupons, coupon]).discounts.some((d) => d.code === coupon.code)) {
        // Every item it covers already has an equal or bigger coupon.
        setCouponError(t("checkout.couponErrorNoBetter"));
        return;
      }
      setAppliedCoupons([...appliedCoupons, coupon]);
      setCouponInput("");
    } catch {
      setCouponError(t("checkout.couponErrorNetwork"));
    } finally {
      setValidatingCoupon(false);
    }
  }

  // Pay-later is only offered with a coupon applied, so drop it as the chosen
  // method whenever the coupon goes away (removed, or replaced by an invalid one).
  useEffect(() => {
    if (appliedCoupons.length === 0 && paymentMethod === PAYMENT_METHOD.PAY_LATER) setPaymentMethod(null);
  }, [appliedCoupons, paymentMethod]);

  function removeCoupon(code: string) {
    setAppliedCoupons(appliedCoupons.filter((c) => c.code !== code));
    setCouponError(null);
  }

  async function submitOrder() {
    setError(null);

    if (!customerName.trim() || !businessName.trim() || !customerPhone.trim()) {
      setError(t("checkout.errorMissingInfo"));
      return;
    }

    if (!isValidIsraeliPhone(customerPhone)) {
      setError(t("checkout.errorInvalidPhone"));
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
          couponCodes: appliedCoupons.map((c) => c.code),
          items: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "login_required") {
          onLoginNeeded();
          return;
        }
        if (data.error === "invalid_phone") setError(t("checkout.errorInvalidPhone"));
        else if (data.error === "insufficient_stock")
          setError(
            t("checkout.errorInsufficientStock", {
              items: (data.items ?? [])
                .map((item: { name: string; available: number }) =>
                  t("checkout.stockLeft", { name: item.name, available: item.available })
                )
                .join(", "),
            })
          );
        else if (data.error === "out_of_stock")
          setError(t("checkout.errorOutOfStock", { names: (data.names ?? []).join(", ") }));
        else if (data.error === "too_many_orders") setError(t("checkout.errorTooManyOrders"));
        else if (data.error === "pay_later_requires_coupon") setError(t("checkout.errorPayLaterNeedsCoupon"));
        else if (data.error === "credit_unavailable") setError(t("checkout.creditUnavailable"));
        else setError(t("checkout.errorFailed"));
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
    // A centered window on every screen size. The dark overlay covers the whole
    // page, so nothing behind it can be tapped while checkout is open.
    // Clicking outside closes it (after an order: same as the "done" button);
    // not while the order is being sent.
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#1a1714]/55"
      {...backdropCloseProps(() => {
        if (submitting) return;
        if (success) onOrdered();
        else onClose();
      })}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("checkout.title")}
        className="w-full max-w-md bg-white rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain shadow-xl"
      >
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

            <div className="mb-4">
              {appliedCoupons.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  {appliedCoupons.map((coupon) => (
                    <div
                      key={coupon.code}
                      className="flex items-center justify-between gap-2 bg-[#f1f7f1] border border-[#cfe3cf] rounded-xl px-3.5 py-[9px]"
                    >
                      <span className="text-sm font-semibold text-[#2f6b3a] min-w-0">
                        {t("checkout.couponApplied", { code: coupon.code, percent: coupon.discountPercent })}
                        <span className="block text-xs font-medium text-[#4f7d57]">
                          {coupon.categoryNames.length > 0
                            ? t("checkout.couponOnlyFor", { categories: coupon.categoryNames.join(", ") })
                            : t("checkout.couponWholeOrder")}
                        </span>
                      </span>
                      <button
                        onClick={() => removeCoupon(coupon.code)}
                        aria-label={t("checkout.remove")}
                        className="w-7 h-7 shrink-0 rounded-full text-[#2f6b3a] hover:bg-[#e2efe2] flex items-center justify-center text-base"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={
                      appliedCoupons.length > 0 ? t("checkout.couponPlaceholderAnother") : t("checkout.couponPlaceholder")
                    }
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="flex-1 min-w-0 border border-[#e6e0d6] rounded-xl px-3.5 py-[11px] bg-[#f7f5f1] uppercase placeholder:normal-case placeholder:text-[#a39a8e]"
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={validatingCoupon}
                    className="shrink-0 border border-[#1a1714] text-[#1a1714] rounded-xl px-[18px] py-[11px] text-sm font-semibold disabled:opacity-50"
                  >
                    {validatingCoupon ? t("checkout.checking") : t("checkout.apply")}
                  </button>
                </div>
              {couponError && <p className="text-[13px] text-[#b3402e] mt-1">{couponError}</p>}
            </div>

            <div className="mb-4 space-y-[7px] text-sm">
              {discounts.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-[#6b6259]">
                    <span>{t("checkout.subtotal")}</span>
                    <span>₪{subtotal.toFixed(2)}</span>
                  </div>
                  {discounts.map((discount) => (
                    <div key={discount.code} className="flex items-center justify-between text-[#2f6b3a]">
                      <span>{t("checkout.couponDiscount", { code: discount.code, percent: discount.percent })}</span>
                      <span>-₪{discount.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </>
              )}
              <div className="flex items-center justify-between text-[#6b6259]">
                <span>{t("checkout.totalBeforeVat")}</span>
                <span>₪{totalBeforeVat.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#6b6259]">
                <span>{t("checkout.vat", { percent: VAT_PERCENT })}</span>
                <span>₪{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[17px] font-bold text-[#1a1714] pt-[7px] border-t border-[#f0ece5]">
                <span>{t("checkout.totalToPay")}</span>
                <span>₪{total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              <input
                type="text"
                placeholder={t("checkout.namePlaceholder")}
                value={customerName}
                maxLength={CHECKOUT_LIMITS.name}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-[13px] bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
              <input
                type="text"
                placeholder={t("checkout.businessNamePlaceholder")}
                value={businessName}
                maxLength={CHECKOUT_LIMITS.businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-[13px] bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
              <input
                type="tel"
                placeholder={t("checkout.phonePlaceholder")}
                value={customerPhone}
                maxLength={CHECKOUT_LIMITS.phone}
                inputMode="tel"
                autoComplete="tel"
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-[13px] bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
            </div>

            <div className="mb-4">
              <p className="text-[13px] font-semibold text-[#6b6259] mb-2">
                {t("checkout.paymentMethodLabel")}
              </p>
              <div className={`grid gap-2 ${appliedCoupons.length > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
                <PaymentMethodButton
                  active={paymentMethod === PAYMENT_METHOD.CASH}
                  icon={<CashIcon className="w-5 h-5" />}
                  label={t("checkout.paymentCash")}
                  onClick={() => {
                    setPaymentMethod(PAYMENT_METHOD.CASH);
                    setCreditNoticeShown(false);
                  }}
                />
                <PaymentMethodButton
                  active={false}
                  icon={<CreditCardIcon className="w-5 h-5" />}
                  label={t("checkout.paymentCredit")}
                  onClick={() => setCreditNoticeShown(true)}
                />
                {appliedCoupons.length > 0 && (
                  <PaymentMethodButton
                    active={paymentMethod === PAYMENT_METHOD.PAY_LATER}
                    icon={<ClockIcon className="w-5 h-5" />}
                    label={t("checkout.paymentPayLater")}
                    onClick={() => {
                      setPaymentMethod(PAYMENT_METHOD.PAY_LATER);
                      setCreditNoticeShown(false);
                    }}
                  />
                )}
              </div>

              {creditNoticeShown && (
                <div className="mt-3 flex items-start gap-2.5 border border-[#e6e0d6] rounded-xl p-3.5 bg-[#f7f5f1] text-[#6b6259]">
                  <CreditCardIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-[13px] leading-relaxed">{t("checkout.creditUnavailable")}</p>
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
