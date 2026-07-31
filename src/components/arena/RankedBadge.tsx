import { Info, ShieldOff, TrendingUp } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { rankedLabel } from "@/lib/arena/rooms";
import { cn } from "@/lib/utils";

/**
 * Nhãn "Tính Elo / Không tính Elo" kèm lý do — để người chơi hiểu ngay
 * vì sao thắng mà điểm Elo không thay đổi.
 */
export function RankedBadge({
  isRanked,
  note,
  className,
  showReason,
}: {
  isRanked: boolean;
  note?: string;
  className?: string;
  /** Hiện luôn câu lý do bên dưới thay vì chỉ trong tooltip. */
  showReason?: boolean;
}) {
  const { label, reason } = rankedLabel(isRanked, note ?? "");
  const Icon = isRanked ? TrendingUp : ShieldOff;

  return (
    <div className={cn("min-w-0", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              isRanked
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
            <Info className="size-3 opacity-60" aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-xs">{reason}</TooltipContent>
      </Tooltip>
      {showReason && !isRanked ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{reason}</p>
      ) : null}
    </div>
  );
}
