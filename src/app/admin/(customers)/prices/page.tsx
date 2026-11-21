"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PackageIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { optimizedImage } from "@/lib/image-url";
import { asProductUnit } from "@/lib/product-unit";

type CustomerType = { id: string; name: string };
type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  imageUrl: string | null;
  categories: Category[];
  variantGroup: { id: string; name: string } | null;
  variantLabel: string | null;
  typePrices: { customerTypeId: string; price: number }[];
};

// Price lists: pick a customer type, then type each product's price for it.
// Empty = the product's base price. Each field saves when it loses focus.
export default function AdminPricesPage() {
  const { t } = useLocale();
  const toast = useToast();
  const [types, setTypes] = useState<CustomerType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeId, setTypeId] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // What's typed in each product's field, for the selected type.
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [invalidId, setInvalidId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/customer-types").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([typesData, productsData, categoriesData]) => {
      setTypes(typesData);
      setProducts(productsData);
      setCategories(categoriesData);
      if (typesData.length > 0) setTypeId(typesData[0].id);
      setLoading(false);
    });
  }, []);

  function savedPrice(product: Product): number | null {
    return product.typePrices.find((p) => p.customerTypeId === typeId)?.price ?? null;
  }

  // Fill the fields from the saved prices whenever the type changes.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const product of products) {
      const price = product.typePrices.find((p) => p.customerTypeId === typeId)?.price;
      next[product.id] = price != null ? String(price) : "";
    }
    setInputs(next);
    setInvalidId(null);
    // Only on type change / first load; saving updates `products` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, products.length]);

  async function save(product: Product) {
    const raw = (inputs[product.id] ?? "").trim();
    const price = raw === "" ? null : Number(raw);
    if (price != null && (!Number.isFinite(price) || price <= 0)) {
      setInvalidId(product.id);
      toast(t("admin.prices.invalidPrice"), "error");
      return;
    }
    setInvalidId(null);
    if (price === savedPrice(product)) return;

    const res = await fetch(`/api/customer-types/${typeId}/prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, price }),
    });
    if (!res.ok) {
      toast(t("admin.prices.saveFailed"), "error");
      return;
    }
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== product.id) return p;
        const others = p.typePrices.filter((tp) => tp.customerTypeId !== typeId);
        return { ...p, typePrices: price == null ? others : [...others, { customerTypeId: typeId, price }] };
      })
    );
    toast(price == null ? t("admin.prices.toastCleared") : t("admin.prices.toastSaved"));
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !categoryId || p.categories.some((c) => c.id === categoryId))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.variantGroup?.name.toLowerCase().includes(q) ?? false)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [products, query, categoryId]);

  const selectedType = types.find((type) => type.id === typeId);
  const setCount = products.filter((p) => p.typePrices.some((tp) => tp.customerTypeId === typeId)).length;

  if (loading) {
    return <p className="mx-auto max-w-3xl px-4 py-4 text-sm text-[#8a8177]">{t("admin.prices.loading")}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <p className="text-[13px] text-[#6b6259] mb-4">{t("admin.prices.hint")}</p>

      {types.length === 0 ? (
        <div className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px]">
          <p className="text-sm text-[#4a443c] mb-3">{t("admin.prices.noTypes")}</p>
          <Link
            href="/admin/customers"
            className="inline-block bg-[var(--accent)] text-white rounded-[10px] px-5 py-2.5 text-sm font-semibold"
          >
            {t("admin.prices.goToCustomers")}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {types.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setTypeId(type.id)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold border ${
                  type.id === typeId
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-white text-[#4a443c] border-[#e6e0d6]"
                }`}
              >
                {type.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="search"
              placeholder={t("admin.prices.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-white text-sm placeholder:text-[#a39a8e]"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="sm:w-48 border border-[#e6e0d6] rounded-[10px] px-3 py-2.5 bg-white text-sm"
            >
              <option value="">{t("admin.prices.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          {selectedType && (
            <p className="text-xs text-[#8a8177] mb-3">
              {t("admin.prices.setCount", { set: setCount, total: products.length, name: selectedType.name })}
            </p>
          )}

          {visible.length === 0 ? (
            <p className="text-sm text-[#8a8177]">{t("admin.prices.noProducts")}</p>
          ) : (
            <ul className="divide-y divide-[#f2efe9] bg-white border border-[#eae5dc] rounded-[14px] overflow-hidden">
              {visible.map((product) => (
                <li key={product.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-[12px] border border-[#f0ece5] bg-white flex items-center justify-center overflow-hidden">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={optimizedImage(product.imageUrl, "SMALL")}
                        alt=""
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <PackageIcon className="w-8 h-8 text-[#c5bdb1]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-[#1a1714] leading-snug line-clamp-2 mb-1">{product.name}</p>
                    <p className="text-[13px] text-[#8a8177]">
                      {t("admin.prices.basePrice", { price: product.price.toFixed(2) })} /{" "}
                      {t(`catalog.unitName.${asProductUnit(product.unit)}`)}
                    </p>
                  </div>
                  <div className="relative w-[110px] shrink-0">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-base text-[#a39a8e]">₪</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder={product.price.toFixed(2)}
                      value={inputs[product.id] ?? ""}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [product.id]: e.target.value }))}
                      onBlur={() => save(product)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      aria-label={product.name}
                      className={`w-full border rounded-[10px] ps-7 pe-2.5 py-3 text-base font-semibold bg-white tabular-nums placeholder:text-[#c5bdb1] placeholder:font-normal ${
                        invalidId === product.id ? "border-[#b3402e]" : "border-[#e6e0d6]"
                      }`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
