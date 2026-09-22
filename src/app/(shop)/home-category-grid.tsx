"use client";

import { CircleTile } from "@/components/circle-tile";
import { useLocale } from "@/components/locale-provider";

const SANO_BRAND_MATCH = "סנו";
const SANO_LOGO_URL = "https://upload.wikimedia.org/wikipedia/he/a/a2/Sano_logo.svg";

type CategoryTile = {
  id: string;
  name: string;
};

export function HomeCategoryGrid({
  categories,
  showSano,
}: {
  categories: CategoryTile[];
  showSano: boolean;
}) {
  const { t } = useLocale();

  return (
    <div>
      <h1 className="text-lg font-bold text-[#1a1714] mb-4">{t("catalog.categoriesTitle")}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 max-w-2xl">
        {showSano && (
          <CircleTile href="/brand/sano" name={SANO_BRAND_MATCH} imageUrl={SANO_LOGO_URL} />
        )}
        {categories.map((category) => (
          <CircleTile key={category.id} href={`/category/${category.id}`} name={category.name} />
        ))}
      </div>
    </div>
  );
}
