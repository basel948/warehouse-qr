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
import { ChevronDownIcon, GripIcon, PackageIcon, TrashIcon } from "@/components/icons";
import { useConfirm } from "@/components/confirm-dialog";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { optimizedImage } from "@/lib/image-url";
import { MergeOptionsDialog } from "./merge-options-dialog";

type OrderProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  inStock: boolean;
  sortOrder: number;
  categories: { id: string }[];
  subcategoryId: string | null;
  variantGroup: { id: string; name: string } | null;
  variantLabel: string | null;
};

type OrderCategory = { id: string; name: string };
type OrderSubcategory = { id: string; name: string; categoryId: string };

// "Arrange products": pick a category, then drag its products into the order
// buyers see on that category's page. Grouped by subcategory exactly like the
// shop page (subcategories in their own order, products without one last), and
// each group is reordered on its own. Saves as soon as a product is dropped.
// Products can also be ticked and then marked out of / back in stock, moved
// to another subcategory, or deleted together (one confirmation per batch).
// Subcategories are listed closed; opening one closes the others, and their
// rows can be dragged to reorder the subcategories themselves. New
// subcategories are added here too, and each row can delete its subcategory.
export function ProductOrderSection({
  categories,
  subcategories,
  products,
  onSaved,
  onReorderSubcategories,
  onAddSubcategory,
  onDeleteSubcategory,
}: {
  categories: OrderCategory[];
  subcategories: OrderSubcategory[];
  products: OrderProduct[];
  onSaved: () => void;
  /** Saves a category's subcategories in this new order (ids). */
  onReorderSubcategories: (orderedIds: string[]) => void;
  /** Adds a subcategory to a category; resolves to an error message or null. */
  onAddSubcategory: (categoryId: string, name: string) => Promise<string | null>;
  /** Deletes a subcategory (asks for confirmation first). */
  onDeleteSubcategory: (id: string) => void;
}) {
  const { t } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [merging, setMerging] = useState(false);
  // Accordion: at most one subcategory is open, so only its products show.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  // Local order while a save is in flight, so the list doesn't jump back.
  const [override, setOverride] = useState<Record<string, number>>({});

  const position = (p: OrderProduct) => override[p.id] ?? p.sortOrder;
  const inCategory = products
    .filter((p) => p.categories.some((c) => c.id === categoryId))
    .sort((a, b) => position(a) - position(b) || a.name.localeCompare(b.name, "he"));

  // Every subcategory is listed (empty ones too, so they can be arranged);
  // the "other" group (no subcategory) only when it has products, always last.
  const subGroups = subcategories
    .filter((s) => s.categoryId === categoryId)
    .map((s) => ({ id: s.id, name: s.name, items: inCategory.filter((p) => p.subcategoryId === s.id) }));
  const otherItems = inCategory.filter(
    (p) => !p.subcategoryId || !subcategories.some((s) => s.id === p.subcategoryId && s.categoryId === categoryId)
  );
  const groups = [
    ...subGroups,
    ...(otherItems.length > 0 ? [{ id: "other", name: t("catalog.otherCategory"), items: otherItems }] : []),
  ];
  const groupSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleGroupDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = subGroups.map((g) => g.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorderSubcategories(arrayMove(ids, from, to));
  }

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

  async function unmerge() {
    const merged = selectedHere.filter((p) => p.variantGroup);
    const ok = await confirm({
      title: t("admin.variants.unmergeTitle", { count: merged.length }),
      message: t("admin.variants.unmergeBody"),
      confirmLabel: t("admin.variants.unmerge"),
      tone: "normal",
    });
    if (!ok) return;
    setBulkBusy(true);
    const res = await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: merged.map((p) => p.id), action: "unmerge" }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      toast(t("admin.products.toastFailed"), "error");
      return;
    }
    setSelected(new Set());
    toast(t("admin.variants.unmerged", { count: merged.length }));
    onSaved();
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

  // Moves the ticked products into another subcategory of this category
  // ("" = no subcategory, the "other" group). One confirmation for all.
  async function moveToSubcategory(subcategoryId: string) {
    const count = selectedHere.length;
    if (count === 0) return;
    const target = subcategories.find((s) => s.id === subcategoryId);
    const name = target ? target.name : t("catalog.otherCategory");
    const ok = await confirm({
      title: t("admin.confirmDialog.bulkMoveTitle", { count, name }),
      message: t("admin.confirmDialog.bulkMoveBody"),
      confirmLabel: t("admin.confirmDialog.bulkMove"),
      tone: "normal",
    });
    if (!ok) return;

    setBulkBusy(true);
    const res = await fetch("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: selectedHere.map((p) => p.id),
        action: "subcategory",
        subcategoryId: subcategoryId || null,
      }),
    }).catch(() => null);
    setBulkBusy(false);
    if (!res?.ok) {
      toast(t("admin.products.toastFailed"), "error");
      return;
    }
    const { updated } = (await res.json()) as { updated: number };
    setSelected(new Set());
    // Open the destination so the moved products are in view.
    setOpenGroup(subcategoryId || "other");
    onSaved();
    toast(t("admin.products.bulkMoved", { count: updated, name }));
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
      <p className="text-[13px] text-[#8a8177] mb-3">{t("admin.products.arrangeHint")}</p>

      <select
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setOverride({});
          setSelected(new Set());
          setOpenGroup(null);
          setNewSubcategoryName("");
          setAddError(null);
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

      {categoryId && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const error = await onAddSubcategory(categoryId, newSubcategoryName);
            setAddError(error);
            if (!error) setNewSubcategoryName("");
          }}
          className="flex gap-2 mb-3"
        >
          <input
            type="text"
            placeholder={t("admin.products.newSubcategoryPlaceholder")}
            value={newSubcategoryName}
            onChange={(e) => setNewSubcategoryName(e.target.value)}
            className="flex-1 min-w-0 border border-[#e6e0d6] bg-white rounded-[10px] px-3.5 py-2.5"
          />
          <button
            type="submit"
            className="bg-[var(--accent)] text-white rounded-[10px] px-4 py-2.5 text-sm font-semibold shrink-0"
          >
            {t("admin.products.add")}
          </button>
        </form>
      )}
      {addError && <p className="text-sm text-[#b3402e] -mt-1.5 mb-3">{addError}</p>}

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

      {/* A category with no subcategories: its products show directly. */}
      {subGroups.length === 0 && otherItems.length > 0 && (
        <SortableProducts items={otherItems} onReorder={saveGroup} selected={selected} onToggle={toggle} />
      )}

      {subGroups.length > 0 && (
        <DndContext sensors={groupSensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
          <SortableContext items={subGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {groups.map((group) => {
                const open = openGroup === group.id;
                const ticked = group.items.filter((p) => selected.has(p.id)).length;
                return (
                  <SortableGroup
                    key={group.id}
                    id={group.id}
                    sortable={group.id !== "other"}
                    name={group.name}
                    count={group.items.length}
                    ticked={ticked}
                    open={open}
                    onToggle={() => setOpenGroup(open ? null : group.id)}
                    onDelete={group.id !== "other" ? () => onDeleteSubcategory(group.id) : undefined}
                  >
                    {open &&
                      (group.items.length > 0 ? (
                        <SortableProducts items={group.items} onReorder={saveGroup} selected={selected} onToggle={toggle} />
                      ) : (
                        <p className="text-[13px] text-[#a39a8e] px-3.5 py-2">{t("admin.products.arrangeEmpty")}</p>
                      ))}
                  </SortableGroup>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

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
          {subcategories.some((s) => s.categoryId === categoryId) && (
            <select
              value=""
              disabled={bulkBusy}
              onChange={(e) => moveToSubcategory(e.target.value === "other" ? "" : e.target.value)}
              aria-label={t("admin.products.bulkMoveTo")}
              className="text-[13px] font-semibold rounded-[8px] bg-white/10 text-white px-2 py-1.5 disabled:opacity-50 [&>option]:text-[#1a1714]"
            >
              <option value="" disabled>
                {t("admin.products.bulkMoveTo")}
              </option>
              {subcategories
                .filter((s) => s.categoryId === categoryId)
                .map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              <option value="other">{t("catalog.otherCategory")}</option>
            </select>
          )}
          {/* Always shown once something is ticked, so it's discoverable;
              merging needs at least two products. */}
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() =>
              selectedHere.length >= 2 ? setMerging(true) : toast(t("admin.variants.mergeNeedTwo"), "error")
            }
            className="text-[13px] font-semibold rounded-[8px] bg-[var(--accent)] px-3 py-1.5 disabled:opacity-50"
          >
            {t("admin.variants.mergeButton")}
          </button>
          {selectedHere.some((p) => p.variantGroup) && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={unmerge}
              className="text-[13px] font-semibold rounded-[8px] bg-[#33508f] px-3 py-1.5 disabled:opacity-50"
            >
              {t("admin.variants.unmerge")}
            </button>
          )}
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

      {merging && (
        <MergeOptionsDialog
          products={selectedHere}
          onClose={() => setMerging(false)}
          onMerged={() => {
            setMerging(false);
            setSelected(new Set());
            toast(t("admin.variants.merged", { count: selectedHere.length }));
            onSaved();
          }}
        />
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
      {product.variantGroup && (
        <span className="ms-auto shrink-0 max-w-[40%] truncate text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[#eef2fb] text-[#33508f]">
          {product.variantGroup.name}
        </span>
      )}
    </li>
  );
}

// One subcategory row in the arrange list: drag it (hold anywhere on the row,
// or the grip) to reorder subcategories, tap it to open its products. The
// "other" group (no subcategory) isn't draggable: it always comes last.
function SortableGroup({
  id,
  sortable,
  name,
  count,
  ticked,
  open,
  onToggle,
  onDelete,
  children,
}: {
  id: string;
  sortable: boolean;
  name: string;
  count: number;
  ticked: number;
  open: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });
  const { onKeyDown, ...pointerListeners } = (sortable && listeners) || {};

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-90" : ""}
    >
      <div
        {...pointerListeners}
        className={`flex items-center bg-[#f7f5f1] border border-[#eae5dc] rounded-[10px] select-none [-webkit-touch-callout:none] ${
          open ? "mb-1.5" : ""
        } ${isDragging ? "shadow-lg" : ""}`}
      >
        {sortable ? (
          <span
            {...attributes}
            onKeyDown={onKeyDown as React.KeyboardEventHandler | undefined}
            aria-label={t("admin.products.dragSubcategoryAria", { name })}
            className="w-7 h-11 flex items-center justify-center text-[#c5bdb1] cursor-grab active:cursor-grabbing shrink-0 ms-1"
          >
            <GripIcon className="w-4 h-4" />
          </span>
        ) : (
          <span className="w-7 shrink-0 ms-1" />
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`flex-1 min-w-0 flex items-center gap-2.5 py-2.5 text-start ${onDelete ? "pe-1" : "pe-3.5"}`}
        >
          <span className="flex-1 min-w-0 text-sm font-semibold text-[#1a1714] truncate">{name}</span>
          {ticked > 0 && (
            <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent)] text-white">
              {t("admin.products.bulkSelected", { count: ticked })}
            </span>
          )}
          <span className="text-xs text-[#a39a8e] tabular-nums shrink-0">
            {t("admin.products.subcategoryProductCount", { count })}
          </span>
          <ChevronDownIcon
            className={`w-4 h-4 shrink-0 text-[#6b6259] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("admin.products.deleteCategoryAria", { name })}
            className="w-9 h-9 me-1 shrink-0 flex items-center justify-center rounded-[8px] text-[#a39a8e] hover:text-[#b3402e] hover:bg-white"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
