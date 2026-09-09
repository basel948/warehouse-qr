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
    setCategoryId("");
    loadAll();
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditName(product.name);
    setEditDescription(product.description ?? "");
    setEditPrice(String(product.price));
    setEditImageUrl(product.imageUrl ?? "");
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
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-stone-900 mb-4">
          {t("admin.products.categoriesTitle")}
        </h1>

        <form onSubmit={addCategory} className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder={t("admin.products.newCategoryPlaceholder")}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 border border-stone-300 rounded px-3 py-2"
          />
          <button type="submit" className="bg-amber-600 text-white rounded px-4 py-2">
            {t("admin.products.add")}
          </button>
        </form>
        {categoryError && <p className="text-sm text-red-600 mb-3">{categoryError}</p>}

        <ul className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center gap-2 border border-stone-300 bg-white rounded-full ps-3 pe-1 py-1 text-sm"
            >
              {category.name}
              <button
                onClick={() => deleteCategory(category.id)}
                aria-label={t("admin.products.deleteCategoryAria", { name: category.name })}
                className="text-stone-400 hover:text-red-600 rounded-full w-5 h-5 leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h1 className="text-xl font-bold text-stone-900 mb-4">
          {t("admin.products.productsTitle")}
        </h1>

        <input
          type="search"
          placeholder={t("admin.products.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-stone-300 bg-white rounded px-3 py-2 mb-4"
        />

        <form onSubmit={addProduct} className="bg-white border border-stone-200 rounded-lg p-4 space-y-2 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("admin.products.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 border border-stone-300 rounded px-3 py-2"
            />
            <input
              type="number"
              step="0.01"
              placeholder={t("admin.products.pricePlaceholder")}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-28 border border-stone-300 rounded px-3 py-2"
            />
          </div>
          <input
            type="text"
            placeholder={t("admin.products.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2"
          />
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
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2"
          >
            <option value="">{t("admin.products.noCategoryOption")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-amber-600 text-white rounded px-4 py-2">
            {t("admin.products.addProduct")}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {loading ? (
          <p className="text-sm text-stone-500">{t("admin.products.loading")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-stone-500">{t("admin.products.noProductsYet")}</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-stone-500">
            {t("admin.products.noProductsMatch", { query: searchQuery })}
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 bg-white border border-stone-200 rounded-lg overflow-hidden">
            {filteredProducts.map((product) =>
              editingId === product.id ? (
                <li key={product.id} className="p-4">
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
                        className="flex-1 border border-stone-300 rounded px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder={t("admin.products.pricePlaceholder")}
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-24 border border-stone-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder={t("admin.products.descriptionPlaceholder")}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full border border-stone-300 rounded px-3 py-2 text-sm"
                    />
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
                        className="bg-amber-600 text-white text-sm rounded px-3 py-1.5"
                      >
                        {t("admin.products.save")}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-sm text-stone-600 underline"
                      >
                        {t("admin.products.cancel")}
                      </button>
                    </div>
                    {editError && <p className="text-sm text-red-600">{editError}</p>}
                  </form>
                </li>
              ) : (
                <li key={product.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="w-10 h-10 object-cover rounded border border-stone-200 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 shrink-0 rounded border border-dashed border-stone-300 flex items-center justify-center text-stone-300 text-sm"
                        aria-hidden
                      >
                        📦
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-sm text-stone-500">₪{product.price.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <select
                      value={product.categoryId ?? ""}
                      onChange={(e) => setProductCategory(product, e.target.value)}
                      className="border border-stone-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="">{t("admin.products.noCategoryOption")}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => toggleStock(product)}
                      className="text-sm text-stone-600 underline"
                    >
                      {product.inStock
                        ? t("admin.products.markOutOfStock")
                        : t("admin.products.markInStock")}
                    </button>
                    <button
                      onClick={() => startEdit(product)}
                      className="text-sm text-stone-600 underline"
                    >
                      {t("admin.products.edit")}
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="text-sm text-red-600 underline"
                    >
                      {t("admin.products.delete")}
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
