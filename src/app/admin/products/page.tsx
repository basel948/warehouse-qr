"use client";

import { useEffect, useState } from "react";

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
  inStock: boolean;
  categoryId: string | null;
  category: Category | null;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

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
      setCategoryError("Enter a category name.");
      return;
    }

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim(), order: categories.length }),
    });

    if (!res.ok) {
      setCategoryError("Failed to add category (name may already exist).");
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
      setError("Enter a valid name and price.");
      return;
    }

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        price: parsedPrice,
        categoryId: categoryId || undefined,
      }),
    });

    if (!res.ok) {
      setError("Failed to add product.");
      return;
    }

    setName("");
    setDescription("");
    setPrice("");
    setCategoryId("");
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
        <h1 className="text-xl font-bold text-stone-900 mb-4">Categories</h1>

        <form onSubmit={addCategory} className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 border border-stone-300 rounded px-3 py-2"
          />
          <button type="submit" className="bg-amber-600 text-white rounded px-4 py-2">
            Add
          </button>
        </form>
        {categoryError && <p className="text-sm text-red-600 mb-3">{categoryError}</p>}

        <ul className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center gap-2 border border-stone-300 bg-white rounded-full pl-3 pr-1 py-1 text-sm"
            >
              {category.name}
              <button
                onClick={() => deleteCategory(category.id)}
                aria-label={`Delete ${category.name}`}
                className="text-stone-400 hover:text-red-600 rounded-full w-5 h-5 leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h1 className="text-xl font-bold text-stone-900 mb-4">Products</h1>

        <input
          type="search"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-stone-300 bg-white rounded px-3 py-2 mb-4"
        />

        <form onSubmit={addProduct} className="bg-white border border-stone-200 rounded-lg p-4 space-y-2 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 border border-stone-300 rounded px-3 py-2"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-28 border border-stone-300 rounded px-3 py-2"
            />
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-amber-600 text-white rounded px-4 py-2">
            Add product
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {loading ? (
          <p className="text-sm text-stone-500">Loading...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-stone-500">No products yet.</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-stone-500">No products match &ldquo;{searchQuery}&rdquo;.</p>
        ) : (
          <ul className="divide-y divide-stone-200 bg-white border border-stone-200 rounded-lg overflow-hidden">
            {filteredProducts.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-sm text-stone-500">${product.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={product.categoryId ?? ""}
                    onChange={(e) => setProductCategory(product, e.target.value)}
                    className="border border-stone-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="">No category</option>
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
                    {product.inStock ? "Mark out of stock" : "Mark in stock"}
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="text-sm text-red-600 underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
