"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CHECKOUT_LIMITS } from "@/lib/checkout-limits";
import { buyerDetailsError, type BuyerDetailsError } from "@/lib/buyer-details";
import { formatLocalPhone } from "@/lib/phone";
import { asProductUnit } from "@/lib/product-unit";
import { BuyerContext, type ShopBuyer } from "@/components/buyer-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { BackToTop } from "@/components/back-to-top";
import { BrandLogo } from "@/components/brand-logo";
import {
  CheckIcon,
  HashIcon,
  PhoneIcon,
  LogOutIcon,
  StoreIcon,
  ChevronDownIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { WAREHOUSE_CONTACT_PHONE, WAREHOUSE_NAME } from "@/lib/branding";
import { type Product, ProductDetailModal, ShopCard, groupIntoCards } from "@/components/catalog-ui";
import { backdropCloseProps } from "@/lib/backdrop-close";

const CART_STORAGE_KEY = "warehouse-cart";

type CartContextValue = {
  cart: Record<string, number>;
  addToCart: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  openProductDetail: (product: Product) => void;
  /** Every product (null until loaded), for showing cart items from any page. */
  allProducts: Product[] | null;
  /** Opens the send-order (checkout) window. */
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
}: {
  children: React.ReactNode;
  /** The logged-in buyer (from the server), or null for a guest. */
  buyer: ShopBuyer | null;
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

  // Loaded once in the background on mount - the cart page and the checkout
  // window need full product details (name, unit...) for cart items
  // regardless of which page's grid added them.
  useEffect(() => {
    ensureAllProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After logging in or out (or changing details at checkout): re-render the
  // server layout, which reads the buyer from the cookie.
  async function afterLoginChange() {
    router.refresh();
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
  // Distinct products in the cart (the floating bar's "3 items").
  const cartLines = Object.values(cart).filter((qty) => qty > 0).length;

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
                {/* Guests get the sign-up button; logged in, "contact us" moves into the account menu. */}
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
              // Sized by its content (at least 220px, at most the screen width).
              className="min-w-[220px] max-w-full bg-[var(--accent)] text-white rounded-full px-6 py-3.5 flex items-center justify-between gap-6 font-bold text-base whitespace-nowrap shadow-[0_10px_20px_-8px_rgba(0,0,0,0.45)]"
            >
              <span>
                {cartLines === 1 ? t("catalog.cartItemsOne") : t("catalog.cartItemsOther", { count: cartLines })}
              </span>
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
            onDetailsChanged={afterLoginChange}
            products={allProducts}
            cart={cart}
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
            onClose={() => setLoginOpen(false)}
            onLoggedIn={afterLoginChange}
          />
        )}

        {/* Only for buyers: a guest can't order anyway. */}
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

// Logged-in buyer: a pill with their first name; tapping it opens a small
// menu with their name, business, phone, contact us and log out.
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
  const subtitle = buyer.name && buyer.businessName ? buyer.businessName : null;
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
        {/* Their first name (from sign-up); business or phone as a fallback. */}
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
              {subtitle && <p className="text-[13px] text-[#6b6259] truncate">{subtitle}</p>}
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

// Shop sign-up: first name, business name, ח.פ and phone, entered once. The
// buyer is logged in straight away and stays logged in on this device until
// they log out. The details are also kept on the device (LAST_LOGIN_KEY), so
// after logging out the window comes back filled in.
const WELCOME_MS = 1400;
const LAST_LOGIN_KEY = "buyer-last-login";

type DetailsForm = { name: string; businessName: string; businessId: string; phone: string };
const EMPTY_DETAILS: DetailsForm = { name: "", businessName: "", businessId: "", phone: "" };

function readLastLogin(): DetailsForm {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_LOGIN_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      const text = (v: unknown) => (typeof v === "string" ? v : "");
      return {
        name: text(saved.name),
        businessName: text(saved.businessName),
        businessId: text(saved.businessId),
        phone: text(saved.phone),
      };
    }
  } catch {
    // Private mode / blocked storage: just start empty.
  }
  return EMPTY_DETAILS;
}

function saveLastLogin(details: DetailsForm) {
  try {
    localStorage.setItem(
      LAST_LOGIN_KEY,
      JSON.stringify({
        name: details.name.trim(),
        businessName: details.businessName.trim(),
        businessId: details.businessId.trim(),
        phone: details.phone.trim(),
      })
    );
  } catch {
    // Storage blocked: they stay logged in by the cookie anyway.
  }
}

/** The message for a buyerDetailsError() code (same codes from the APIs). */
function detailsErrorMessage(t: ReturnType<typeof useLocale>["t"], code: BuyerDetailsError): string {
  if (code === "invalid_business_id") return t("buyer.errorInvalidBusinessId");
  if (code === "invalid_phone") return t("buyer.errorInvalidPhone");
  return t("buyer.errorMissingInfo");
}

const DETAILS_INPUT_CLASS =
  "w-full border-2 border-[color-mix(in_srgb,var(--accent)_55%,white)] rounded-xl ps-10 pe-3.5 py-3 bg-white placeholder:text-[#a39a8e] outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]";

// The four detail fields, shared by the sign-up window and checkout.
function DetailsFields({
  value,
  onChange,
  animate = false,
}: {
  value: DetailsForm;
  onChange: (next: DetailsForm) => void;
  animate?: boolean;
}) {
  const { t } = useLocale();
  const fields: {
    key: keyof DetailsForm;
    icon: typeof UserIcon;
    placeholder: string;
    maxLength: number;
    type: string;
    inputMode?: "tel" | "numeric";
    autoComplete: string;
    ltr?: boolean;
  }[] = [
    { key: "name", icon: UserIcon, placeholder: t("buyer.firstNamePlaceholder"), maxLength: CHECKOUT_LIMITS.name, type: "text", autoComplete: "given-name" },
    { key: "businessName", icon: StoreIcon, placeholder: t("buyer.businessPlaceholder"), maxLength: CHECKOUT_LIMITS.businessName, type: "text", autoComplete: "organization" },
    { key: "businessId", icon: HashIcon, placeholder: t("buyer.businessIdPlaceholder"), maxLength: CHECKOUT_LIMITS.businessId, type: "text", inputMode: "numeric", autoComplete: "off" },
    { key: "phone", icon: PhoneIcon, placeholder: t("buyer.phonePlaceholder"), maxLength: CHECKOUT_LIMITS.phone, type: "tel", inputMode: "tel", autoComplete: "tel" },
  ];
  return (
    <div className="space-y-3">
      {fields.map((field, i) => {
        const Icon = field.icon;
        return (
          <div
            key={field.key}
            className={`relative ${animate ? "menu-item" : ""}`}
            style={animate ? { animationDelay: `${100 + i * 50}ms` } : undefined}
          >
            <Icon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent)]" />
            <input
              type={field.type}
              inputMode={field.inputMode}
              placeholder={field.placeholder}
              aria-label={field.placeholder}
              value={value[field.key]}
              maxLength={field.maxLength}
              autoComplete={field.autoComplete}
              onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
              className={DETAILS_INPUT_CLASS}
            />
          </div>
        );
      })}
    </div>
  );
}

