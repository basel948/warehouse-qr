"use client";

import Link from "next/link";
import { AddToCartControl } from "@/components/catalog-ui";
import { PackageIcon, TrashIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { PageBackLink } from "@/components/page-back-link";
import { useCart } from "@/components/storefront-shell";
import { getEffectivePrice } from "@/lib/effective-price";
import { optimizedImage } from "@/lib/image-url";
import { asProductUnit } from "@/lib/product-unit";

// The buyer's cart: review items, change amounts or remove them, then open
// the payment window from the button at the bottom.
export default function CartPage() {
  const { t } = useLocale();
  const { cart, setQuantity, allProducts, cartTotal, openCheckout } = useCart();

  const lines = (allProducts ?? [])
    .filter((product) => cart[product.id] > 0)
    .map((product) => ({ product, quantity: cart[product.id] }));

  if (!allProducts) {
    return (
      <div>
        <PageBackLink href="/" title={t("cart.title")} />
        <p className="text-sm text-[#8a8177]">{t("cart.loading")}</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div>
        <PageBackLink href="/" title={t("cart.title")} />
        <div className="bg-white border border-[#eae5dc] rounded-[14px] px-5 py-10 text-center">
          <p className="font-semibold text-[#1a1714] mb-1">{t("cart.empty")}</p>
          <p className="text-sm text-[#6b6259] mb-5">{t("cart.emptyHint")}</p>
          <Link
            href="/"
            className="inline-block bg-[var(--accent)] text-white rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            {t("cart.continueShopping")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageBackLink href="/" title={t("cart.title")} />

      <ul className="bg-white border border-[#eae5dc] rounded-[14px] divide-y divide-[#f0ece5]">
        {lines.map(({ product, quantity }) => {
          const unitPrice = getEffectivePrice(product);
          return (
            <li key={product.id} className="flex gap-3 p-3">
              <div className="w-20 h-20 shrink-0 rounded-[10px] border border-[#f0ece5] bg-white flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={optimizedImage(product.imageUrl, "SMALL")}
                    alt=""
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <PackageIcon className="w-7 h-7 text-[#c5bdb1]" />
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1a1714] leading-snug line-clamp-2">{product.name}</p>
                    <p className="text-xs text-[#8a8177] mt-0.5">
                      {t("cart.unitPrice", {
                        price: unitPrice.toFixed(2),
                        per: t(`catalog.perUnit.${asProductUnit(product.unit)}`),
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantity(product.id, 0)}
                    aria-label={t("cart.remove", { name: product.name })}
                    className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[9px] text-[#a39a8e] hover:text-[#b3402e] hover:bg-[#fbf1ef]"
                  >
                    <TrashIcon className="w-[18px] h-[18px]" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <AddToCartControl
                    product={product}
                    quantity={quantity}
                    onAdd={() => setQuantity(product.id, 1)}
                    onSetQuantity={(next) => setQuantity(product.id, next)}
                  />
                  <span className="text-sm font-bold text-[#1a1714]">₪{(unitPrice * quantity).toFixed(2)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Fixed to the bottom of the screen, like the shop's floating cart bar. */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-[#eae5dc] px-4 py-3.5 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.25)]">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <div className="shrink-0">
            <p className="text-xs text-[#8a8177]">{t("cart.subtotal")}</p>
            <p className="text-lg font-bold text-[#1a1714]">₪{cartTotal.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={openCheckout}
            className="flex-1 bg-[var(--accent)] text-white rounded-full py-3.5 font-bold text-base"
          >
            {t("cart.proceedToCheckout")}
          </button>
        </div>
      </div>
    </div>
  );
}
