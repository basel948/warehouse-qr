"use client";

import { useEffect, useState } from "react";
import { PackageIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { withCloudinaryTransform } from "@/lib/cloudinary-url";
import { getSalePercentOff } from "@/lib/effective-price";

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
};

function PriceDisplay({ product, size = "sm" }: { product: Product; size?: "sm" | "lg" }) {
  const isOnSale = product.onSale && product.salePrice != null;
  const priceClass = size === "lg" ? "text-xl font-bold" : "text-sm font-bold";
  if (!isOnSale) {
    return <p className={`${priceClass} text-[#1a1714]`}>₪{product.price.toFixed(2)}</p>;
  }
  return (
    <p className={`${priceClass} flex items-center gap-1.5 flex-wrap`}>
      <span className="text-[#b3402e]">₪{product.salePrice!.toFixed(2)}</span>
      <span className="text-[#a39a8e] font-medium line-through text-[0.85em]">
        ₪{product.price.toFixed(2)}
      </span>
    </p>
  );
}

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
    const clamped = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
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
          : "shrink-0 w-[104px] h-9 bg-white border border-[var(--accent)] text-[var(--accent)]"
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
        onChange={(e) => setQuantityInput(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commitQuantityInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label="Quantity"
        className={`min-w-0 bg-transparent text-center font-semibold outline-none ${
          size === "lg" ? "w-12 text-base" : "w-7 text-[13px]"
        }`}
      />
      <button
        onClick={() => onSetQuantity(quantity + 1)}
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
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  onExpand: () => void;
}) {
  const { t } = useLocale();
  const percentOff = getSalePercentOff(product);
  return (
    <div
      className={`border border-[#eae5dc] rounded-[14px] overflow-hidden flex flex-col bg-white ${
        !product.inStock ? "opacity-[.55]" : ""
      }`}
    >
      <div
        className={`relative aspect-square flex items-center justify-center overflow-hidden p-2 ${
          product.imageUrl ? "bg-white" : "bg-[#f2efe9]"
        }`}
      >
        {percentOff !== null && (
          <span className="absolute top-1.5 start-1.5 z-10 bg-[#b3402e] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
            -{percentOff}%
          </span>
        )}
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withCloudinaryTransform(product.imageUrl, "q_auto")}
            alt={product.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <PackageIcon className="w-6 h-6 text-[#c5bdb1]" />
        )}
      </div>

      <div className="p-[9px] pb-2.5 flex flex-col gap-[5px] flex-1">
        <p className="text-xs font-medium text-[#2b2620] line-clamp-2 min-h-[33px] leading-tight">
          {product.name}
        </p>
        <PriceDisplay product={product} />

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
          <h2 className="text-lg font-bold text-[#1a1714] mb-1">{product.name}</h2>
          <div className="mb-2">
            <PriceDisplay product={product} size="lg" />
          </div>
          {(product.categories.length > 0 || product.subcategory) && (
            <p className="text-xs text-[#8a8177] mb-2">
              {product.categories.map((category) => category.name).join(", ")}
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