function LoginDialog({
  onClose,
  onLoggedIn,
}: {
  onClose: () => void;
  /** Refreshes the page as logged in; the window then shows a short welcome and closes itself. */
  onLoggedIn: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [details, setDetails] = useState<DetailsForm>(EMPTY_DETAILS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  // Plays the closing animation, then really closes.
  const [closing, setClosing] = useState(false);
  const requestClose = () => setClosing(true);

  useEffect(() => {
    setDetails(readLastLogin());
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, 160);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  useEffect(() => {
    if (welcomeName == null) return;
    const timer = setTimeout(requestClose, WELCOME_MS);
    return () => clearTimeout(timer);
    // Only when the welcome appears: onClose is a new function on every
    // parent render (the refresh re-renders it), which would restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeName]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = buyerDetailsError(details);
    if (problem) {
      setError(detailsErrorMessage(t, problem));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/buyer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "too_many_attempts") setError(t("buyer.errorTooMany"));
        else if (["missing_info", "invalid_business_id", "invalid_phone"].includes(data.error))
          setError(detailsErrorMessage(t, data.error));
        else setError(t("buyer.errorFailed"));
        return;
      }
      saveLastLogin(details);
      setWelcomeName(typeof data.name === "string" ? data.name : details.name.trim());
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

        {welcomeName != null ? (
          <div className="py-6 text-center" role="status">
            <div className="tick-pop w-[52px] h-[52px] rounded-full bg-[#f1f7f1] text-[#2f6b3a] flex items-center justify-center mx-auto mb-3.5">
              <CheckIcon className="w-6 h-6" />
            </div>
            <p className="menu-item font-bold text-[17px] text-[#1a1714]" style={{ animationDelay: "150ms" }}>
              {t("buyer.welcome", { name: welcomeName })}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-3 mt-1">
              <BrandLogo />
            </div>
            <h2 className="text-[19px] font-bold text-[#1a1714] text-center mb-1">{t("buyer.loginTitle")}</h2>
            <p className="text-[13px] text-[#6b6259] text-center mb-5">{t("buyer.loginHint")}</p>

            <div className="mb-4">
              <DetailsFields value={details} onChange={setDetails} animate />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--accent)] text-white rounded-xl py-[14px] font-semibold text-base transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? t("buyer.loggingIn") : t("buyer.submit")}
            </button>
            {error && <p className="text-sm text-[#b3402e] mt-2 text-center">{error}</p>}
            <p className="text-xs text-[#8a8177] text-center mt-3">{t("buyer.rememberedNote")}</p>
          </>
        )}
      </form>
    </div>
  );
}

