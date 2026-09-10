import { WAREHOUSE_LOGO_URL, WAREHOUSE_NAME } from "@/lib/branding";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const boxSize = size === "sm" ? "h-[34px] w-[34px]" : "h-[42px] w-[42px]";
  const textSize = size === "sm" ? "text-base" : "text-[19px]";

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {WAREHOUSE_LOGO_URL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={WAREHOUSE_LOGO_URL}
          alt={WAREHOUSE_NAME}
          className={`${boxSize} rounded-xl object-contain shrink-0 bg-white border border-[#eae5dc]`}
        />
      ) : (
        <div
          className={`${boxSize} shrink-0 rounded-xl bg-[var(--accent)] flex items-center justify-center`}
          aria-hidden
        >
          <svg width="60%" height="60%" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2 1.5 8.2V10h2.3v10h16.4V10H22.5V8.2L12 2Zm-5.6 6.3h3.1v1.9H6.4V8.3Zm4.05 0h3.1v1.9h-3.1V8.3Zm4.05 0h3.1v1.9h-3.1V8.3ZM10.2 12.6h3.6v3.3h-3.6v-3.3Zm-3.9 4.1h3.6V20H6.3v-3.3Zm4.1 0H14V20h-3.5v-3.3Zm4.1 0h3.6V20h-3.6v-3.3Z" />
          </svg>
        </div>
      )}
      <span
        className={`${textSize} font-bold tracking-tight text-[#1a1714] truncate`}
      >
        {WAREHOUSE_NAME}
      </span>
    </div>
  );
}
