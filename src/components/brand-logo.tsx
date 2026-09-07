import { WAREHOUSE_LOGO_URL, WAREHOUSE_NAME } from "@/lib/branding";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const boxSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const textSize = size === "sm" ? "text-base" : "text-xl";

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {WAREHOUSE_LOGO_URL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={WAREHOUSE_LOGO_URL}
          alt={WAREHOUSE_NAME}
          className={`${boxSize} rounded-md object-contain shrink-0 bg-white border border-stone-200`}
        />
      ) : (
        <div
          className={`${boxSize} shrink-0 rounded-md bg-amber-600 text-white flex items-center justify-center text-lg`}
          aria-hidden
        >
          📦
        </div>
      )}
      <span
        className={`${textSize} font-extrabold uppercase tracking-tight text-stone-900 truncate`}
      >
        {WAREHOUSE_NAME}
      </span>
    </div>
  );
}