// Sending the order: the items and quantities, the buyer's saved details
// (filled in, changeable), and a note that prices come back from the owner.
function CheckoutSheet({
  buyer,
  onLoginNeeded,
  onDetailsChanged,
  products,
  cart,
  onClose,
  onOrdered,
}: {
  buyer: ShopBuyer;
  onLoginNeeded: () => void;
  /** After an order that changed the buyer's details: refresh the page's copy. */
  onDetailsChanged: () => void;
  products: Product[];
  cart: Record<string, number>;
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

  const savedDetails: DetailsForm = {
    name: buyer.name,
    businessName: buyer.businessName,
    businessId: buyer.businessId,
    phone: formatLocalPhone(buyer.phone),
  };
  const [details, setDetails] = useState<DetailsForm>(savedDetails);
  // The saved details show as a summary; "change" opens the fields. A buyer
  // whose saved details are incomplete gets the fields straight away.
  const [editingDetails, setEditingDetails] = useState(buyerDetailsError(savedDetails) != null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const lines = products
    .filter((product) => cart[product.id] > 0)
    .map((product) => ({ product, quantity: cart[product.id] }));

  async function submitOrder() {
    setError(null);
    const problem = buyerDetailsError(details);
    if (problem) {
      setEditingDetails(true);
      setError(detailsErrorMessage(t, problem));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          details,
          items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "login_required") {
          onLoginNeeded();
          return;
        }
        if (["missing_info", "invalid_business_id", "invalid_phone"].includes(data.error)) {
          setEditingDetails(true);
          setError(detailsErrorMessage(t, data.error));
        } else if (data.error === "phone_taken") {
          setEditingDetails(true);
          setError(t("checkout.errorPhoneTaken"));
        } else if (data.error === "insufficient_stock")
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
        else setError(t("checkout.errorFailed"));
        return;
      }

      saveLastLogin(details);
      if (editingDetails) onDetailsChanged();
      setSuccess(true);
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
            <p className="text-sm text-[#6b6259]">{t("checkout.successBody")}</p>
            <button
              onClick={onOrdered}
              className="w-full bg-[#1a1714] text-white rounded-xl py-[15px] font-semibold text-base mt-6"
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

            <p className="text-[13px] font-semibold text-[#6b6259] mb-2">{t("checkout.itemsTitle")}</p>
            <ul className="mb-4 bg-[#faf8f5] rounded-xl px-3.5 py-2.5 divide-y divide-[#f0ece5] text-sm max-h-48 overflow-y-auto">
              {lines.map(({ product, quantity }) => (
                <li key={product.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0 text-[#1a1714] line-clamp-1">{product.name}</span>
                  <span className="shrink-0 font-semibold text-[#4a443c]">
                    {quantity} {t(`catalog.${quantity === 1 ? "unitName" : "unitMany"}.${asProductUnit(product.unit)}`)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-semibold text-[#6b6259]">{t("checkout.detailsTitle")}</p>
              {!editingDetails && (
                <button
                  type="button"
                  onClick={() => setEditingDetails(true)}
                  className="text-[13px] font-semibold text-[var(--accent)]"
                >
                  {t("checkout.editDetails")}
                </button>
              )}
            </div>
            {editingDetails ? (
              <div className="mb-4">
                <DetailsFields value={details} onChange={setDetails} />
              </div>
            ) : (
              <div className="mb-4 border border-[#e6e0d6] rounded-xl px-3.5 py-3 text-sm space-y-0.5">
                <p className="font-semibold text-[#1a1714]">
                  {details.name} · {details.businessName}
                </p>
                <p className="text-[#6b6259]">
                  {t("buyer.businessIdPlaceholder")}: <span dir="ltr">{details.businessId}</span>
                </p>
                <p className="text-[#6b6259]" dir="ltr" style={{ textAlign: "end" }}>
                  {details.phone}
                </p>
              </div>
            )}

            <p className="text-[13px] text-[#6b6259] bg-[#fdf6e8] border border-[#f0dfba] rounded-xl px-3.5 py-2.5 mb-4">
              {t("checkout.pricesNote")}
            </p>

            <button
              onClick={submitOrder}
              disabled={submitting || lines.length === 0}
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
