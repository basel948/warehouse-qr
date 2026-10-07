"use client";

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
import { GripIcon, TrashIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";

type ListSubcategory = { id: string; name: string };

// Drag-to-reorder list of one category's subcategories. Their order is the
// order of the chips and sections on that category's page in the shop.
export function SubcategoryList<T extends ListSubcategory>({
  subcategories,
  productCounts,
  onReorder,
  onDelete,
}: {
  subcategories: T[];
  productCounts: Record<string, number>;
  onReorder: (reordered: T[]) => void;
  onDelete: (id: string) => void;
}) {
  // Same feel as the category list: press-and-hold on touch, drag on mouse.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = subcategories.findIndex((s) => s.id === active.id);
    const to = subcategories.findIndex((s) => s.id === over.id);
    onReorder(arrayMove(subcategories, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={subcategories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {subcategories.map((subcategory) => (
            <SortableRow
              key={subcategory.id}
              subcategory={subcategory}
              productCount={productCounts[subcategory.id] ?? 0}
              onDelete={() => onDelete(subcategory.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  subcategory,
  productCount,
  onDelete,
}: {
  subcategory: ListSubcategory;
  productCount: number;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subcategory.id,
  });
  // Hold anywhere on the row to drag; keyboard dragging only from the grip.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...pointerListeners}
      className={`flex items-center gap-2 border border-[#e6e0d6] bg-white rounded-[10px] ps-1.5 pe-1.5 py-1.5 text-[13px] select-none [-webkit-touch-callout:none] ${
        isDragging ? "relative z-10 shadow-lg opacity-90" : ""
      }`}
    >
      <span
        {...attributes}
        onKeyDown={onKeyDown as React.KeyboardEventHandler | undefined}
        aria-label={t("admin.products.dragSubcategoryAria", { name: subcategory.name })}
        className="w-6 h-8 flex items-center justify-center text-[#c5bdb1] cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripIcon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0 font-medium text-[#1a1714] truncate">{subcategory.name}</span>
      <span className="text-xs text-[#a39a8e] tabular-nums shrink-0">
        {t("admin.products.subcategoryProductCount", { count: productCount })}
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={t("admin.products.deleteCategoryAria", { name: subcategory.name })}
        className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#a39a8e] hover:text-[#b3402e] hover:bg-[#f2efe9]"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </li>
  );
}
