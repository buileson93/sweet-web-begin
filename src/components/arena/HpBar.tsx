import { memo, useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";

/** Thanh máu của một đấu thủ: có vệt "máu vừa mất" trượt theo kiểu game turn-based. */
export const HpBar = memo(function HpBar({
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
  const [ghost, setGhost] = useState(percent);
  const prev = useRef(percent);

  useEffect(() => {
    if (percent >= prev.current) {
      prev.current = percent;
      setGhost(percent);
      return;
    }
    prev.current = percent;
    const id = window.setTimeout(() => setGhost(percent), 420);
    return () => window.clearTimeout(id);
  }, [percent]);

  const tone = percent >= 60 ? "bg-emerald-500" : percent >= 20 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="relative h-3.5 w-full overflow-hidden rounded-full border border-border/60 bg-muted shadow-inner"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={mine ? "Máu của bạn" : "Máu của đối thủ"}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-rose-300/70 transition-[width] duration-700 ease-out dark:bg-rose-400/40"
          style={{ width: `${ghost}%` }}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
            tone,
            percent < 20 && percent > 0 && "animate-pulse",
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
})
