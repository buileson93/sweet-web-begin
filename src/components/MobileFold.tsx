import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Gấp gọn một khối thông tin phụ trên điện thoại để đỡ phải cuộn dài,
 * còn trên máy tính (lg trở lên) thì luôn hiển thị đầy đủ.
 */
export function MobileFold({
  title,
  hint,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 px-4 py-2.5 text-left transition-colors hover:bg-secondary lg:hidden"
      >
        <span className="min-w-0">
          <span className="font-heading block truncate text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          {hint ? <span className="type-meta block truncate">{hint}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <h2 className="font-heading hidden text-sm font-extrabold uppercase tracking-widest text-muted-foreground lg:block">
        {title}
      </h2>

      <div className={cn("lg:block", open ? "block" : "hidden")}>{children}</div>
    </section>
  );
}
