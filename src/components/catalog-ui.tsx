"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PackageIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { optimizedImage } from "@/lib/image-url";
import { getEffectivePrice, getSalePercentOff } from "@/lib/effective-price";
import { asProductUnit } from "@/lib/product-unit";

export type Category = {
  id: string;
  name: string;
  order: number;
};

export type Subcategory = {
  id: string;
  name: string;
  order: number;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
  onSale: boolean;
  salePrice: number | null;
  saleBannerImageUrl: string | null;
  categories: Category[];
  subcategory: Subcategory | null;
  /** "UNIT" or "CARTON" (src/lib/product-unit.ts). */
  unit: string;
  /** Set when this product is one option of a card (e.g. one colour). */
  variantGroup: { id: string; name: string } | null;
  variantLabel: string | null;
  variantOrder: number;
};

// ---- Product options (several products shown as one card) ----

/** A shop card: one product, or a card's options in their order. */
export type ShopCardItem = { key: string; options: Product[] };

/**
 * Groups a product list into cards. A card takes the place of its first
 * option in the list, so sorting and arranging still apply.
 */
export function groupIntoCards(products: Product[]): ShopCardItem[] {
  const cards: ShopCardItem[] = [];
  const byGroup = new Map<string, ShopCardItem>();
  for (const product of products) {
    const groupId = product.variantGroup?.id;
    if (!groupId) {
      cards.push({ key: product.id, options: [product] });
      continue;
    }
    const existing = byGroup.get(groupId);
    if (existing) {
      existing.options.push(product);
    } else {
      const card = { key: `group-${groupId}`, options: [product] };
      byGroup.set(groupId, card);
      cards.push(card);
    }
  }
  for (const card of Array.from(byGroup.values())) {
    card.options.sort((a, b) => a.variantOrder - b.variantOrder);
  }
  return cards;
}

export function optionLabel(product: Product): string {
  return product.variantLabel || product.name;
}

/** The card photo: the chosen option's, else the first option with one. */
export function cardImage(options: Product[], selected: Product | null): string | null {
  return selected?.imageUrl ?? options.find((o) => o.imageUrl)?.imageUrl ?? null;
}

