import { cn } from "@/lib/utils";

const LOGO_SRC = "/logo-vatm.svg";

/**
 * Logo VATM MIRATS.
 * - `mark`: chỉ lấy phần huy hiệu tròn (crop bằng overflow) — dùng cho mobile / favicon-like.
 * - `full`: logo đầy đủ kèm dòng chữ.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-start overflow-hidden rounded-xl bg-card p-1 shadow-[var(--shadow-ring)]",
        className,
      )}
      aria-hidden
    >
      <img src={LOGO_SRC} alt="" className="h-full w-auto max-w-none" />
    </span>
  );
}


export function BrandLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xl bg-card px-2.5 py-1.5 shadow-[var(--shadow-ring)]",
        className,
      )}
    >
      <img
        src={LOGO_SRC}
        alt="Logo Công ty Quản lý bay miền Trung - VATM MIRATS"
        className={cn("w-auto", compact ? "h-6" : "h-7 sm:h-8")}
        loading="eager"
      />
    </span>
  );
}
