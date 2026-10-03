import Link from "next/link";
import { getCategoryIcon } from "@/lib/category-icons";
import { optimizedImage } from "@/lib/image-url";

// Home page category tile: a short "shelf" strip with the category's product
// shot standing on it. The image is taller than the strip, so a transparent
// PNG rises above the strip's top edge for a 3D look; an ordinary photo just
// sits on the strip. With no image, the category icon is shown on the strip.
export function CategoryTile({
  href,
  name,
  imageUrl,
}: {
  href: string;
  name: string;
  imageUrl?: string | null;
}) {
  const Icon = getCategoryIcon(name);
  const standing = Boolean(imageUrl);
  // A standing image spans 80% of the tile's width (10% free on each side).
  // The 15:8 tile shape fits a 3:2 image at that width exactly, so there's no
  // empty band above it. On phones (one tile per row, so nothing to line up
  // with) tiles without an image shrink to just the strip.
  const stripHeight = standing ? "h-[62%]" : "h-full sm:h-[62%]";
  const boxSize = standing ? "aspect-[15/8]" : "h-28 sm:h-auto sm:aspect-[15/8]";
  return (
    <Link href={href} className="group flex flex-col items-center w-full">
      <span className={`relative block w-full ${boxSize}`}>
        <span className={`absolute inset-x-0 bottom-0 ${stripHeight} rounded-[10px] overflow-hidden bg-gradient-to-b from-[#f7f5f1] to-[#e9e4db] shadow-[0_6px_14px_-10px_rgba(0,0,0,0.35)]`}>
          <span className="absolute inset-x-0 bottom-0 h-1.5 bg-[#d9d2c6]" />
        </span>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedImage(imageUrl, "TILE")}
            alt=""
            className="absolute inset-x-0 bottom-1.5 mx-auto w-[80%] h-full object-contain object-bottom drop-shadow-[0_8px_8px_rgba(0,0,0,0.18)] transition-transform duration-300 group-hover:-translate-y-1"
          />
        ) : (
          <span className={`absolute inset-x-0 bottom-0 ${stripHeight} flex items-center justify-center`}>
            <Icon className="w-16 h-16 text-[var(--accent)] transition-transform duration-300 group-hover:-translate-y-1" />
          </span>
        )}
      </span>
      <span className="text-[17px] font-bold text-[var(--accent)] text-center leading-tight line-clamp-2 mt-2.5 transition-opacity group-hover:opacity-75">
        {name}
      </span>
    </Link>
  );
}
