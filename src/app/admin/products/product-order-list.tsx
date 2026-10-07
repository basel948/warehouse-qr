"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripIcon, PackageIcon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { optimizedImage } from "@/lib/image-url";

type OrderProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  inStock: boolean;
  sortOrder: number;
  categories: { id: string }[];
  subcategoryId: string | null;
};

type OrderCategory = { id: string; name: string };
type OrderSubcategory = { id: string; name: string; categoryId: string };

// "Arrange products": pick a category, then drag its products into the order
// buyers see on that category's page. Grouped by subcategory exactly like the
// shop page (subcategories in their own order, products without one last), and
// each group is reordered on its own. Saves as soon as a product is dropped.
// Products can also be ticked and then marked out of / back in stock or
// deleted together (one confirmation for the whole batch).
export function ProductOrderSection({
  categories,
  subcategories,
  products,
  onSaved,
}: {
  categories: OrderCategory[];
  subcategories: OrderSubcategory[];
  products: OrderProduct[];
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Local order while a save is in flight, so the list doesn't jump back.
  const [override, setOverride] = useState<Record<string, number>>({});

  const position = (p: OrderProduct) => override[p.id] ?? p.sortOrder;
  const inCategory = products
    .filter((p) => p.categories.some((c) => c.id === categoryId))
    .sort((a, b) => position(a) - position(b) || a.name.localeCompare(b.name, "he"));

  const groups = [
    ...subcategories
      .filter((s) => s.categoryId === categoryId)
      .map((s) => ({ id: s.id, name: s.name, items: inCategory.filter((p) => p.subcategoryId === s.id) })),
    {
      id: "other",
      name: t("catalog.otherCategory"),
      items: inCategory.filter(
        (p) => !p.subcategoryId || !subcategories.some((s) => s.id === p.subcategoryId && s.categoryId === categoryId)
      ),
    },
  ].filter((g) => g.items.length > 0);

  // Only ticked products still in this category count (one may have been
  // deleted or moved meanwhile).
  const selectedHere = inCategory.filter((p) => selected.has(p.id));
  const allSelected = inCategory.length > 0 && selectedHere.length === inCategory.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: "outOfStock" | "inStock" | "delete") {
    const count = selectedHere.length;
    if (count === 0) return;
    const texts = {
      outOfStock: ["bulkOutOfStockTitle", "bulkOutOfStockBody", "markOutOfStock", "normal"],
      inStock: ["bulkInStockTitle", "bulkInStockBody", "markInStock", "normal"],
      delete: ["bulkDeleteTitle", "bulkDeleteBody", "delete", "danger"],
    } as const;
    const [title, body, button, tone] = texts[action];
    const ok = await confirm({
      title: t(`admin.confirmDialog.${title}`, { count }),
      message: t(`admin.confirmDialog.${body}`),
      confirmLabel: t(`admin.confirmDialog.${button}`),
      tone,
    });
    if (!ok) return;

    setBulkBusy(true);
    const res = await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: selectedHere.map((p) => p.id), action }),
    }).catch(() => null);
    setBulkBusy(false);
    if (!res?.ok) {
      toast(t("admin.products.toastFailed"), "error");
      return;
    }
    const { updated, skipped } = (await res.json()) as { updated: number; skipped: number };
    setSelected(new Set());
    onSaved();
    if (action === "delete") {
      toast(
        skipped > 0
          ? t("admin.products.bulkDeletedSkipped", { count: updated, skipped })
          : t("admin.products.bulkDeleted", { count: updated }),
        skipped > 0 && updated === 0 ? "error" : "success"
      );
    } else {
      toast(t("admin.products.bulkUpdated", { count: updated }));
    }
  }

  async function saveGroup(reordered: OrderProduct[]) {
    // Hand the group's own positions back out in the new order (mirrors the API).
    const slots = reordered.map(position).sort((a, b) => a - b);
    setOverride((prev) => ({ ...prev, ...Object.fromEntries(reordered.map((p, i) => [p.id, slots.at(i) ?? 0])) }));
    const res = await fetch("/api/products/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: reordered.map((p) => p.id) }),
    }).catch(() => null);
    if (!res?.ok) {
      setOverride({});
      toast(t("admin.products.toastFailed"), "error");
      return;
    }
    onSaved();
    toast(t("admin.products.arrangeSaved"));
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1a1714] mb-1">{t("admin.products.arrangeTitle")}</h1>
      <p className="text-[13px] text-[#8a8177] mb-3">{t("admin.products.arrangeHint")}</p>

      <select
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setOverride({});
          setSelected(new Set());
        }}
        className="border border-[#e6e0d6] bg-white rounded-[10px] px-3.5 py-2.5 mb-3 w-full sm:w-auto"
      >
        <option value="">{t("admin.products.arrangePickCategory")}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      {inCategory.length > 0 && (
        <label className="flex items-center gap-2 text-[13px] font-medium text-[#4a443c] mb-2 w-fit">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(inCategory.map((p) => p.id)))}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          {t("admin.products.bulkSelectAll", { count: inCategory.length })}
        </label>
      )}

      {categoryId && groups.length === 0 && (
        <p className="text-sm text-[#8a8177]">{t("admin.products.arrangeEmpty")}</p>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id}>
            {groups.length > 1 && (
              <p className="text-[13px] font-semibold text-[#6b6259] mb-1.5">{group.name}</p>
            )}
            <SortableProducts items={group.items} onReorder={saveGroup} selected={selected} onToggle={toggle} />
          </div>
        ))}
      </div>

      {selectedHere.length > 0 && (
        // Pinned to the bottom of the screen while scrolling a long list.
        <div className="sticky bottom-3 z-10 mt-3 bg-[#1a1714] text-white rounded-[12px] shadow-lg px-3.5 py-2.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold me-auto">
            {t("admin.products.bulkSelected", { count: selectedHere.length })}
          </span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => runBulk("outOfStock")}
            className="text-[13px] font-semibold rounded-[8px] bg-white/10 px-3 py-1.5 disabled:opacity-50"
          >
            {t("admin.products.markOutOfStock")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => runBulk("inStock")}
            className="text-[13px] font-semibold rounded-[8px] bg-white/10 px-3 py-1.5 disabled:opacity-50"
          >
            {t("admin.products.markInStock")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => runBulk("delete")}
            className="text-[13px] font-semibold rounded-[8px] bg-[#b3402e] px-3 py-1.5 disabled:opacity-50"
          >
            {t("admin.products.delete")}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[13px] font-medium text-white/70 px-1.5 py-1.5"
          >
            {t("admin.products.bulkClear")}
          </button>
        </div>
      )}
    </div>
  );
}

