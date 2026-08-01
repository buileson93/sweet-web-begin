import { FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Nhãn "Beta" cho tính năng đang thử nghiệm (hiện dùng cho Đấu trường).
 * Dùng chung để mọi nơi hiển thị nhất quán.
 */
export function BetaBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      title="Tính năng đang thử nghiệm — có thể còn lỗi và sẽ thay đổi"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 bg-warning/15 font-semibold uppercase tracking-wide text-warning",
        compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
        className,
      )}
    >
      {!compact && <FlaskConical className="size-3" />} Beta
    </span>
  );
}
