"use client";

import { useEffect, useState } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
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
  brand: string | null;
  inStock: boolean;
  categoryId: string | null;
  category: Category | null;
};

export default function AdminProductsPage() {
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [productsRes, categoriesRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/categories"),
    ]);
    const [productsData, categoriesData] = await Promise.all([
      productsRes.json(),
      categoriesRes.json(),
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setCategoryError(null);

    if (!newCategoryName.trim()) {
      setCategoryError(t("admin.products.categoryNameRequired"));
      return;
    }

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim(), order: categories.length }),
    });

    if (!res.ok) {
      setCategoryError(t("admin.products.categoryError"));
      return;
    }

    setNewCategoryName("");
    loadAll();
  }

  async function deleteCategory(id: string) {
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedPrice = Number(price);
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError(t("admin.products.invalidProduct"));
      return;
    }

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        price: parsedPrice,
        imageUrl: imageUrl || undefined,
        brand: brand || undefined,
        categoryId: categoryId || undefined,
      }),
    });

    if (!res.ok) {
      setError(t("admin.products.addProductFailed"));
      return;
    }

    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setBrand("");
    setCategoryId("");
    loadAll();
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditName(product.name);
    setEditDescription(product.description ?? "");
    setEditPrice(String(product.price));
    setEditImageUrl(product.imageUrl ?? "");
    setEditBrand(product.brand ?? "");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(productId: string) {
    setEditError(null);

    const parsedPrice = Number(editPrice);
    if (!editName.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setEditError(t("admin.products.invalidProduct"));
      return;
    }

    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        description: editDescription || undefined,
        price: parsedPrice,
        imageUrl: editImageUrl || undefined,
        brand: editBrand || null,
      }),
    });

    if (!res.ok) {
      setEditError(t("admin.products.editProductFailed"));
      return;
    }

    setEditingId(null);
    loadAll();
  }

  async function setProductCategory(product: Product, newCategoryId: string) {
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: newCategoryId || null }),
    });
    loadAll();
  }

  async function toggleStock(product: Product) {
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inStock: !product.inStock }),
    });
    loadAll();
  }

  async function deleteProduct(id: string) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    loadAll();
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-[22px]">
      <div>
        <h1 className="text-xl font-bold text-[#1a1714] mb-4">
          {t("admin.products.categoriesTitle")}
        </h1>

        <form onSubmit={addCategory} className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder={t("admin.products.newCategoryPlaceholder")}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 border border-[#e6e0d6] bg-white rounded-[10px] px-3.5 py-2.5"
          />
          <button
            type="submit"
            className="bg-[var(--accent)] text-white rounded-[10px] px-4 py-2.5 text-sm font-semibold"
          >
            {t("admin.products.add")}
          </button>
        </form>
        {categoryError && <p className="text-sm text-[#b3402e] mb-3">{categoryError}</p>}

        <ul className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center gap-2 border border-[#e6e0d6] bg-white rounded-full ps-3.5 pe-1.5 py-1.5 text-[13px]"
            >
              {category.name}
              <button
                onClick={() => deleteCategory(category.id)}
                aria-label={t("admin.products.deleteCategoryAria", { name: category.name })}
                className="text-[#a39a8e] hover:text-[#b3402e] rounded-full w-5 h-5 leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h1 className="text-xl font-bold text-[#1a1714] mb-4">
          {t("admin.products.productsTitle")}
        </h1>

        <input
          type="search"
          placeholder={t("admin.products.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-[#e6e0d6] bg-white rounded-[10px] px-3.5 py-2.5 mb-4"
        />

        <form
          onSubmit={addProduct}
          className="bg-white border border-[#eae5dc] rounded-[14px] p-[18px] space-y-2.5 mb-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_130px] gap-2.5">
            <input
              type="text"
              placeholder={t("admin.products.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
            >
              <option value="">{t("admin.products.noCategoryOption")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder={t("admin.products.pricePlaceholder")}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2.5">
            <input
              type="text"
              placeholder={t("admin.products.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
            />
            <input
              type="text"
              placeholder={t("admin.products.brandPlaceholder")}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
            />
          </div>
          <div className="flex items-center gap-3.5 flex-wrap">
            <ImageUploadField
              value={imageUrl}
              onChange={setImageUrl}
              uploadLabel={t("admin.products.uploadImage")}
              uploadingLabel={t("admin.products.uploading")}
              hintText={t("admin.products.uploadHint")}
              errorMessages={{
                notImage: t("admin.products.uploadErrorNotImage"),
                tooLarge: t("admin.products.uploadErrorTooLarge"),
                network: t("admin.products.uploadErrorNetwork"),
                generic: t("admin.products.uploadErrorGeneric"),
              }}
            />
            <button
              type="submit"
              className="ms-auto bg-[var(--accent)] text-white rounded-[10px] px-5 py-2.5 text-sm font-semibold"
            >
              {t("admin.products.addProduct")}
            </button>
          </div>
          {error && <p className="text-sm text-[#b3402e]">{error}</p>}
        </form>

        {loading ? (
          <p className="text-sm text-[#8a8177]">{t("admin.products.loading")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-[#8a8177]">{t("admin.products.noProductsYet")}</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-[#8a8177]">
            {t("admin.products.noProductsMatch", { query: searchQuery })}
          </p>
        ) : (
          <div className="bg-white border border-[#eae5dc] rounded-[14px] overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_150px_110px_150px] gap-4 px-[18px] py-[11px] bg-[#faf8f5] border-b border-[#eae5dc] text-xs font-semibold text-[#8a8177]">
              <span>{t("admin.products.colProduct")}</span>
              <span>{t("admin.products.colCategory")}</span>
              <span>{t("admin.products.colPrice")}</span>
              <span />
            </div>
            <ul className="divide-y divide-[#f2efe9]">
              {filteredProducts.map((product) =>
                editingId === product.id ? (
                  <li key={product.id} className="p-[18px] bg-[#fdfaf4]">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveEdit(product.id);
                      }}
                      className="space-y-2"
                    >
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t("admin.products.namePlaceholder")}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder={t("admin.products.pricePlaceholder")}
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t("admin.products.descriptionPlaceholder")}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="flex-1 border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                        />
                        <input
                          type="text"
                          placeholder={t("admin.products.brandPlaceholder")}
                          value={editBrand}
                          onChange={(e) => setEditBrand(e.target.value)}
                          className="w-40 border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                        />
                      </div>
                      <ImageUploadField
                        value={editImageUrl}
                        onChange={setEditImageUrl}
                        uploadLabel={t("admin.products.uploadImage")}
                        uploadingLabel={t("admin.products.uploading")}
                        hintText={t("admin.products.uploadHint")}
                        errorMessages={{
                          notImage: t("admin.products.uploadErrorNotImage"),
                          tooLarge: t("admin.products.uploadErrorTooLarge"),
                          network: t("admin.products.uploadErrorNetwork"),
                          generic: t("admin.products.uploadErrorGeneric"),
                        }}
                      />
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="bg-[#1a1714] text-white text-sm font-semibold rounded-[9px] px-3.5 py-2"
                        >
                          {t("admin.products.save")}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-sm text-[#6b6259]"
                        >
                          {t("admin.products.cancel")}
                        </button>
                      </div>
                      {editError && <p className="text-sm text-[#b3402e]">{editError}</p>}
                    </form>
                  </li>
                ) : (
                  <li
                    key={product.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_150px_110px_150px] gap-2 sm:gap-4 items-center px-[18px] py-3.5 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="w-[38px] h-[38px] object-cover rounded-[9px] border border-[#eae5dc] shrink-0"
                        />
                      ) : (
                        <div
                          className="w-[38px] h-[38px] shrink-0 rounded-[9px] bg-[#f2efe9] flex items-center justify-center text-[#c5bdb1] text-xs"
                          aria-hidden
                        >
                          📦
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="block text-[#1a1714] truncate">{product.name}</span>
                        {product.brand && (
                          <span className="block text-xs text-[#a39a8e] truncate">{product.brand}</span>
                        )}
                      </div>
                    </div>
                    <select
                      value={product.categoryId ?? ""}
                      onChange={(e) => setProductCategory(product, e.target.value)}
                      className="border border-[#e6e0d6] rounded-[9px] px-2.5 py-1.5 text-sm bg-white"
                    >
                      <option value="">{t("admin.products.noCategoryOption")}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-[#1a1714] font-semibold">₪{product.price.toFixed(2)}</span>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                          product.inStock
                            ? "bg-[#f1f7f1] text-[#2f6b3a]"
                            : "bg-[#f2efe9] text-[#6b6259]"
                        }`}
                      >
                        {product.inStock
                          ? t("admin.products.inStockLabel")
                          : t("admin.products.outOfStockLabel")}
                      </span>
                      <button
                        onClick={() => toggleStock(product)}
                        className="text-[13px] text-[#6b6259] underline"
                      >
                        {product.inStock
                          ? t("admin.products.markOutOfStock")
                          : t("admin.products.markInStock")}
                      </button>
                      <button
                        onClick={() => startEdit(product)}
                        className="text-[13px] text-[#6b6259] underline"
                      >
                        {t("admin.products.edit")}
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="text-[13px] text-[#b3402e] underline"
                      >
                        {t("admin.products.delete")}
                      </button>
                    </div>
                  </li>
                )
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
