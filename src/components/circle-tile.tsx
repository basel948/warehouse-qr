import Link from "next/link";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCloudinaryTransform } from "@/lib/cloudinary-url";

export function CircleTile({
  href,
  name,
  imageUrl,
}: {
  href: string;
  name: string;
  imageUrl?: string | null;
}) {
  const Icon = getCategoryIcon(name);
  return (
    <Link href={href} className="flex flex-col items-center w-full">
      <span className="w-full aspect-square rounded-full border border-[#eae5dc] bg-white flex flex-col items-center justify-center gap-3.5 px-4 shrink-0 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.15)] overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={withCloudinaryTransform(imageUrl, "q_auto")}
            alt=""
            className="w-full h-full object-contain p-5"
          />
        ) : (
          <>
            <Icon className="w-16 h-16 text-[var(--accent)]" />
            <span className="text-[18px] font-semibold text-[#1a1714] text-center leading-tight line-clamp-2">
              {name}
            </span>
          </>
        )}
      </span>
      {imageUrl && (
        <span className="text-[18px] font-semibold text-[#1a1714] text-center leading-tight line-clamp-2 mt-2">
          {name}
        </span>
      )}
    </Link>
  );
}
