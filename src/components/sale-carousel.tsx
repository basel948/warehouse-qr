"use client";

import { useEffect, useRef, useState } from "react";
import { PackageIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { useCart } from "@/components/storefront-shell";
import { type Product } from "@/components/catalog-ui";
import { withCloudinaryTransform } from "@/lib/cloudinary-url";
import { getSalePercentOff } from "@/lib/effective-price";

const AUTOPLAY_INTERVAL_MS = 4000;
const RESUME_AFTER_INTERACTION_MS = 6000;

export function SaleCarousel({ products }: { products: Product[] }) {
  const { t } = useLocale();
  const { openProductDetail } = useCart();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(0);
  const lastInteractionRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function scrollToIndex(index: number) {
    const scroller = scrollerRef.current;
    const child = scroller?.children[index] as HTMLElement | undefined;
    if (!scroller || !child) return;
    scroller.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  }

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    function handleScroll() {
      const el = scroller!;
      const children = Array.from(el.children) as HTMLElement[];
      let closest = 0;
      let closestDistance = Infinity;
      children.forEach((child, index) => {
        const distance = Math.abs(child.offsetLeft - el.scrollLeft);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index;
        }
      });
      setActiveIndex(closest);
    }

    function markInteraction() {
      lastInteractionRef.current = Date.now();
    }

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    scroller.addEventListener("pointerdown", markInteraction);
    scroller.addEventListener("wheel", markInteraction, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      scroller.removeEventListener("pointerdown", markInteraction);
      scroller.removeEventListener("wheel", markInteraction);
    };
  }, []);

  useEffect(() => {
    if (products.length <= 1) return;
    const timer = setInterval(() => {
      if (Date.now() - lastInteractionRef.current < RESUME_AFTER_INTERACTION_MS) return;
      scrollToIndex((activeIndexRef.current + 1) % products.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [products.length]);

  if (products.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-[#1a1714] mb-3 px-4 sm:px-0">{t("catalog.saleTitle")}</h2>
      <div
        ref={scrollerRef}
        className="flex gap-0 sm:gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 sm:mx-0"
      >
        {products.map((product) => {
          const percentOff = getSalePercentOff(product);
          return (
            <button
              key={product.id}
              onClick={() => openProductDetail(product)}
              className="relative shrink-0 w-full sm:w-[55%] lg:w-[38%] snap-start snap-always text-start bg-white sm:border sm:border-[#eae5dc] sm:rounded-[16px] overflow-hidden sm:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.15)]"
            >
              {percentOff !== null && (
                <span className="absolute top-2.5 start-2.5 z-10 bg-[#b3402e] text-white text-xs font-bold rounded-full px-2.5 py-1">
                  -{percentOff}%
                </span>
              )}
              <div className="aspect-[4/3] flex items-center justify-center bg-[#f2efe9] overflow-hidden">
                {product.saleBannerImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={withCloudinaryTransform(product.saleBannerImageUrl, "q_auto")}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={withCloudinaryTransform(product.imageUrl, "q_auto")}
                    alt={product.name}
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <PackageIcon className="w-10 h-10 text-[#c5bdb1]" />
                )}
              </div>
              <div className="p-4 sm:p-3">
                <p className="text-sm font-medium text-[#2b2620] line-clamp-1 mb-1">{product.name}</p>
                <p className="text-base font-bold flex items-center gap-1.5">
                  <span className="text-[#b3402e]">₪{product.salePrice!.toFixed(2)}</span>
                  <span className="text-[#a39a8e] font-medium line-through text-sm">
                    ₪{product.price.toFixed(2)}
                  </span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {products.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3 sm:hidden">
          {products.map((_, index) => (
            <button
              key={index}
              aria-label={`${index + 1}`}
              onClick={() => {
                lastInteractionRef.current = Date.now();
                scrollToIndex(index);
              }}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-4 bg-[#1a1714]" : "w-1.5 bg-[#e0d9cf]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
