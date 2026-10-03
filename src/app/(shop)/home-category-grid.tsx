"use client";

import { CategoryTile } from "@/components/category-tile";

type HomeCategory = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export function HomeCategoryGrid({ categories }: { categories: HomeCategory[] }) {
  return (
    <div>
      {/* Equal columns rather than mixed widths: tile height follows tile width
          (so images keep their size relative to the tile), and a double-width
          tile would be twice as tall. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
        {categories.map((category) => (
          <CategoryTile
            key={category.id}
            href={`/category/${category.id}`}
            name={category.name}
            imageUrl={category.imageUrl}
          />
        ))}
      </div>
    </div>
  );
}
