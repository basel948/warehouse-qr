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
import { GripIcon, PackageIcon, TrashIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { optimizedImage } from "@/lib/image-url";

type ListCategory = {
  id: string;
  name: string;
  imageUrl: string | null;
};

// Drag-to-reorder category list. On touch, a row is picked up after a short
// press-and-hold, so a quick tap still opens the image panel and swiping still
// scrolls the page; with a mouse, dragging a few pixels picks it up.
export function CategoryList<T extends ListCategory>({
  categories,
  expandedId,
  onToggleExpanded,
  onDelete,
  onReorder,
  renderExpanded,
}: {
  categories: T[];
  expandedId: string;
  onToggleExpanded: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (reordered: T[]) => void;
  renderExpanded: (category: T) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = categories.findIndex((category) => category.id === active.id);
    const to = categories.findIndex((category) => category.id === over.id);
    onReorder(arrayMove(categories, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={categories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {categories.map((category) => (
            <SortableRow
              key={category.id}
              category={category}
              expanded={expandedId === category.id}
              onToggleExpanded={() => onToggleExpanded(category.id)}
              onDelete={() => onDelete(category.id)}
            >
              {expandedId === category.id && renderExpanded(category)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  category,
  expanded,
  onToggleExpanded,
  onDelete,
  children,
}: {
  category: ListCategory;
  expanded: boolean;
  onToggleExpanded: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  // Press-and-hold works anywhere on the row, but keyboard dragging only from
  // the grip, so Enter/Space on the row's own buttons keeps doing their job.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border bg-white rounded-[10px] ${
        expanded ? "border-[var(--accent)]" : "border-[#e6e0d6]"
      } ${isDragging ? "relative z-10 shadow-lg opacity-90" : ""}`}
    >
      <div
        {...pointerListeners}
        className="flex items-center gap-2 ps-1.5 pe-1.5 py-1.5 text-[13px] select-none [-webkit-touch-callout:none]"
      >
        <span
          {...attributes}
          onKeyDown={onKeyDown as React.KeyboardEventHandler | undefined}
          aria-label={t("admin.products.dragCategoryAria", { name: category.name })}
          className="w-6 h-9 flex items-center justify-center text-[#c5bdb1] cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripIcon className="w-4 h-4" />
        </span>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={t("admin.products.categoryImageAria", { name: category.name })}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-start"
        >
          {category.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={optimizedImage(category.imageUrl, "THUMB")}
              alt=""
              draggable={false}
              className="w-9 h-9 rounded-[8px] object-contain bg-[#f5f2ed] shrink-0"
            />
          ) : (
            <span className="w-9 h-9 rounded-[8px] bg-[#f5f2ed] flex items-center justify-center shrink-0">
              <PackageIcon className="w-4 h-4 text-[#a39a8e]" />
            </span>
          )}
          <span className="font-medium text-[#1a1714] truncate">{category.name}</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("admin.products.deleteCategoryAria", { name: category.name })}
          className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#a39a8e] hover:text-[#b3402e] hover:bg-[#f2efe9]"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
      {children}
    </li>
  );
}