function SortableProducts({
  items,
  onReorder,
  selected,
  onToggle,
}: {
  items: OrderProduct[];
  onReorder: (reordered: OrderProduct[]) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  // Same feel as the category list: press-and-hold on touch, drag on mouse.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((p) => p.id === active.id);
    const to = items.findIndex((p) => p.id === over.id);
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {items.map((product, index) => (
            <SortableProductRow
              key={product.id}
              product={product}
              position={index + 1}
              checked={selected.has(product.id)}
              onToggle={() => onToggle(product.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableProductRow({
  product,
  position,
  checked,
  onToggle,
}: {
  product: OrderProduct;
  position: number;
  checked: boolean;
  onToggle: () => void;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  // Hold anywhere on the row to drag; keyboard dragging only from the grip.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...pointerListeners}
      className={`flex items-center gap-2.5 border bg-white rounded-[10px] ps-1.5 pe-3 py-1.5 select-none [-webkit-touch-callout:none] ${
        checked ? "border-[var(--accent)]" : "border-[#e6e0d6]"
      } ${isDragging ? "relative z-10 shadow-lg opacity-90" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={t("admin.products.bulkSelectOne", { name: product.name })}
        className="w-4 h-4 ms-1 shrink-0 accent-[var(--accent)]"
      />
      <span
        {...attributes}
        onKeyDown={onKeyDown as React.KeyboardEventHandler | undefined}
        aria-label={t("admin.products.dragProductAria", { name: product.name })}
        className="w-6 h-9 flex items-center justify-center text-[#c5bdb1] cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripIcon className="w-4 h-4" />
      </span>
      <span className="w-6 text-center text-xs font-semibold text-[#a39a8e] tabular-nums shrink-0">{position}</span>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={optimizedImage(product.imageUrl, "THUMB")}
          alt=""
          draggable={false}
          className="w-9 h-9 rounded-[8px] object-contain bg-white border border-[#f0ece5] shrink-0"
        />
      ) : (
        <span className="w-9 h-9 rounded-[8px] bg-[#f5f2ed] flex items-center justify-center shrink-0">
          <PackageIcon className="w-4 h-4 text-[#a39a8e]" />
        </span>
      )}
      <span className={`text-[13px] font-medium truncate ${product.inStock ? "text-[#1a1714]" : "text-[#a39a8e]"}`}>
        {product.name}
      </span>
    </li>
  );
}
