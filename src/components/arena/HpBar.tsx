import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";

/** Thanh máu của một đấu thủ trong ván so tài. */
export function HpBar({
  hp,
  hpStart,
  mine,
  className,
}: {
  hp: number;
  hpStart: number;
  mine?: boolean;
  className?: string;
}) {
  const max = Math.max(1, hpStart);
  const value = Math.max(0, Math.min(max, hp));
  const percent = Math.round((value / max) * 100);
  const tone =
    percent > 60
      ? "bg-emerald-500"
      : percent > 30
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={mine ? "Máu của bạn" : "Máu của đối thủ"}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            tone,
            percent <= 30 && percent > 0 && "animate-pulse",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="flex items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground">
        <Heart className={cn("size-3.5", percent > 0 ? "text-rose-500" : "text-muted-foreground")} />
        {value}/{max}
      </p>
    </div>
  );
}