// useLayoutEffect warns when React renders on the server; it only needs to
// run in the browser (to measure), so fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// The options as buttons when they all fit on one line of the card, otherwise
// a dropdown (e.g. six cup sizes on a narrow phone card). A hidden copy of the
// button row is measured against the card's width, and re-measured when the
// card resizes. Sold-out options can't be chosen.
export function OptionPicker({
  options,
  selectedId,
  onSelect,
  highlight = false,
  size = "sm",
}: {
  options: Product[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Draws attention after "add" was tapped with nothing chosen. */
  highlight?: boolean;
  size?: "sm" | "lg";
}) {
  const { t } = useLocale();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [fits, setFits] = useState(true);

  useIsomorphicLayoutEffect(() => {
    const box = boxRef.current;
    const row = rowRef.current;
    if (!box || !row) return;
    const measure = () => setFits(row.scrollWidth <= box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [options, size]);

  const ring = highlight ? "ring-2 ring-[#b3402e] ring-offset-1" : "";
  const buttonClass = (option: Product) => {
    const active = option.id === selectedId;
    return `shrink-0 whitespace-nowrap rounded-[7px] border font-semibold leading-tight ${
      size === "lg" ? "px-3 py-2 text-sm" : "px-2 py-1 text-[11px]"
    } ${
      active
        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
        : option.inStock
          ? "bg-white border-[#e6e0d6] text-[#2b2620] hover:border-[var(--accent)]"
          : "bg-[#f7f5f1] border-[#eee9e1] text-[#b5ada2] line-through"
    }`;
  };

  return (
    <div ref={boxRef} className="relative w-full min-w-0">
      {/* Measuring copy: never seen or tapped. */}
      <div ref={rowRef} aria-hidden className="absolute top-0 start-0 invisible pointer-events-none flex gap-1 w-max">
        {options.map((option) => (
          <span key={option.id} className={buttonClass(option)}>
            {optionLabel(option)}
          </span>
        ))}
      </div>

      {fits ? (
        <div className={`flex gap-1 rounded-[8px] ${ring}`} role="radiogroup">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === selectedId}
              disabled={!option.inStock}
              onClick={() => onSelect(option.id)}
              title={option.inStock ? undefined : t("catalog.outOfStock")}
              className={buttonClass(option)}
            >
              {optionLabel(option)}
            </button>
          ))}
        </div>
      ) : (
        <select
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          aria-label={t("catalog.chooseOption")}
          className={`w-full border rounded-[8px] bg-white font-semibold ${
            selectedId ? "border-[var(--accent)] text-[var(--accent)]" : "border-[#e6e0d6] text-[#2b2620]"
          } ${size === "lg" ? "px-3 py-2.5 text-sm" : "px-2 py-1.5 text-xs"} ${ring}`}
        >
          <option value="" disabled>
            {t("catalog.chooseOption")}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id} disabled={!option.inStock}>
              {optionLabel(option)}
              {option.inStock ? "" : ` (${t("catalog.soldOutShort")})`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** "From ₪X" while no option is chosen and the options' prices differ. */
function FromPrice({ options }: { options: Product[] }) {
  const { t } = useLocale();
  const prices = options.map(getEffectivePrice);
  const min = Math.min(...prices);
  return (
    <p className="text-sm font-bold text-[#1a1714] flex items-baseline gap-1 flex-wrap">
      <span>{t("catalog.priceFrom", { price: min.toFixed(2) })}</span>
      <span className="text-[#8a8177] font-medium text-[0.78em]">
        / {t(`catalog.unitName.${asProductUnit(options[0].unit)}`)}
      </span>
    </p>
  );
}

/**
 * A shop card for one product or for a card's options. With options, the
 * buyer picks one (buttons / dropdown) and the price, photo, stock and
 * quantity shown are that option's; each option is its own cart line.
 */
export function ShopCard({
  options,
  cart,
  onAdd,
  onSetQuantity,
  onExpand,
}: {
  options: Product[];
  cart: Record<string, number>;
  onAdd: (productId: string) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onExpand: (product: Product) => void;
}) {
  // Start on an option that's already in the cart, so its quantity shows.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (options.length === 1 ? options[0].id : options.find((o) => (cart[o.id] ?? 0) > 0)?.id ?? null)
  );
  const [needsChoice, setNeedsChoice] = useState(false);

  if (options.length === 1) {
    const product = options[0];
    return (
      <ProductCard
        product={product}
        quantity={cart[product.id] ?? 0}
        onAdd={() => onAdd(product.id)}
        onSetQuantity={(qty) => onSetQuantity(product.id, qty)}
        onExpand={() => onExpand(product)}
      />
    );
  }

  const selected = options.find((o) => o.id === selectedId) ?? null;
  // Shown while nothing is chosen: the first option still available.
  const shown = selected ?? options.find((o) => o.inStock) ?? options[0];
  const samePrice = new Set(options.map(getEffectivePrice)).size === 1;
  return (
    <ProductCard
      product={shown}
      title={options[0].variantGroup?.name}
      imageUrl={cardImage(options, selected)}
      price={!selected && !samePrice ? <FromPrice options={options} /> : undefined}
      picker={
        <OptionPicker
          options={options}
          selectedId={selectedId}
          highlight={needsChoice && !selected}
          onSelect={(id) => {
            setSelectedId(id);
            setNeedsChoice(false);
          }}
        />
      }
      quantity={selected ? cart[selected.id] ?? 0 : 0}
      onAdd={() => {
        if (selected) onAdd(selected.id);
        else setNeedsChoice(true);
      }}
      onSetQuantity={(qty) => selected && onSetQuantity(selected.id, qty)}
      onExpand={() => onExpand(shown)}
    />
  );
}

function PriceDisplay({ product, size = "sm" }: { product: Product; size?: "sm" | "lg" }) {
  const { t } = useLocale();
  const isOnSale = product.onSale && product.salePrice != null;
  const priceClass = size === "lg" ? "text-xl font-bold" : "text-sm font-bold";
  // "/ קרטון": what the price is for.
  const per = (
    <span className="text-[#8a8177] font-medium text-[0.78em]">
      / {t(`catalog.unitName.${asProductUnit(product.unit)}`)}
    </span>
  );
  if (!isOnSale) {
    return (
      <p className={`${priceClass} text-[#1a1714] flex items-baseline gap-1 flex-wrap`}>
        <span>₪{product.price.toFixed(2)}</span>
        {per}
      </p>
    );
  }
  return (
    <p className={`${priceClass} flex items-baseline gap-1.5 flex-wrap`}>
      <span className="text-[#b3402e]">₪{product.salePrice!.toFixed(2)}</span>
      <span className="text-[#a39a8e] font-medium line-through text-[0.85em]">
        ₪{product.price.toFixed(2)}
      </span>
      {per}
    </p>
  );
}

// The orders API accepts at most 10,000 of one product per order.
const MAX_QUANTITY = 10000;
const MAX_QUANTITY_DIGITS = String(MAX_QUANTITY).length;

export function AddToCartControl({
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
    const clamped = Number.isNaN(parsed) ? 1 : Math.min(MAX_QUANTITY, Math.max(1, parsed));
    onSetQuantity(clamped);
    setQuantityInput(String(clamped));
  }

  if (!product.inStock) {
    if (size === "lg") {
      return (
        <p className="text-center font-semibold text-[#8a8177] bg-[#f2efe9] rounded-[9px] text-sm py-3">
          {t("catalog.outOfStock")}
        </p>
      );
    }
    return (
      <span className="shrink-0 flex items-center justify-center text-center leading-[1.1] text-[9px] font-semibold text-[#8a8177] bg-[#f2efe9] rounded-[9px] h-9 px-1.5 max-w-[78px]">
        {t("catalog.outOfStock")}
      </span>
    );
  }

  if (quantity === 0) {
    if (size === "lg") {
      return (
        <button
          onClick={onAdd}
          className="bg-[var(--accent)] text-white font-semibold rounded-[9px] w-full text-sm py-3"
        >
          {t("catalog.addToCart")}
        </button>
      );
    }
    return (
      <button
        onClick={onAdd}
        aria-label={t("catalog.addToCart")}
        className="shrink-0 flex items-center justify-center bg-[var(--accent)] text-white rounded-[9px] w-9 h-9"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-[9px] p-[2px] ${
        size === "lg"
          ? "w-full bg-[#1a1714] text-white"
          : "shrink-0 min-w-[104px] h-9 bg-white border border-[var(--accent)] text-[var(--accent)]"
      }`}
    >
      <button
        onClick={() => onSetQuantity(quantity - 1)}
        aria-label="Decrease quantity"
        className={`shrink-0 font-bold leading-none ${
          size === "lg" ? "w-10 h-10 text-lg" : "w-7 h-full text-base"
        }`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={quantityInput}
        onChange={(e) => setQuantityInput(e.target.value.replace(/[^0-9]/g, "").slice(0, MAX_QUANTITY_DIGITS))}
        onBlur={commitQuantityInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label="Quantity"
        // Widens with the number of digits, so 5 and 1250 both fit.
        style={{ width: `${Math.max(size === "lg" ? 3 : 2, quantityInput.length) + 1}ch` }}
        className={`min-w-0 bg-transparent text-center font-semibold outline-none tabular-nums ${
          size === "lg" ? "text-base" : "text-[13px]"
        }`}
      />
      <button
        onClick={() => onSetQuantity(Math.min(MAX_QUANTITY, quantity + 1))}
        aria-label="Increase quantity"
        className={`shrink-0 font-bold leading-none ${
          size === "lg" ? "w-10 h-10 text-lg" : "w-7 h-full text-base"
        }`}
      >
        +
      </button>
    </div>
  );
}

export function ProductCard({
  product,
  quantity,
  onAdd,
  onSetQuantity,
  onExpand,
  title,
  imageUrl = product.imageUrl,
  price,
  picker,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  onExpand: () => void;
  /** Card with options (ShopCard): the card's name, photo, price and picker. */
  title?: string;
  imageUrl?: string | null;
  price?: ReactNode;
  picker?: ReactNode;
}) {
  const { t } = useLocale();
  const percentOff = getSalePercentOff(product);
  // Out-of-stock cards fade their image and text but keep the "out of stock"
  // label at full strength, so it's the first thing a buyer reads.
  const fade = !product.inStock ? "opacity-[.55]" : "";
  return (
    <div className="border border-[#eae5dc] rounded-[14px] overflow-hidden flex flex-col bg-white">
      <div
        className={`relative aspect-square flex items-center justify-center overflow-hidden p-2 ${
          imageUrl ? "bg-white" : "bg-[#f2efe9]"
        }`}
      >
        {!product.inStock && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 mx-auto w-fit bg-[#1a1714]/85 text-white text-xs font-bold rounded-full px-3 py-1">
            {t("catalog.outOfStock")}
          </span>
        )}
        {percentOff !== null && (
          <span className="absolute top-1.5 start-1.5 z-10 bg-[#b3402e] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
            -{percentOff}%
          </span>
        )}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedImage(imageUrl, "CARD")}
            alt={title ?? product.name}
            className={`w-full h-full object-contain ${fade}`}
          />
        ) : (
          <PackageIcon className={`w-6 h-6 text-[#c5bdb1] ${fade}`} />
        )}
      </div>

      <div className={`p-[9px] pb-2.5 flex flex-col gap-[5px] flex-1 ${fade}`}>
        <p className="text-xs font-medium text-[#2b2620] line-clamp-2 min-h-[33px] leading-tight">
          {title ?? product.name}
        </p>
        {price ?? <PriceDisplay product={product} />}
        {picker}

        <div className="mt-auto flex items-center gap-1.5">
          <button
            onClick={onExpand}
            className="flex-1 min-w-0 h-9 border border-[var(--secondary)] text-[var(--secondary)] font-semibold rounded-[9px] text-[11px]"
          >
            {t("catalog.details")}
          </button>
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

export function ProductDetailModal({
  product,
  quantity,
  onAdd,
  onSetQuantity,
  onClose,
  options = [],
  onSelectOption,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  onClose: () => void;
  /** The card's options when `product` is one of them (picker shown). */
  options?: Product[];
  onSelectOption?: (product: Product) => void;
}) {
  const hasOptions = options.length > 1;
  const title = hasOptions ? product.variantGroup?.name ?? product.name : product.name;
  const imageUrl = hasOptions ? cardImage(options, product) : product.imageUrl;
  const { t } = useLocale();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Freeze the page behind the window so it can't scroll while open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    // A centered window on every screen size, like checkout. The overlay
    // covers the page, so nothing behind it can be tapped; tapping the
    // overlay itself closes the window.
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#1a1714]/55"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md bg-white rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div
            className={`aspect-square max-h-[45dvh] w-full flex items-center justify-center overflow-hidden p-6 rounded-t-2xl ${
              imageUrl ? "bg-white" : "bg-[#f2efe9]"
            }`}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={optimizedImage(imageUrl, "DETAIL")}
                alt={title}
                className="w-full h-full object-contain"
              />
            ) : (
              <PackageIcon className="w-16 h-16 text-[#c5bdb1]" />
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
          <h2 className="text-lg font-bold text-[#1a1714] mb-1">{title}</h2>
          <div className="mb-2">
            <PriceDisplay product={product} size="lg" />
          </div>
          {(product.categories.length > 0 || product.subcategory) && (
            <p className="text-xs text-[#8a8177] mb-2">
              {product.categories.map((category) => category.name).join(", ")}
              {product.subcategory ? ` · ${product.subcategory.name}` : ""}
            </p>
          )}
          {hasOptions && (
            <div className="mb-3">
              <OptionPicker
                options={options}
                selectedId={product.id}
                onSelect={(id) => {
                  const next = options.find((o) => o.id === id);
                  if (next) onSelectOption?.(next);
                }}
                size="lg"
              />
            </div>
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
