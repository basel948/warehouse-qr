"use client";

import { CircleTile } from "@/components/circle-tile";
import { PageBackLink } from "@/components/page-back-link";
import { useLocale } from "@/components/locale-provider";

type SubcategoryTile = {
  id: string;
  name: string;
};

export function SubcategoryGrid({
  categoryId,
  categoryName,
  subcategories,
  hasOther,
}: {
  categoryId: string;
  categoryName: string;
  subcategories: SubcategoryTile[];
  hasOther: boolean;
}) {
  const { t } = useLocale();
  const isEmpty = subcategories.length === 0 && !hasOther;

  return (
    <div>
      <PageBackLink href="/" title={categoryName} />

      {isEmpty ? (
        <p className="text-sm text-[#8a8177] py-8 text-center">{t("catalog.noProductsInCategory")}</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 max-w-2xl">
          {subcategories.map((subcategory) => (
            <CircleTile
              key={subcategory.id}
              href={`/category/${categoryId}/${subcategory.id}`}
              name={subcategory.name}
            />
          ))}
          {hasOther && (
            <CircleTile
              href={`/category/${categoryId}/other`}
              name={t("catalog.otherCategory")}
            />
          )}
        </div>
      )}
    </div>
  );
}
