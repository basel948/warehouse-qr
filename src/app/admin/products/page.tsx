"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import { DuplicateIcon, EditIcon, PackageIcon, TrashIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";

type Category = {
  id: string;
  name: string;
  order: number;
};

type Subcategory = {
  id: string;
  name: string;
  order: number;
  categoryId: string;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
  categories: Category[];
  subcategoryId: string | null;
  subcategory: Subcategory | null;
};

function CategoryMultiSelect({
  categories,
  selectedIds,
  onChange,
  placeholder,
}: {
  categories: Category[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id]
    );
  }

  const label =
    selectedIds.length === 0
      ? placeholder
      : categories
          .filter((category) => selectedIds.includes(category.id))
          .map((category) => category.name)
          .join(", ");

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-white text-start truncate"
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[180px] max-h-56 overflow-y-auto bg-white border border-[#e6e0d6] rounded-[10px] shadow-lg p-1.5 space-y-0.5">
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] hover:bg-[#f7f5f1] text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(category.id)}
                onChange={() => toggle(category.id)}
              />
              {category.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [subcategoryId, setSubcategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [subcatManagerCategoryId, setSubcatManagerCategoryId] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [subcategoryError, setSubcategoryError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [productsRes, categoriesRes, subcategoriesRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/categories"),
      fetch("/api/subcategories"),
    ]);
    const [productsData, categoriesData, subcategoriesData] = await Promise.all([
      productsRes.json(),
      categoriesRes.json(),
      subcategoriesRes.json(),
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
    setSubcategories(subcategoriesData);
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

  const subcategoriesForManager = subcategories.filter(
    (subcategory) => subcategory.categoryId === subcatManagerCategoryId
  );

  async function addSubcategory(e: React.FormEvent) {
    e.preventDefault();
    setSubcategoryError(null);

    if (!subcatManagerCategoryId) {
      setSubcategoryError(t("admin.products.subcategoryCategoryRequired"));
      return;
    }
    if (!newSubcategoryName.trim()) {
      setSubcategoryError(t("admin.products.subcategoryNameRequired"));
      return;
    }

    const res = await fetch("/api/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newSubcategoryName.trim(),
        categoryId: subcatManagerCategoryId,
        order: subcategoriesForManager.length,
      }),
    });

    if (!res.ok) {
      setSubcategoryError(t("admin.products.subcategoryError"));
      return;
    }

    setNewSubcategoryName("");
    loadAll();
  }

  async function deleteSubcategory(id: string) {
    await fetch(`/api/subcategories/${id}`, { method: "DELETE" });
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
        categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        subcategoryId: subcategoryId || undefined,
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
    setCategoryIds([]);
    setSubcategoryId("");
    loadAll();
  }

  async function duplicateProduct(product: Product) {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: t("admin.products.duplicateName", { name: product.name }),
        description: product.description || undefined,
        price: product.price,
        imageUrl: product.imageUrl || undefined,
        inStock: product.inStock,
        categoryIds: product.categories.map((category) => category.id),
        subcategoryId: product.subcategoryId || undefined,
      }),
    });

    if (!res.ok) return;
    const newProduct: Product = await res.json();
    await loadAll();
    startEdit(newProduct);
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

  async function setProductCategories(product: Product, newCategoryIds: string[]) {
    // A subcategory only makes sense under the category it was created for,
    // so drop it if it no longer belongs to any of the product's categories.
    const subcategoryStillValid = subcategories.some(
      (subcategory) =>
        subcategory.id === product.subcategoryId && newCategoryIds.includes(subcategory.categoryId)
    );
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryIds: newCategoryIds,
        ...(subcategoryStillValid ? {} : { subcategoryId: null }),
      }),
    });
    loadAll();
  }

  async function setProductSubcategory(product: Product, newSubcategoryId: string) {
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subcategoryId: newSubcategoryId || null }),
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
          {t("admin.products.subcategoriesTitle")}
        </h1>

        <select
          value={subcatManagerCategoryId}
          onChange={(e) => setSubcatManagerCategoryId(e.target.value)}
          className="border border-[#e6e0d6] bg-white rounded-[10px] px-3.5 py-2.5 mb-3 w-full sm:w-auto"
        >
          <option value="">{t("admin.products.subcategoryManagerPlaceholder")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {subcatManagerCategoryId && (
          <>
            <form onSubmit={addSubcategory} className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder={t("admin.products.newSubcategoryPlaceholder")}
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                className="flex-1 border border-[#e6e0d6] bg-white rounded-[10px] px-3.5 py-2.5"
              />
              <button
                type="submit"
                className="bg-[var(--accent)] text-white rounded-[10px] px-4 py-2.5 text-sm font-semibold"
              >
                {t("admin.products.add")}
              </button>
            </form>
            {subcategoryError && <p className="text-sm text-[#b3402e] mb-3">{subcategoryError}</p>}

            <ul className="flex flex-wrap gap-2">
              {subcategoriesForManager.map((subcategory) => (
                <li
                  key={subcategory.id}
                  className="flex items-center gap-2 border border-[#e6e0d6] bg-white rounded-full ps-3.5 pe-1.5 py-1.5 text-[13px]"
                >
                  {subcategory.name}
                  <button
                    onClick={() => deleteSubcategory(subcategory.id)}
                    aria-label={t("admin.products.deleteCategoryAria", { name: subcategory.name })}
                    className="text-[#a39a8e] hover:text-[#b3402e] rounded-full w-5 h-5 leading-none"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
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
            <CategoryMultiSelect
              categories={categories}
              selectedIds={categoryIds}
              onChange={(ids) => {
                setCategoryIds(ids);
                if (!subcategories.some((s) => s.id === subcategoryId && ids.includes(s.categoryId))) {
                  setSubcategoryId("");
                }
              }}
              placeholder={t("admin.products.noCategoryOption")}
            />
            <input
              type="number"
              step="0.01"
              placeholder={t("admin.products.pricePlaceholder")}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
            />
          </div>
          {categoryIds.length > 0 && subcategories.some((s) => categoryIds.includes(s.categoryId)) && (
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="w-full border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
            >
              <option value="">{t("admin.products.noSubcategoryOption")}</option>
              {subcategories
                .filter((s) => categoryIds.includes(s.categoryId))
                .map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
            </select>
          )}
          <input
            type="text"
            placeholder={t("admin.products.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
          />
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
            <div className="hidden sm:grid grid-cols-[1fr_140px_140px_100px_150px] gap-4 px-[18px] py-[11px] bg-[#faf8f5] border-b border-[#eae5dc] text-xs font-semibold text-[#8a8177]">
              <span>{t("admin.products.colProduct")}</span>
              <span>{t("admin.products.colCategory")}</span>
              <span>{t("admin.products.colSubcategory")}</span>
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
                      <input
                        type="text"
                        placeholder={t("admin.products.descriptionPlaceholder")}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
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
                    className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_100px_150px] gap-2 sm:gap-4 items-center px-[18px] py-3.5 text-sm"
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
                          className="w-[38px] h-[38px] shrink-0 rounded-[9px] bg-[#f2efe9] flex items-center justify-center text-[#c5bdb1]"
                          aria-hidden
                        >
                          <PackageIcon className="w-4 h-4" />
                        </div>
                      )}
                      <span className="text-[#1a1714] truncate">{product.name}</span>
                    </div>
                    <CategoryMultiSelect
                      categories={categories}
                      selectedIds={product.categories.map((category) => category.id)}
                      onChange={(ids) => setProductCategories(product, ids)}
                      placeholder={t("admin.products.noCategoryOption")}
                    />
                    <select
                      value={product.subcategoryId ?? ""}
                      onChange={(e) => setProductSubcategory(product, e.target.value)}
                      disabled={product.categories.length === 0}
                      className="border border-[#e6e0d6] rounded-[9px] px-2.5 py-1.5 text-sm bg-white disabled:opacity-50"
                    >
                      <option value="">{t("admin.products.noSubcategoryOption")}</option>
                      {subcategories
                        .filter((s) => product.categories.some((category) => category.id === s.categoryId))
                        .map((subcategory) => (
                          <option key={subcategory.id} value={subcategory.id}>
                            {subcategory.name}
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
                        title={
                          product.inStock
                            ? t("admin.products.markOutOfStock")
                            : t("admin.products.markInStock")
                        }
                        aria-label={
                          product.inStock
                            ? t("admin.products.markOutOfStock")
                            : t("admin.products.markInStock")
                        }
                        className={`w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#e6e0d6] ${
                          product.inStock ? "text-[#2f6b3a]" : "text-[#8a8177]"
                        }`}
                      >
                        <PackageIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startEdit(product)}
                        title={t("admin.products.edit")}
                        aria-label={t("admin.products.edit")}
                        className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#e6e0d6] text-[#6b6259]"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => duplicateProduct(product)}
                        title={t("admin.products.duplicate")}
                        aria-label={t("admin.products.duplicate")}
                        className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#e6e0d6] text-[#6b6259]"
                      >
                        <DuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        title={t("admin.products.delete")}
                        aria-label={t("admin.products.delete")}
                        className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#e6e0d6] text-[#b3402e]"
                      >
                        <TrashIcon className="w-4 h-4" />
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
